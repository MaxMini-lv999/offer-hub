package auth

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"offer-hub/model"
	"offer-hub/service"
)

// bcrypt 只接受最多 72 字节的密码
const passwordMaxLength = 72

// Register POST /auth/register 注册
func Register(c *gin.Context) {
	var req model.PasswordRegisterReq
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Password) > passwordMaxLength {
		c.JSON(http.StatusOK, gin.H{
			"code": 400,
			"msg":  "用户名或密码不符合要求",
			"data": nil,
		})
		return
	}

	if err := service.Register(c.Request.Context(), &req); err != nil {
		if errors.Is(err, service.ErrUsernameExists) {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code": 500,
				"msg":  "用户名已存在",
				"data": nil,
			})
			return
		}
		log.Printf("service.Register:%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "服务器内部错误",
			"data": nil,
		})
		return

	}

	c.JSON(http.StatusOK, model.PasswordRegisterResp{
		Code: 0,
		Msg:  "注册成功",
		Data: nil,
	})

}

// Login POST /auth/login 登录
func Login(c *gin.Context) {
	var req model.PasswordLoginReq
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Password) > passwordMaxLength {
		c.JSON(http.StatusOK, gin.H{
			"code": 400,
			"msg":  "用户名或密码不符合要求",
			"data": nil,
		})
		return
	}

	data, err := service.Login(c.Request.Context(), &req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			c.JSON(http.StatusOK, gin.H{
				"code": 400,
				"msg":  "用户名或密码错误",
				"data": nil,
			})
			return
		}
		if errors.Is(err, service.ErrUserDisabled) {
			c.JSON(http.StatusOK, gin.H{
				"code": 403,
				"msg":  "账号已被禁用",
				"data": nil,
			})
			return
		}
		log.Printf("[ctrl] service.Login:%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "服务器内部错误",
			"data": nil,
		})
		return

	}

	c.JSON(http.StatusOK, model.PasswordLoginResp{
		Code: 0,
		Msg:  "登录成功",
		Data: *data,
	})

}
