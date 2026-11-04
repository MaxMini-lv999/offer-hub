package data

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// UserInfo 对应 MySQL t_user_info 表
type UserInfo struct {
	ID           int64     `gorm:"column:id;primaryKey"`
	UserID       string    `gorm:"column:user_id"`
	Username     string    `gorm:"column:username"`
	Password     string    `gorm:"column:password"` // bcrypt 哈希，不是明文
	NickName     string    `gorm:"column:nick_name"`
	Avatar       string    `gorm:"column:avatar"`
	Introduction string    `gorm:"column:introduction"`
	Phone        string    `gorm:"column:phone"`
	Email        string    `gorm:"column:email"`
	Sex          int       `gorm:"column:sex;default:1"`         // 1未知 / 2男 / 3女
	VIP          bool      `gorm:"column:vip"`                   // tinyint 0/1 自动转 bool
	UserStatus   int       `gorm:"column:user_status;default:1"` // 1正常 / -1禁用
	UserType     int       `gorm:"column:user_type;default:1"`   // 1普通用户 / 2内测用户
	CreateTime   time.Time `gorm:"column:create_time;autoCreateTime"`
	UpdateTime   time.Time `gorm:"column:update_time;autoUpdateTime"`
}

// TableName 指定表名，否则 GORM 会去找 user_infos 表
func (UserInfo) TableName() string {
	return "t_user_info"
}

// ExistsUserByUsername 判断用户名是否已被注册
func ExistsUserByUsername(ctx context.Context, username string) (bool, error) {
	var count int64
	db := GetData().MySQL.WithContext(ctx)
	if err := db.Model(&UserInfo{}).Where("username=?", username).Count(&count).Error; err != nil {
		return false, fmt.Errorf("count ExistsUserByUsername %s: %w", username, err)
	}
	return count > 0, nil
}

// ErrUserDuplicated 插入用户时撞了唯一索引（uk_username 或 uk_user_id）。
// user_id 是 UUID，实际只会是用户名重复：两个请求同时注册同一个用户名，都通过了"是否已存在"的检查
var ErrUserDuplicated = errors.New("user duplicated")

// CreateUser 插入一个用户，成功后 GORM 会把自增主键回填到 u.ID；用户名已存在时返回 ErrUserDuplicated
func CreateUser(ctx context.Context, u *UserInfo) error {
	db := GetData().MySQL.WithContext(ctx)
	if err := db.Create(u).Error; err != nil {
		// 需要 gorm.Config 开启 TranslateError（见 newMySQL），否则拿到的是驱动原始的 1062 错误
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return ErrUserDuplicated
		}
		return fmt.Errorf("insert username:%s CreateUser: %w", u.Username, err)
	}
	return nil
}

// ErrUserNotFound 按用户名或 user_id 都查不到用户
var ErrUserNotFound = errors.New("user not found")

// GetUserByUsername 按用户名查询一个用户，查不到时返回 ErrUserNotFound
func GetUserByUsername(ctx context.Context, username string) (*UserInfo, error) {
	db := GetData().MySQL.WithContext(ctx)
	var u UserInfo
	if err := db.Where("username=?", username).First(&u).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("first GetUserByUsername %s: %w", username, err)
	}
	return &u, nil
}

// GetUserByUserID 按 user_id 查询一个用户，查不到时返回 ErrUserNotFound
func GetUserByUserID(ctx context.Context, userID string) (*UserInfo, error) {
	db := GetData().MySQL.WithContext(ctx)
	var u UserInfo
	if err := db.Where("user_id=?", userID).First(&u).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("first GetUserByUserID %s: %w", userID, err)
	}
	return &u, nil
}

// 账号状态（t_user_info.user_status）
const (
	UserStatusActive   = 1  // 正常，只有这个状态能登录、能过强制鉴权
	UserStatusDisabled = -1 // 禁用
)

func ListUsersByUserIDs(ctx context.Context, userIDs []string) ([]UserInfo, error) {
	if len(userIDs) == 0 {
		return nil, nil
	}

	db := GetData().MySQL.WithContext(ctx)
	var list []UserInfo
	if err := db.Select("user_id", "nick_name", "avatar").Where("user_id in ?", userIDs).Find(&list).Error; err != nil {
		return nil, fmt.Errorf("find ListUsersByUserIDs: %w", err)
	}

	return list, nil
}
