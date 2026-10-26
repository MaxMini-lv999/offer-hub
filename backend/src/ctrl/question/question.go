package question

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"offer-hub/model"
	"offer-hub/service"
)

// GetAllQuestionList GET /api/v1/question/all/list 题库全量列表
func GetAllQuestionList(c *gin.Context) {
	// ① 读参数：把网址里的 ?job_name=xxx 填进 req
	var req model.GetAllQuestionListReq
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "参数错误", "data": nil})
		return
	}

	// ② 调 service
	list, err := service.GetAllQuestionList(c.Request.Context(), &req)
	if err != nil {
		log.Printf("service.GetAllQuestionList: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{ // 此处具体情况具体分析，所以不用http.StatusOK
			"code": 500,
			"msg":  "服务器内部错误",
			"data": nil,
		})
		return
	}

	// ③ 返回成功结果
	c.JSON(http.StatusOK, model.GetAllQuestionListResp{
		Code: 0,
		Msg:  "success",
		Data: list,
	})
}

// sortByWhitelist 允许的排序字段
var sortByWhitelist = map[string]bool{
	"order":           true, // 默认排序，文档里没列出，但我们要用它
	"create_time":     true,
	"view_count":      true,
	"thumbs_up_count": true,
	"dislike_count":   true,
}

// ListQuestions GET /api/v1/question/list 题目列表
func ListQuestions(c *gin.Context) {
	// ① 读参数
	var req model.ListQuestionReq
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "参数错误", "data": nil})
		return
	}

	// ② 补默认值
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 20
	}
	if req.PageSize > 100 {
		req.PageSize = 100
	}
	if req.SortBy == "" {
		req.SortBy = "order"
	}
	// ③ 校验
	if !sortByWhitelist[req.SortBy] {
		c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "参数错误", "data": nil})
		return
	}
	// SortOrder 既不是 "asc" 也不是 "desc" 时，同样返回参数错误
	if req.SortOrder == "" {
		req.SortOrder = "asc"
	}
	if req.SortOrder != "asc" && req.SortOrder != "desc" {
		c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "参数错误", "data": nil})
		return
	}
	// ④ 调 service
	// 照 GetAllQuestionList 的写法调用 service.ListQuestions，
	//         出错时打日志并返回 500，成功时返回 model.ListQuestionResp{Code: 0, Msg: "success", Data: ...}
	list, err := service.ListQuestions(c.Request.Context(), &req)
	if err != nil {
		log.Printf("service.ListQuestions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "ListQuestion error",
			"data": nil,
		})
		return
	}
	c.JSON(http.StatusOK, model.ListQuestionResp{
		Code: 0,
		Msg:  "success",
		Data: list,
	})
}
