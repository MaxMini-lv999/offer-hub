package router

import (
	authCtrl "offer-hub/ctrl/auth"
	commentCtrl "offer-hub/ctrl/comment"
	interactionCtrl "offer-hub/ctrl/interaction"
	"offer-hub/ctrl/middleware"
	questionCtrl "offer-hub/ctrl/question"
	userCtrl "offer-hub/ctrl/user"

	"github.com/gin-gonic/gin"
)

// RegisterRouter 注册所有路由。
func RegisterRouter(r *gin.Engine) {
	api := r.Group("/api")
	v1 := api.Group("/v1")

	// 限流挂在鉴权后面，登录用户按 user_id 计数，游客按 IP 计数；每个路由只能挂一次，否则一个请求会算两次
	rateLimit := middleware.RateLimit()

	// 软鉴权：游客也能访问，登录用户额外带上 user_id
	question := v1.Group("/question", middleware.SoftJWTAuth(), rateLimit)
	question.GET("/all/list", questionCtrl.GetAllQuestionList)
	question.GET("/list", questionCtrl.ListQuestions)
	question.GET("/meta/list", questionCtrl.ListQuestionsMeta)
	question.GET("/detail", questionCtrl.GetQuestionDetail)
	question.GET("/hot/list", questionCtrl.GetHotQuestions)

	// 开放接口：软鉴权，游客也能访问
	open := v1.Group("/open", middleware.SoftJWTAuth(), rateLimit)
	open.GET("/list_comments", commentCtrl.ListComments)

	// 评论的增删改都要强制登录
	comment := v1.Group("/comment", middleware.JWTAuth(), rateLimit)
	comment.POST("/add", commentCtrl.AddComment)
	comment.POST("/delete", commentCtrl.DeleteComment)
	comment.POST("/update", commentCtrl.UpdateComment)

	// 点赞、取消点赞要强制登录
	interaction := v1.Group("/interaction", middleware.JWTAuth(), rateLimit)
	interaction.POST("/like", interactionCtrl.Like)
	interaction.POST("/unlike", interactionCtrl.Unlike)

	// 用户私有数据的写操作，强制登录
	safe := v1.Group("/safe", middleware.JWTAuth(), rateLimit)
	safe.POST("/tag_question", interactionCtrl.TagQuestion)

	userInfo := v1.Group("/user_info")
	userInfo.GET("/get_user_info", middleware.JWTAuth(), rateLimit, userCtrl.GetUserInfo)

	// 注册、登录没有 token，按 IP 限流；额外挂一层额度更小的 authRateLimit 防暴力破解密码，
	// 放在前面，被它拦下的请求不再占用全站限流的额度
	authRateLimit := middleware.AuthRateLimit()
	auth := r.Group("/auth")
	auth.POST("/register", authRateLimit, rateLimit, authCtrl.Register)
	auth.POST("/login", authRateLimit, rateLimit, authCtrl.Login)
	auth.POST("/logout", middleware.JWTAuth(), rateLimit, authCtrl.Logout)
}
