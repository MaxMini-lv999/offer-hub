package comment

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"offer-hub/ctrl/middleware"
	"offer-hub/model"
	"offer-hub/service"
)

// sortByWhitelist 评论列表允许的排序字段，值就是 comments 集合里的字段名
var sortByWhitelist = map[string]bool{
	"create_time": true,
	"view_count":  true,
	"thumbs_up":   true,
}

// normalizeListCommentsReq 给评论列表请求补默认值并校验，参数不合法时返回 false。
// 补完后 page / size 都 ≥ 1，service 里的 pageOf 依赖这一点
func normalizeListCommentsReq(req *model.ListCommentsReq) bool {
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 20
	}
	if req.PageSize > 100 {
		req.PageSize = 100
	}
	if req.SubCommentPage <= 0 {
		req.SubCommentPage = 1
	}
	if req.SubCommentSize <= 0 {
		req.SubCommentSize = 5
	}
	if req.SubCommentSize > 20 {
		req.SubCommentSize = 20
	}

	if req.SortBy == "" {
		req.SortBy = "create_time"
	}
	if !sortByWhitelist[req.SortBy] {
		return false
	}
	// 顶层评论默认最新的在前；子评论默认按时间正序，与嵌在顶层评论里的那一页顺序一致，"查看更多回复"能接着翻
	if req.SortOrder == "" {
		if req.ParentID == "" {
			req.SortOrder = "desc"
		} else {
			req.SortOrder = "asc"
		}
	}
	if req.SortOrder != "asc" && req.SortOrder != "desc" {
		return false
	}

	return true
}

// ListComments GET /api/v1/open/list_comments 评论列表
func ListComments(c *gin.Context) {
	// ① 读参数
	var req model.ListCommentsReq
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "参数错误", "data": nil})
		return
	}

	// ② 补默认值 + 校验
	if !normalizeListCommentsReq(&req) {
		c.JSON(http.StatusOK, gin.H{"code": 400, "msg": "参数错误", "data": nil})
		return
	}

	// ③ 调 service。user_id 由 SoftJWTAuth 写入 context，空串表示游客；不能从请求头读，否则客户端可以伪造
	userID := c.GetString(middleware.CtxKeyUserID)
	result, err := service.ListComments(c.Request.Context(), &req, userID)
	if err != nil {
		log.Printf("service.ListComments: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "服务器内部错误",
			"data": nil,
		})
		return
	}

	c.JSON(http.StatusOK, model.ListCommentsResp{
		Code: 0,
		Msg:  "success",
		Data: result,
	})
}
