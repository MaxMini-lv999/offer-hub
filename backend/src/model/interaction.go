package model

// LikeReq POST /api/v1/interaction/like 点赞请求，点赞者取自 context 里的 user_id
type LikeReq struct {
	TargetType int    `json:"target_type" binding:"required,oneof=1 2 3"` // 1题目 / 2面经 / 3评论
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
