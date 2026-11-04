package service

import (
	"context"
	"errors"
	"fmt"

	"offer-hub/data"
	"offer-hub/model"
)

// GetUserInfo 查询当前登录用户的资料；
// token 有效但用户已不存在时返回 ErrInvalidToken，ctrl 按未登录处理
func GetUserInfo(ctx context.Context, userID string) (*model.GetUserInfoData, error) {
	u, err := data.GetUserByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, data.ErrUserNotFound) {
			return nil, ErrInvalidToken
		}
		return nil, fmt.Errorf("get user GetUserInfo: %w", err)
	}

	return &model.GetUserInfoData{
		UserID:       u.UserID,
		Username:     u.Username,
		NickName:     u.NickName,
		Avatar:       u.Avatar,
		Vip:          u.VIP,
		Sex:          u.Sex,
		Phone:        u.Phone,
		Email:        u.Email,
		Introduction: u.Introduction,
		AvatarURL:    u.Avatar,
		UserStatus:   u.UserStatus,
		UserType:     u.UserType,
		CreateTime:   formatTime(u.CreateTime),
		UpdateTime:   formatTime(u.UpdateTime),
	}, nil
}
