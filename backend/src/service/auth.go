package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"offer-hub/data"
	"offer-hub/model"
)

// bcryptCost bcrypt 加密强度，每加 1 耗时翻一倍
const bcryptCost = 12

// ErrUsernameExists 用户名已被注册，ctrl 据此返回"用户名已存在"
var ErrUsernameExists = errors.New("username already exists")

// Register 用户名密码注册，成功返回 nil
func Register(ctx context.Context, req *model.PasswordRegisterReq) error {
	if res, err := data.ExistsUserByUsername(ctx, req.Username); err != nil {
		return fmt.Errorf("failed Register:%w", err)
	} else if res {
		return ErrUsernameExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		return fmt.Errorf("bcrypt Error:%w", err)
	}

	if err := data.CreateUser(ctx, &data.UserInfo{
		UserID:   uuid.NewString(),
		Username: req.Username,
		Password: string(hash),
		NickName: req.Username,
	}); err != nil {
		return fmt.Errorf("create Register.CreateUser:%w", err)
	}

	return nil

}

// ErrInvalidCredentials 用户名不存在或密码错误，ctrl 据此返回"用户名或密码错误"
var ErrInvalidCredentials = errors.New("invalid username or password")

// ErrUserDisabled 账号不是正常状态（user_status != 1，比如被禁用），
// 登录时 ctrl 返回"账号已被禁用"，强制鉴权时返回"账号不可用"
var ErrUserDisabled = errors.New("user disabled")

// Login 用户名密码登录，成功返回 token 和用户信息
func Login(ctx context.Context, req *model.PasswordLoginReq) (*model.PasswordLoginData, error) {
	userInfo, err := data.GetUserByUsername(ctx, req.Username)
	if err != nil {
		if errors.Is(err, data.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("get user Login: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(userInfo.Password), []byte(req.Password)); err != nil {
		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("compare password Login: %w", err)
	}

	// 只认正常状态：以后新增的状态（注销、冻结等）默认不能登录
	if userInfo.UserStatus != data.UserStatusActive {
		return nil, ErrUserDisabled
	}
	token, err := GenerateToken(userInfo.UserID)
	if err != nil {
		return nil, fmt.Errorf("generate token Login: %w", err)
	}

	return &model.PasswordLoginData{Token: token, UserInfo: model.PasswordLoginUserInfo{
		UserID:     userInfo.UserID,
		Username:   userInfo.Username,
		NickName:   userInfo.NickName,
		Avatar:     userInfo.Avatar,
		Sex:        userInfo.Sex,
		Vip:        userInfo.VIP,
		Phone:      userInfo.Phone,
		Email:      userInfo.Email,
		UserStatus: userInfo.UserStatus,
		UserType:   userInfo.UserType,
	}}, nil

}

// ErrInvalidToken token 无效、过期或已登出，ctrl 据此返回 401
var ErrInvalidToken = errors.New("invalid token")

// AuthenticateToken 先校验 token 本身，再查黑名单，都通过才返回 claims；
// Redis 出错时返回包装后的错误，不放行
func AuthenticateToken(ctx context.Context, tokenStr string) (*Claims, error) {
	claims, err := ParseToken(tokenStr)
	if err != nil {
		return nil, ErrInvalidToken
	}
	if res, err := data.IsTokenInBlacklist(ctx, tokenStr); err != nil {
		return nil, fmt.Errorf("check blacklist AuthenticateToken: %w", err)
	} else if res {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// CheckUserActive 检查 token 对应的用户还能不能用，只给强制鉴权调用：
// 用户已不存在返回 ErrInvalidToken，账号不是正常状态返回 ErrUserDisabled，
// 数据库出错返回包装后的错误，都通过返回 nil
func CheckUserActive(ctx context.Context, userID string) error {
	u, err := data.GetUserByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, data.ErrUserNotFound) {
			return ErrInvalidToken
		}
		return fmt.Errorf("get user CheckUserActive: %w", err)
	}
	if u.UserStatus != data.UserStatusActive {
		return ErrUserDisabled
	}
	return nil
}

// Logout 登出：把 token 写入黑名单，TTL 等于剩余有效期
func Logout(ctx context.Context, tokenStr string, expiresAt time.Time) error {
	ttl := time.Until(expiresAt)
	// ttl <= 0 时 go-redis 的 Set 会写成永不过期的 key；token 已过期本来就会被拒，不用进黑名单
	if ttl <= 0 {
		return nil
	}
	if err := data.AddTokenToBlacklist(ctx, tokenStr, ttl); err != nil {
		return fmt.Errorf("add blacklist Logout: %w", err)
	}
	return nil
}
