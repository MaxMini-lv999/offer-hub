package service

import (
	"context"
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

// ListQuestions 分页查询题目列表。目前还没有登录，所有请求都按游客处理。
func ListQuestions(ctx context.Context, req *model.ListQuestionReq) (model.ListQuestionData, error) {
	// ① 把请求参数转成 data 层的查询条件
	//    req.UserTag 不往下传：游客传了这个参数也要忽略（接口文档要求）
	filter := data.QuestionFilter{
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

	// 调用 data.FilterQuestions(ctx, filter)，接收 list, total, err
	//         出错时返回 model.ListQuestionData{}, err
	list, total, err := data.FilterQuestions(ctx, filter)
	if err != nil {
		return model.ListQuestionData{}, err
	}

	// ② 逐条转换
	result := make([]model.OneQuestion, 0, len(list)) // 用 make：没数据时返回 [] 而不是 null
	for _, q := range list {
		result = append(result, model.OneQuestion{
			QuestionID:    q.QuestionID,
			Title:         q.Title,
			Content:       truncate(q.Content, guestContentLimit), // 游客截断
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
			UserTag:       0,     // 游客：零值
			UserLiked:     false, // 游客：零值
		})
	}

	// 返回 model.ListQuestionData{Total: ..., List: ...}, nil
	return model.ListQuestionData{Total: total, List: result}, nil
}
