package model

// ListQuestionReq GET /api/v1/question/list 题目列表请求
type ListQuestionReq struct {
	BankID     string   `json:"bank_id" form:"bank_id"`
	Keyword    string   `json:"keyword" form:"keyword"`
	Difficulty int      `json:"difficulty" form:"difficulty"` // 1简单 / 2中等 / 3困难
	Tags       []string `json:"tags" form:"tags"`
	JobName    string   `json:"job_name" form:"job_name"`
	UserTag    int      `json:"user_tag" form:"user_tag"`     // 1已掌握 / 2晚点再刷 / 3未掌握，仅登录用户有效
	SortBy     string   `json:"sort_by" form:"sort_by"`       // create_time / view_count / thumbs_up_count / dislike_count
	SortOrder  string   `json:"sort_order" form:"sort_order"` // asc / desc
	Page       int      `json:"page" form:"page"`             // 默认 1
	PageSize   int      `json:"page_size" form:"page_size"`   // 默认 20
}

// OneQuestion 单道题目信息
type OneQuestion struct {
	QuestionID    string   `json:"question_id"`
	BankList      []string `json:"bank_list"`
	Title         string   `json:"title"`
	Content       string   `json:"content"`
	Difficulty    int      `json:"difficulty"`
	Tags          []string `json:"tags"`
	Status        int      `json:"status"`
	Vip           bool     `json:"vip"`
	HotDegree     int      `json:"hot_degree"`
	ViewCount     int      `json:"view_count"`
	ThumbsUpCount int      `json:"thumbs_up_count"`
	DislikeCount  int      `json:"dislike_count"`
	Order         int64    `json:"order"`
	UserTag       int      `json:"user_tag"`
	UserLiked     bool     `json:"user_liked"`
	CreateTime    string   `json:"create_time"`
	UpdateTime    string   `json:"update_time"`
}

// ListQuestionData 题目列表响应 data
type ListQuestionData struct {
	Total int64         `json:"total"`
	List  []OneQuestion `json:"list"`
}

// ListQuestionResp GET /api/v1/question/list 题目列表响应
type ListQuestionResp struct {
	Code int              `json:"code"`
	Msg  string           `json:"msg"`
	Data ListQuestionData `json:"data"`
}

// ListQuestionMetaReq GET /api/v1/question/meta/list 题目元数据列表请求，参数与题目列表相同
type ListQuestionMetaReq = ListQuestionReq

// QuestionMeta 题目元数据，只有 ID 和标题，用于题目导航侧边栏
type QuestionMeta struct {
	QuestionID string `json:"question_id"`
	Title      string `json:"title"`
}

// ListQuestionMetaData 题目元数据列表响应 data
type ListQuestionMetaData struct {
	Total int64          `json:"total"`
	List  []QuestionMeta `json:"list"`
}

// ListQuestionMetaResp GET /api/v1/question/meta/list 题目元数据列表响应
type ListQuestionMetaResp struct {
	Code int                  `json:"code"`
	Msg  string               `json:"msg"`
	Data ListQuestionMetaData `json:"data"`
}

// GetQuestionDetailReq GET /api/v1/question/detail 题目详情请求
type GetQuestionDetailReq struct {
	QuestionID string `json:"question_id" form:"question_id" binding:"required"`
}

// GetQuestionDetailResp GET /api/v1/question/detail 题目详情响应
type GetQuestionDetailResp struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data OneQuestion `json:"data"`
}

// HotQuestionInfo 热门题目信息
type HotQuestionInfo struct {
	QuestionID string   `json:"question_id"`
	BankList   []string `json:"bank_list"`
	Title      string   `json:"title"`
	ViewCount  int      `json:"view_count"`
}

// GetHotQuestionListData 热门题目列表响应 data
type GetHotQuestionListData struct {
	List []HotQuestionInfo `json:"list"`
}

// GetHotQuestionListResp GET /api/v1/question/hot/list 热门题目列表响应
type GetHotQuestionListResp struct {
	Code int                    `json:"code"`
	Msg  string                 `json:"msg"`
	Data GetHotQuestionListData `json:"data"`
}

// QuestionBankInfo 题库信息
type QuestionBankInfo struct {
	BankID   string `json:"bank_id"`
	BankName string `json:"bank_name"`
	BankLogo string `json:"bank_logo"`
	Desc     string `json:"desc"`
	Count    int    `json:"count"` // 该题库下的题目数量
	Order    int64  `json:"order"`
}

// QuestionSeriesInfo 题库系列，包含若干题库
type QuestionSeriesInfo struct {
	SeriesID   string             `json:"series_id"`
	SeriesName string             `json:"series_name"`
	Order      int64              `json:"order"`
	BankList   []QuestionBankInfo `json:"bank_list"`
}

// GetAllQuestionListData GET /api/v1/question/all/list 题库全量列表响应 data 的元素，
// 按职位方向分组，响应 data 为 []GetAllQuestionListData
type GetAllQuestionListData struct {
	JobName    string               `json:"job_name"`
	SeriesList []QuestionSeriesInfo `json:"series_list"`
}

// GetAllQuestionListReq GET /api/v1/question/all/list 题库全量列表请求
type GetAllQuestionListReq struct {
	JobName string `json:"job_name" form:"job_name"`
}

// GetAllQuestionListResp GET /api/v1/question/all/list 题库全量列表响应
type GetAllQuestionListResp struct {
	Code int                      `json:"code"`
	Msg  string                   `json:"msg"`
	Data []GetAllQuestionListData `json:"data"`
}
