package model

// ListCommentsReq GET /api/v1/open/list_comments 评论列表请求
type ListCommentsReq struct {
	TargetType     int    `json:"target_type" form:"target_type" binding:"required,oneof=1 2"` // 1题目 / 2面经
	TargetID       string `json:"target_id" form:"target_id" binding:"required"`
	ParentID       string `json:"parent_id" form:"parent_id"`               // 为空查顶层评论，不为空查该评论下的子评论
	SortBy         string `json:"sort_by" form:"sort_by"`                   // create_time / view_count / thumbs_up
	SortOrder      string `json:"sort_order" form:"sort_order"`             // asc / desc
	Page           int    `json:"page" form:"page"`                         // 默认 1
	PageSize       int    `json:"page_size" form:"page_size"`               // 默认 20
	SubCommentPage int    `json:"sub_comment_page" form:"sub_comment_page"` // 默认 1
	SubCommentSize int    `json:"sub_comment_size" form:"sub_comment_size"` // 默认 5
}

// CommentItem 单条评论，评论列表和发表评论的响应共用
type CommentItem struct {
	CommentID       string        `json:"comment_id"`
	UserID          string        `json:"user_id"`
	UserName        string        `json:"user_name"`
	UserAvatar      string        `json:"user_avatar"`
	Content         string        `json:"content"`
	ParentID        string        `json:"parent_id"`     // 顶层评论为空
	ReplyTo         string        `json:"reply_to"`      // 被回复的用户 ID，顶层评论为空
	ReplyToName     string        `json:"reply_to_name"` // 被回复的用户名，顶层评论为空
	Status          int           `json:"status"`        // 1审核中 / 2正常 / 3拒绝 / 4隐藏 / 5删除
	ThumbsUp        int           `json:"thumbs_up"`
	SubCommentTotal int           `json:"sub_comment_total"`
	UserLiked       bool          `json:"user_liked"`   // 游客为 false
	SubComments     []CommentItem `json:"sub_comments"` // 只有顶层评论列表会填；其余情况也输出 []，不输出 null
	CreateTime      string        `json:"create_time"`
	UpdateTime      string        `json:"update_time"`
}

// ListCommentsData 评论列表响应 data
type ListCommentsData struct {
	Total int64         `json:"total"`
	List  []CommentItem `json:"list"`
}

// ListCommentsResp GET /api/v1/open/list_comments 评论列表响应
type ListCommentsResp struct {
	Code int              `json:"code"`
	Msg  string           `json:"msg"`
	Data ListCommentsData `json:"data"`
}

// AddCommentReq POST /api/v1/comment/add 发表评论请求，评论者取自 context 里的 user_id
type AddCommentReq struct {
	TargetType int    `json:"target_type" binding:"required,oneof=1"` // 1题目（2面经本期没有，传 2 返回参数错误）
	TargetID   string `json:"target_id" binding:"required"`
	ParentID   string `json:"parent_id"`                           // 顶层评论为空
	ReplyTo    string `json:"reply_to"`                            // 被回复的用户 ID，顶层评论为空
	Content    string `json:"content" binding:"required,max=1000"` // 最长 1000 字，按字符数算
}

// AddCommentData 发表评论响应 data
type AddCommentData struct {
	CommentID string      `json:"comment_id"`
	Comment   CommentItem `json:"comment"`
}

// AddCommentResp POST /api/v1/comment/add 发表评论响应
type AddCommentResp struct {
	Code int            `json:"code"`
	Msg  string         `json:"msg"`
	Data AddCommentData `json:"data"`
}

// DeleteCommentReq POST /api/v1/comment/delete 删除评论请求
type DeleteCommentReq struct {
	CommentID string `json:"comment_id" binding:"required"`
}

// DeleteCommentResp POST /api/v1/comment/delete 删除评论响应，没有 data
type DeleteCommentResp struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
}

// UpdateCommentReq POST /api/v1/comment/update 修改评论请求
type UpdateCommentReq struct {
	CommentID string `json:"comment_id" binding:"required"`
	Content   string `json:"content" binding:"required,max=1000"` // 与发表评论相同，最长 1000 字
}

// UpdateCommentData 修改评论响应 data
type UpdateCommentData struct {
	CommentID string `json:"comment_id"`
}

// UpdateCommentResp POST /api/v1/comment/update 修改评论响应
type UpdateCommentResp struct {
	Code int               `json:"code"`
	Msg  string            `json:"msg"`
	Data UpdateCommentData `json:"data"`
}

// GetLikedCollectedCountData GET /api/v1/comment/user/liked_collected_count 响应 data
type GetLikedCollectedCountData struct {
	LikedCount     int64 `json:"liked_count"`     // 当前用户所有评论被点赞的总数
	CollectedCount int64 `json:"collected_count"` // 项目不支持收藏，始终为 0
}

// GetLikedCollectedCountResp GET /api/v1/comment/user/liked_collected_count 获取被点赞数响应
type GetLikedCollectedCountResp struct {
	Code int                        `json:"code"`
	Msg  string                     `json:"msg"`
	Data GetLikedCollectedCountData `json:"data"`
}
