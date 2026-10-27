package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"offer-hub/data"
	"offer-hub/model"
)

// guestContentLimit 游客可见的题目正文字数
const guestContentLimit = 150

// truncate 截取 s 的前 n 个字符（按字符算，不是按字节）
func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

// GetAllQuestionList 查询题库全量列表，按 职位方向 → 系列 → 题库 三级分组。
func GetAllQuestionList(ctx context.Context, req *model.GetAllQuestionListReq) ([]model.GetAllQuestionListData, error) {
	// ① 查系列和题库
	seriesList, err := data.ListQuestionBankSeries(ctx, req.JobName)
	if err != nil {
		return nil, err
	}
	// 调用 data.ListQuestionBank，结果存进 bankList
	bankList, err := data.ListQuestionBank(ctx, req.JobName)
	if err != nil {
		return nil, err
	}

	// ② 收集所有 bank_id，批量查题目数量
	bankIDs := make([]string, 0, len(bankList))
	for _, bank := range bankList {
		bankIDs = append(bankIDs, bank.BankID)
	}
	counts, err := data.CountQuestionByBankIDs(ctx, bankIDs)
	if err != nil {
		return nil, err
	}

	// ③ 第一轮：题库按 series_id 归类
	banksBySeries := make(map[string][]model.QuestionBankInfo)
	for _, bank := range bankList {
		info := model.QuestionBankInfo{
			BankID:   bank.BankID,
			Count:    counts[bank.BankID], // map 里没有这个 key 时会得到 0,正好符合需求
			BankName: bank.BankName,
			BankLogo: bank.BankLogo,
			Desc:     bank.Desc,
			Order:    bank.Order,
		}
		banksBySeries[bank.SeriesID] = append(banksBySeries[bank.SeriesID], info)
	}

	// ④ 第二轮：系列按 job_name 分组
	result := make([]model.GetAllQuestionListData, 0) // 用 make 而不是 var，没数据时返回 [] 而不是 null
	jobIndex := make(map[string]int)                  // 记录每个 job_name 放在 result 的第几个位置
	for _, series := range seriesList {
		banks := banksBySeries[series.SeriesID]
		if banks == nil {
			banks = make([]model.QuestionBankInfo, 0)
		}
		seriesInfo := model.QuestionSeriesInfo{
			SeriesID:   series.SeriesID,
			SeriesName: series.SeriesName,
			Order:      series.Order,
			BankList:   banks,
		}

		idx, ok := jobIndex[series.JobName]
		if !ok { // 第一次遇到这个职位：先在 result 末尾新建一个分组
			result = append(result, model.GetAllQuestionListData{
				JobName:    series.JobName,
				SeriesList: make([]model.QuestionSeriesInfo, 0),
			})
			idx = len(result) - 1
			jobIndex[series.JobName] = idx
		}
		result[idx].SeriesList = append(result[idx].SeriesList, seriesInfo)
	}
	return result, nil
}

// buildQuestionFilter 把题目列表请求转成 data 层的查询条件，list 和 meta/list 共用。
// req.UserTag 不往下传：游客传了这个参数也要忽略（接口文档要求）
func buildQuestionFilter(req *model.ListQuestionReq) data.QuestionFilter {
	return data.QuestionFilter{
		BankID:     req.BankID,
		Keyword:    req.Keyword,
		Difficulty: req.Difficulty,
		Tags:       req.Tags,
		JobName:    req.JobName,
		SortBy:     req.SortBy,    // 排序字段，调用方保证已校验
		SortOrder:  req.SortOrder, // asc / desc
		Page:       req.Page,
		PageSize:   req.PageSize,
	}
}

// toOneQuestion 把 data 层的题目转成响应里的 OneQuestion，list 和 detail 共用。
// 只做字段搬运和时间格式化；content 截断、UserTag / UserLiked 由调用方按登录状态处理
func toOneQuestion(q *data.Question) model.OneQuestion {
	return model.OneQuestion{
		QuestionID:    q.QuestionID,
		Title:         q.Title,
		Content:       q.Content,
		Vip:           q.VIP,
		BankList:      q.BankList,
		Difficulty:    q.Difficulty,
		Tags:          q.Tags,
		Status:        q.Status,
		HotDegree:     q.HotDegree,
		ViewCount:     q.ViewCount,
		ThumbsUpCount: q.ThumbsUpCount,
		DislikeCount:  q.DislikeCount,
		Order:         q.Order,
		CreateTime:    q.CreateTime.Local().Format(time.DateTime),
		UpdateTime:    q.UpdateTime.Local().Format(time.DateTime),
	}
}

