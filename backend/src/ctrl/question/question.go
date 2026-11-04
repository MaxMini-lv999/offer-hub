package question

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"

	"offer-hub/ctrl/middleware"
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
		c.JSON(http.StatusInternalServerError, gin.H{ // 规范：code 为 500 时 HTTP 状态码也是 500，其余情况都是 200
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

const (
	defaultPageSize = 20
	maxPageSize     = 100
	// maxListOffset 分页最多跳过多少条。skip 越大，MongoDB 要先数过去的文档越多，再往后翻直接返回参数错误
	maxListOffset = 10000
	// maxKeywordLen 关键词最多多少个字符（按字符算，不是按字节），每个词都是一次正则匹配
	maxKeywordLen = 50
)

// sortByDefaultOrder 允许的排序字段，以及没传 sort_order 时的默认方向：
// 默认排序 order 从小到大；时间和计数字段从大到小（最新、最多浏览排在前面）
var sortByDefaultOrder = map[string]string{
	"order":           "asc", // 默认排序，文档里没列出，但我们要用它
	"create_time":     "desc",
	"view_count":      "desc",
	"thumbs_up_count": "desc",
	"dislike_count":   "desc",
}

// normalizeListReq 给题目列表请求补默认值并校验，list 和 meta/list 共用。参数不合法时返回 false
func normalizeListReq(req *model.ListQuestionReq) bool {
	// ① 分页
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = defaultPageSize
	}
	if req.PageSize > maxPageSize {
		req.PageSize = maxPageSize
	}
	// 等价于 (page-1)*page_size > maxListOffset。用除法比：page 特别大时乘法会溢出成负数，反而通过检查
	if req.Page-1 > maxListOffset/req.PageSize {
		return false
	}

	// ② 排序
	if req.SortBy == "" {
		req.SortBy = "order"
	}
	defaultOrder, ok := sortByDefaultOrder[req.SortBy]
	if !ok {
		return false
	}
	if req.SortOrder == "" {
		req.SortOrder = defaultOrder
	}
	// SortOrder 既不是 "asc" 也不是 "desc" 时，同样返回参数错误
	if req.SortOrder != "asc" && req.SortOrder != "desc" {
		return false
	}

	// ③ 关键词：先去掉首尾空白再校验，拆词在 service 里做
	req.Keyword = strings.TrimSpace(req.Keyword)
	// MongoDB 的正则不接受非法 UTF-8 和 \x00，直接传下去会变成 500
	if !utf8.ValidString(req.Keyword) || strings.ContainsRune(req.Keyword, 0) {
		return false
	}
	if utf8.RuneCountInString(req.Keyword) > maxKeywordLen {
		return false
	}

	return true
}

// ListQuestions GET /api/v1/question/list 题目列表
func ListQuestions(c *gin.Context) {
	// ① 读参数
	var req model.ListQuestionReq
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "参数错误", "data": nil})
		return
	}

	// ② 补默认值 + 校验
	if !normalizeListReq(&req) {
		c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "参数错误", "data": nil})
		return
	}

	// ③ 调 service
	list, err := service.ListQuestions(c.Request.Context(), &req)
	if err != nil {
		log.Printf("service.ListQuestions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "服务器内部错误",
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

// ListQuestionsMeta GET /api/v1/question/meta/list 题目元数据列表
func ListQuestionsMeta(c *gin.Context) {
	// ① 读参数
	var req model.ListQuestionMetaReq
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "参数错误", "data": nil})
		return
	}

	// ② 补默认值 + 校验
	if !normalizeListReq(&req) {
		c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "参数错误", "data": nil})
		return
	}

	// ③ 调 service
	list, err := service.ListQuestionsMeta(c.Request.Context(), &req)
	if err != nil {
		log.Printf("service.ListQuestionsMeta: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "服务器内部错误",
			"data": nil,
		})
		return
	}
	c.JSON(http.StatusOK, model.ListQuestionMetaResp{
		Code: 0,
		Msg:  "success",
		Data: list,
	})
}

// GetQuestionDetail GET /api/v1/question/detail 题目详情
func GetQuestionDetail(c *gin.Context) {
	var req model.GetQuestionDetailReq
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code": 400,
			"msg":  "参数错误",
			"data": nil,
		})
		return
	}

	// user_id 由 SoftJWTAuth 写入 context，空串表示游客；不能从请求头读，否则客户端可以伪造
	userID := c.GetString(middleware.CtxKeyUserID)

	detail, err := service.GetQuestionDetail(c.Request.Context(), &req, userID)
	if err != nil {
		if errors.Is(err, service.ErrQuestionNotFound) {
			c.JSON(http.StatusOK, gin.H{
				"code": 400,
				"msg":  "题目不存在",
				"data": nil,
			})
			return
		}
		log.Printf("service.GetQuestionDetail: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "服务器内部错误",
			"data": nil,
		})
		return
	}

	c.JSON(http.StatusOK, model.GetQuestionDetailResp{
		Code: 0,
		Msg:  "success",
		Data: detail,
	})
}

// GetHotQuestions GET /api/v1/question/hot/list 热门题目列表
func GetHotQuestions(c *gin.Context) {
	var req model.GetHotQuestionListReq
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code": 400,
			"msg":  "参数错误",
			"data": nil,
		})
		return
	}

	// 补默认值；上限 50，防止公开接口一次拉走全部题目
	if req.Limit <= 0 {
		req.Limit = 10
	}
	if req.Limit > 50 {
		req.Limit = 50
	}

	list, err := service.GetHotQuestions(c.Request.Context(), &req)
	if err != nil {
		log.Printf("service.GetHotQuestions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "服务器内部错误",
			"data": nil,
		})
		return
	}
	c.JSON(http.StatusOK, model.GetHotQuestionListResp{
		Code: 0,
		Msg:  "success",
		Data: list,
	})
}
