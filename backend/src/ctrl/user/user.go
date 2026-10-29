package user

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"offer-hub/ctrl/middleware"
	"offer-hub/model"
	"offer-hub/service"
)

// GetUserInfo GET /api/v1/user_info/get_user_info 获取当前登录用户信息
func GetUserInfo(c *gin.Context) {
	// user_id 由 JWTAuth 验签后写入 context，不能从请求头读，否则客户端可以伪造
	userID := c.GetString(middleware.CtxKeyUserID)

	info, err := service.GetUserInfo(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, service.ErrInvalidToken) {
			c.JSON(http.StatusOK, gin.H{
				"code": 401,
				"msg":  "未登录或登录已过期",
				"data": nil,
			})
			return
		}
		log.Printf("service.GetUserInfo: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "服务器内部错误",
			"data": nil,
		})
		return
	}

	c.JSON(http.StatusOK, model.GetUserInfoResp{
		Code: 0,
		Msg:  "success",
		Data: *info,
	})
}
