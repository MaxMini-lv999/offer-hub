package ngin

import "github.com/gin-gonic/gin"

// CreateGin 创建 Gin 实例并挂载全局中间件。
func CreateGin() *gin.Engine {
	r := gin.New()
	// 不信任任何代理：ClientIP 直接取 TCP 连接的对端地址，客户端伪造 X-Forwarded-For 绕不过按 IP 限流。
	// gin 默认信任所有代理。部署到 nginx 后面时要改成 nginx 的地址，否则所有请求的 IP 都是 nginx 的。
	// 参数为 nil 时不会返回错误
	_ = r.SetTrustedProxies(nil)
	r.Use(gin.Logger(), gin.Recovery())
	return r
}