// ListQuestions 分页查询题目列表。目前还没有登录，所有请求都按游客处理。
func ListQuestions(ctx context.Context, req *model.ListQuestionReq) (model.ListQuestionData, error) {
	// ① 把请求参数转成 data 层的查询条件，查出当前页和总数
	filter := buildQuestionFilter(req)
	list, total, err := data.FilterQuestions(ctx, filter)
	if err != nil {
		return model.ListQuestionData{}, err
	}

	// ② 逐条转换
	result := make([]model.OneQuestion, 0, len(list)) // 用 make：没数据时返回 [] 而不是 null
	for _, q := range list {
		oneQuestion := toOneQuestion(&q)
		oneQuestion.Content = truncate(oneQuestion.Content, guestContentLimit)
		// 游客：UserTag / UserLiked 保持零值
		result = append(result, oneQuestion)
	}

	return model.ListQuestionData{Total: total, List: result}, nil
}

// ListQuestionsMeta 分页查询题目元数据（只有 ID 和标题），过滤和排序与 ListQuestions 完全一致。
func ListQuestionsMeta(ctx context.Context, req *model.ListQuestionMetaReq) (model.ListQuestionMetaData, error) {
	// ① 和 ListQuestions 走同一套过滤条件和查询
	filter := buildQuestionFilter(req)
	filter.MetaOnly = true // 侧边栏只要 ID 和标题，不从库里取 content
	list, total, err := data.FilterQuestions(ctx, filter)
	if err != nil {
		return model.ListQuestionMetaData{}, err
	}

	// ② 逐条转换，只取 ID 和标题，没有 content 所以也不用截断
	questionMetaList := make([]model.QuestionMeta, 0, len(list)) // 用 make：没数据时返回 [] 而不是 null
	for _, q := range list {
		questionMetaList = append(questionMetaList, model.QuestionMeta{
			QuestionID: q.QuestionID,
			Title:      q.Title,
		})
	}

	return model.ListQuestionMetaData{Total: total, List: questionMetaList}, nil
}

// ErrQuestionNotFound 题目不存在，ctrl 据此返回"题目不存在"
var ErrQuestionNotFound = errors.New("question not found")

// GetQuestionDetail 查询题目详情。目前还没有登录，所有请求都按游客处理：
// user_tag / user_liked 返回零值；content 暂不截断，等鉴权模块完成后再加
func GetQuestionDetail(ctx context.Context, req *model.GetQuestionDetailReq) (model.OneQuestion, error) {
	detail, err := data.GetQuestionByID(ctx, req.QuestionID)
	if err != nil {
		if errors.Is(err, data.ErrQuestionNotFound) {
			return model.OneQuestion{}, ErrQuestionNotFound
		}
		return model.OneQuestion{}, err
	}
	question := toOneQuestion(detail)
	// 游客：UserTag / UserLiked 保持零值

	return question, nil
}

// GetHotQuestions 查询热门题目列表（按 hot_degree 降序），可按职位方向过滤
func GetHotQuestions(ctx context.Context, req *model.GetHotQuestionListReq) (model.GetHotQuestionListData, error) {
	questionList, err := data.ListHotQuestions(ctx, req.JobName, req.Limit)
	if err != nil {
		return model.GetHotQuestionListData{}, fmt.Errorf("find GetHotQuestions: %w", err)
	}

	result := make([]model.HotQuestionInfo, 0, len(questionList))
	for _, q := range questionList {
		result = append(result, model.HotQuestionInfo{
			QuestionID: q.QuestionID,
			BankList:   q.BankList,
			Title:      q.Title,
			ViewCount:  q.ViewCount,
		})
	}

	return model.GetHotQuestionListData{List: result}, nil
}
