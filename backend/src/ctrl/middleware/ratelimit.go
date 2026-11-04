package middleware

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"offer-hub/config"
	"offer-hub/service"
)

// RateLimit 限流：登录用户按 user_id 计数，游客按客户端 IP 计数，超过上限返回 HTTP 429。
// 要挂在 JWTAuth / SoftJWTAuth 后面才能拿到 user_id；配置里 enable = false 时直接放行。
// 同一个用户的计数在所有挂了限流的路由之间共享
func RateLimit() gin.HandlerFunc {
	return newRateLimit(config.Conf.RateLimit, func(c *gin.Context) string {
		// user_id 只从 context 读（JWT 校验过），不读请求头：请求头可以伪造，每次换一个就能绕过限流
		if userID := c.GetString(CtxKeyUserID); userID != "" {
			return "user:" + userID
		}
		return "ip:" + c.ClientIP()
	})
}

// AuthRateLimit 登录、注册专用的限流：按客户端 IP 计数，额度比 RateLimit 小，用来防暴力破解密码。
// 读配置 [AuthRateLimit]，计数和 RateLimit 互不影响，两个可以挂在同一个路由上
func AuthRateLimit() gin.HandlerFunc {
	return newRateLimit(config.Conf.AuthRateLimit, func(c *gin.Context) string {
		return "auth:ip:" + c.ClientIP()
	})
}

// newRateLimit 按 conf 创建限流中间件，keyOf 决定一个请求算在谁头上
func newRateLimit(conf config.RateLimitConfig, keyOf func(c *gin.Context) string) gin.HandlerFunc {
	if !conf.Enable {
		return func(c *gin.Context) { c.Next() }
	}
	limiter := service.NewRateLimiter(conf.MaxRequests, time.Duration(conf.WindowSeconds)*time.Second)

	return func(c *gin.Context) {
		allowed, err := limiter.Allow(c.Request.Context(), keyOf(c))
		if err != nil {
			// Redis 出错时放行：限流只是保护措施，不能因为 Redis 故障让所有接口都不可用
			log.Printf("service.Allow: %v", err)
			c.Next()
			return
		}
		if !allowed {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"code": 429,
				"msg":  "请求过于频繁，请稍后再试",
				"data": nil,
			})
			return
		}

		c.Next()
	}
}
