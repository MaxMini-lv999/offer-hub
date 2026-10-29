package service

import (
	"context"
	"errors"
	"fmt"

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

// ErrUserDisabled 账号已被禁用，ctrl 据此返回"账号已被禁用"
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

	if userInfo.UserStatus == data.UserStatusDisabled {
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
