package model

// PasswordRegisterReq POST /auth/register 注册请求
type PasswordRegisterReq struct {
	Username string `json:"username" binding:"required,max=50"` // 最长 50 字符
	Password string `json:"password" binding:"required,min=6"`  // 最少 6 位
}

// PasswordRegisterResp POST /auth/register 注册响应，成功时 data 为 null
type PasswordRegisterResp struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data any    `json:"data"`
}

// PasswordLoginReq POST /auth/login 登录请求
type PasswordLoginReq struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// PasswordLoginUserInfo 登录响应里的用户信息，接口文档规定这里用 camelCase，与其他接口的 snake_case 不同
type PasswordLoginUserInfo struct {
	UserID     string `json:"userId"`
	Username   string `json:"username"`
	NickName   string `json:"nickName"`
	Avatar     string `json:"avatar"`
	Sex        int    `json:"sex"` // 1未知 / 2男 / 3女
	Vip        bool   `json:"vip"`
	Phone      string `json:"phone"`
	Email      string `json:"email"`
	UserStatus int    `json:"userStatus"` // 1正常 / -1禁用
	UserType   int    `json:"userType"`   // 1普通用户 / 2内测用户
}

// PasswordLoginData 登录响应 data
type PasswordLoginData struct {
	Token    string                `json:"token"`
	UserInfo PasswordLoginUserInfo `json:"userInfo"`
}

// PasswordLoginResp POST /auth/login 登录响应
type PasswordLoginResp struct {
	Code int               `json:"code"`
	Msg  string            `json:"msg"`
	Data PasswordLoginData `json:"data"`
}

// LogoutData 登出响应 data
type LogoutData struct {
	Message string `json:"message"`
}

// LogoutResp POST /auth/logout 登出响应
type LogoutResp struct {
	Code int        `json:"code"`
	Msg  string     `json:"msg"`
	Data LogoutData `json:"data"`
}
