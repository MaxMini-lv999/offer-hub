package ngin

import (
	"fmt"

	"github.com/gin-gonic/gin"
)

// realIPHeader 反向代理（nginx）写入访客真实 IP 的请求头。
// nginx 用 proxy_set_header 覆盖它，客户端自己带的同名头传不到后端
const realIPHeader = "X-Real-IP"

// CreateGin 创建 Gin 实例并挂载全局中间件。
//
// trustedProxies 是可信反向代理的 IP 或 CIDR（配置 [COMMON] trusted_proxies）：
//   - 为空（本地开发）：不信任任何代理，ClientIP 直接取 TCP 连接的对端地址，客户端伪造请求头绕不过按 IP 限流
//   - 不为空（线上在 nginx 后面）：只有来自这些地址的请求，才从 X-Real-IP 取访客 IP；
//     其他来源照旧取对端地址。不读 X-Forwarded-For，它可以被客户端追加伪造的值
//
// gin 默认信任所有代理，所以一定要显式设置
func CreateGin(trustedProxies []string) (*gin.Engine, error) {
	r := gin.New()
	if len(trustedProxies) == 0 {
		trustedProxies = nil // 空切片和 nil 对 gin 都是"不信任"，统一成 nil
	}
	if err := r.SetTrustedProxies(trustedProxies); err != nil {
		return nil, fmt.Errorf("set trusted proxies %v: %w", trustedProxies, err)
	}
	r.RemoteIPHeaders = []string{realIPHeader}
	r.Use(gin.Logger(), gin.Recovery())
	return r, nil
}
