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

// CreateUser 插入一个用户，成功后 GORM 会把自增主键回填到 u.ID
func CreateUser(ctx context.Context, u *UserInfo) error {
	db := GetData().MySQL.WithContext(ctx)
	if err := db.Create(u).Error; err != nil {
		return fmt.Errorf("insert username:%s CreateUser: %w", u.Username, err)
	}
	return nil
}

// ErrUserNotFound 用户名不存在
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

// UserStatusDisabled 账号状态：禁用
const UserStatusDisabled = -1
