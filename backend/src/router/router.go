package router

import (
	authCtrl "offer-hub/ctrl/auth"
	commentCtrl "offer-hub/ctrl/comment"
	"offer-hub/ctrl/middleware"
	questionCtrl "offer-hub/ctrl/question"
	userCtrl "offer-hub/ctrl/user"

	"github.com/gin-gonic/gin"
)

// RegisterRouter 注册所有路由。
func RegisterRouter(r *gin.Engine) {
	api := r.Group("/api")
	v1 := api.Group("/v1")

	// 软鉴权：游客也能访问，登录用户额外带上 user_id
	question := v1.Group("/question", middleware.SoftJWTAuth())
	question.GET("/all/list", questionCtrl.GetAllQuestionList)
	question.GET("/list", questionCtrl.ListQuestions)
	question.GET("/meta/list", questionCtrl.ListQuestionsMeta)
	question.GET("/detail", questionCtrl.GetQuestionDetail)
	question.GET("/hot/list", questionCtrl.GetHotQuestions)

	// 开放接口：软鉴权，游客也能访问
	open := v1.Group("/open", middleware.SoftJWTAuth())
	open.GET("/list_comments", commentCtrl.ListComments)

	// 评论的增删改都要强制登录
	comment := v1.Group("/comment", middleware.JWTAuth())
	comment.POST("/add", commentCtrl.AddComment)
	comment.POST("/delete", commentCtrl.DeleteComment)

	userInfo := v1.Group("/user_info")
	userInfo.GET("/get_user_info", middleware.JWTAuth(), userCtrl.GetUserInfo)

	auth := r.Group("/auth")
	auth.POST("/register", authCtrl.Register)
	auth.POST("/login", authCtrl.Login)
	auth.POST("/logout", middleware.JWTAuth(), authCtrl.Logout)
}
