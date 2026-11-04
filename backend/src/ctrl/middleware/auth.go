package middleware

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"offer-hub/service"
)

// context 里的 key，handler 用 c.GetString / c.GetTime 读取
const (
	CtxKeyUserID   = "user_id"   // string
	CtxKeyToken    = "token"     // string，原始 token
	CtxKeyTokenExp = "token_exp" // time.Time，token 过期时间
)

// JWTAuth 强制鉴权：没有有效 token 返回 401，用户已不存在或账号不是正常状态也返回 401；
// 通过后把 user_id、token、过期时间存进 context
func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, found := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !found || token == "" {
			c.AbortWithStatusJSON(http.StatusOK, gin.H{
				"code": 401,
				"msg":  "未登录或登录已过期",
				"data": nil,
			})
			return
		}
		claims, err := service.AuthenticateToken(c.Request.Context(), token)
		if err != nil {
			if errors.Is(err, service.ErrInvalidToken) {
				c.AbortWithStatusJSON(http.StatusOK, gin.H{
					"code": 401,
					"msg":  "未登录或登录已过期",
					"data": nil,
				})
				return
			}
			log.Printf("service.AuthenticateToken: %v", err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"code": 500,
				"msg":  "服务器内部错误",
				"data": nil,
			})
			return
		}
		// token 有效不代表账号还能用：签发之后被禁用的账号，要在 token 过期前就拦下来
		if err := service.CheckUserActive(c.Request.Context(), claims.UserID); err != nil {
			if errors.Is(err, service.ErrInvalidToken) {
				c.AbortWithStatusJSON(http.StatusOK, gin.H{
					"code": 401,
					"msg":  "未登录或登录已过期",
					"data": nil,
				})
				return
			}
			if errors.Is(err, service.ErrUserDisabled) {
				c.AbortWithStatusJSON(http.StatusOK, gin.H{
					"code": 401,
					"msg":  "账号不可用",
					"data": nil,
				})
				return
			}
			log.Printf("service.CheckUserActive: %v", err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"code": 500,
				"msg":  "服务器内部错误",
				"data": nil,
			})
			return
		}
		c.Set(CtxKeyUserID, claims.UserID)
		c.Set(CtxKeyToken, token)
		c.Set(CtxKeyTokenExp, claims.ExpiresAt.Time)

		c.Next()
	}
}

// SoftJWTAuth 软鉴权：token 有效就把 user_id 存进 context，否则按游客放行，任何情况都不返回 401。
// handler 用 c.GetString(CtxKeyUserID) 读取，空串表示游客
func SoftJWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, found := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !found || token == "" {
			return
		}
		claims, err := service.AuthenticateToken(c.Request.Context(), token)
		if err != nil {
			// 无效、过期、已登出是正常情况，不打日志；Redis 出错才记录，同样按游客放行
			if !errors.Is(err, service.ErrInvalidToken) {
				log.Printf("service.AuthenticateToken: %v", err)
			}
			return
		}
		c.Set(CtxKeyUserID, claims.UserID)

		c.Next()
	}
}
