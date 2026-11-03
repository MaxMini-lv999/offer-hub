package model

// LikeReq POST /api/v1/interaction/like 点赞请求，点赞者取自 context 里的 user_id
type LikeReq struct {
	TargetType int    `json:"target_type" binding:"required,oneof=1 3"` // 1题目 / 3评论（2面经本期无）
	TargetID   string `json:"target_id" binding:"required"`
}

// LikeData 点赞响应 data
type LikeData struct {
	Liked bool `json:"liked"` // 操作后的点赞状态
	Count int  `json:"count"` // 目标当前的总点赞数
}

// LikeResp POST /api/v1/interaction/like 点赞响应
type LikeResp struct {
	Code int      `json:"code"`
	Msg  string   `json:"msg"`
	Data LikeData `json:"data"`
}

// UnlikeReq POST /api/v1/interaction/unlike 取消点赞请求，参数与点赞相同
type UnlikeReq = LikeReq

// UnlikeData 取消点赞响应 data
type UnlikeData struct {
	Count int `json:"count"` // 取消点赞后目标的总点赞数
}

// UnlikeResp POST /api/v1/interaction/unlike 取消点赞响应
type UnlikeResp struct {
	Code int        `json:"code"`
	Msg  string     `json:"msg"`
	Data UnlikeData `json:"data"`
}

// TagQuestionReq POST /api/v1/safe/tag_question 标记掌握状态请求，标记者取自 context 里的 user_id。
// Tag 用指针：int 的 required 会把 0 当成没传，而 0（取消标记）是合法值
type TagQuestionReq struct {
	QuestionID string `json:"question_id" binding:"required"`
	Tag        *int   `json:"tag" binding:"required,oneof=0 1 2 3"` // 0未标记 / 1已掌握 / 2晚点再刷 / 3未掌握
}

// TagQuestionResp POST /api/v1/safe/tag_question 标记掌握状态响应，成功时 data 为 null
type TagQuestionResp struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data any    `json:"data"`
}
