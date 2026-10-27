package router

import (
	questionCtrl "offer-hub/ctrl/question"

	"github.com/gin-gonic/gin"
)

// RegisterRouter 注册所有路由。
func RegisterRouter(r *gin.Engine) {
	api := r.Group("/api")
	v1 := api.Group("/v1")

	question := v1.Group("/question")
	question.GET("/all/list", questionCtrl.GetAllQuestionList)
	question.GET("/list", questionCtrl.ListQuestions)
	question.GET("/meta/list", questionCtrl.ListQuestionsMeta)
	question.GET("/detail", questionCtrl.GetQuestionDetail)
}
