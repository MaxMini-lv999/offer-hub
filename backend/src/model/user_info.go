package model

// GetUserInfoData GET /api/v1/user_info/get_user_info 响应 data，字段用 snake_case
type GetUserInfoData struct {
	UserID       string `json:"user_id"`
	Username     string `json:"username"`
	NickName     string `json:"nick_name"`
	Avatar       string `json:"avatar"`
	Vip          bool   `json:"vip"`
	Sex          int    `json:"sex"` // 1未知 / 2男 / 3女
	Phone        string `json:"phone"`
	Email        string `json:"email"`
	Introduction string `json:"introduction"`
	AvatarURL    string `json:"avatar_url"`  // 表里只有 avatar 一列，与 Avatar 取同一个值
	UserStatus   int    `json:"user_status"` // 1正常 / -1禁用
	UserType     int    `json:"user_type"`   // 1普通用户 / 2内测用户
	CreateTime   string `json:"create_time"` // 格式 2006-01-02 15:04:05
	UpdateTime   string `json:"update_time"`
}

// GetUserInfoResp GET /api/v1/user_info/get_user_info 获取用户信息响应
type GetUserInfoResp struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data GetUserInfoData `json:"data"`
}
