package interaction

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"offer-hub/ctrl/middleware"
	"offer-hub/model"
	"offer-hub/service"
)

// Like POST /api/v1/interaction/like 点赞
func Like(c *gin.Context) {
	// ① 读参数：target_type 只能是 1 / 3，binding 已校验
	var req model.LikeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "参数错误", "data": nil})
		return
	}

	// ② 调 service。user_id 由 JWTAuth 写入 context；不能从请求头读，否则客户端可以冒充别人点赞
	userID := c.GetString(middleware.CtxKeyUserID)
	result, err := service.Like(c.Request.Context(), &req, userID)
	if err != nil {
		if errors.Is(err, service.ErrLikeTargetNotFound) {
			c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "点赞对象不存在", "data": nil})
			return
		}
		log.Printf("service.Like: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "服务器内部错误",
			"data": nil,
		})
		return
	}

	c.JSON(http.StatusOK, model.LikeResp{
		Code: 0,
		Msg:  "success",
		Data: result,
	})
}

// Unlike POST /api/v1/interaction/unlike 取消点赞
func Unlike(c *gin.Context) {
	// ① 读参数，同 Like
	var req model.UnlikeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "参数错误", "data": nil})
		return
	}

	// ② 调 service。user_id 由 JWTAuth 写入 context
	userID := c.GetString(middleware.CtxKeyUserID)
	result, err := service.Unlike(c.Request.Context(), &req, userID)
	if err != nil {
		if errors.Is(err, service.ErrLikeTargetNotFound) {
			c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "点赞对象不存在", "data": nil})
			return
		}
		log.Printf("service.Unlike: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "服务器内部错误",
			"data": nil,
		})
		return
	}

	c.JSON(http.StatusOK, model.UnlikeResp{
		Code: 0,
		Msg:  "success",
		Data: result,
	})
}

// TagQuestion POST /api/v1/safe/tag_question 标记题目掌握状态
func TagQuestion(c *gin.Context) {
	// ① 读参数：tag 必填且只能是 0~3，binding 已校验（tag 为 0 也算传了，见 TagQuestionReq）
	var req model.TagQuestionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "参数错误", "data": nil})
		return
	}

	// ② 调 service。user_id 由 JWTAuth 写入 context；不能从请求头读，否则客户端可以改别人的标记
	userID := c.GetString(middleware.CtxKeyUserID)
	if err := service.TagQuestion(c.Request.Context(), &req, userID); err != nil {
		if errors.Is(err, service.ErrQuestionNotFound) {
			c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "题目不存在", "data": nil})
			return
		}
		log.Printf("service.TagQuestion: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "服务器内部错误",
			"data": nil,
		})
		return
	}

	c.JSON(http.StatusOK, model.TagQuestionResp{
		Code: 0,
		Msg:  "success",
		Data: nil,
	})
}
