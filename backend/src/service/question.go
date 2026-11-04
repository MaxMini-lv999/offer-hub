package service

import (
	"cmp"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"math/rand/v2"
	"slices"
	"strconv"
	"strings"
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
		Keywords:   strings.Fields(req.Keyword), // 按空白（含全角空格）拆成多个词，全是空格时为空，不过滤
		Difficulty: req.Difficulty,
		Tags:       req.Tags,
		JobName:    req.JobName,
		SortBy:     req.SortBy,    // 排序字段，调用方保证已校验
		SortOrder:  req.SortOrder, // asc / desc
		Page:       req.Page,
		PageSize:   req.PageSize,
	}
}

// buildUserQuestionFilter 在 buildQuestionFilter 的基础上加掌握状态筛选，list 和 meta/list 共用。
// 登录用户传了 user_tag 时，先查出他标成这种状态的题，把查询限定在这些题里；游客传了也忽略（接口文档要求）。
// 第二个返回值为 true 表示这个用户没有标成这种状态的题，结果一定为空，调用方直接返回空列表，不用再查题目
func buildUserQuestionFilter(ctx context.Context, req *model.ListQuestionReq, userID string) (data.QuestionFilter, bool, error) {
	filter := buildQuestionFilter(req)
	if userID == "" || req.UserTag == 0 {
		return filter, false, nil
	}

	ids, err := data.ListQuestionIDsByUserTag(ctx, userID, req.UserTag)
	if err != nil {
		return filter, false, fmt.Errorf("list tagged buildUserQuestionFilter: %w", err)
	}
	if len(ids) == 0 {
		return filter, true, nil
	}
	filter.QuestionIDs = ids
	return filter, false, nil
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

// ListQuestions 分页查询题目列表，userID 为空表示游客。
// 登录用户可以按掌握状态筛选；返回的题目内容目前都按游客处理（content 截断，user_tag / user_liked 为零值）
func ListQuestions(ctx context.Context, req *model.ListQuestionReq, userID string) (model.ListQuestionData, error) {
	// ① 把请求参数转成 data 层的查询条件，查出当前页和总数
	filter, empty, err := buildUserQuestionFilter(ctx, req, userID)
	if err != nil {
		return model.ListQuestionData{}, err
	}
	if empty {
		return model.ListQuestionData{Total: 0, List: make([]model.OneQuestion, 0)}, nil
	}
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

// ListQuestionsMeta 分页查询题目元数据（只有 ID 和标题），过滤和排序与 ListQuestions 完全一致，userID 为空表示游客。
func ListQuestionsMeta(ctx context.Context, req *model.ListQuestionMetaReq, userID string) (model.ListQuestionMetaData, error) {
	// ① 和 ListQuestions 走同一套过滤条件和查询
	filter, empty, err := buildUserQuestionFilter(ctx, req, userID)
	if err != nil {
		return model.ListQuestionMetaData{}, err
	}
	if empty {
		return model.ListQuestionMetaData{Total: 0, List: make([]model.QuestionMeta, 0)}, nil
	}
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

// GetQuestionDetail 查询题目详情，userID 为空表示游客。
// 游客：content 截断到前 150 字，analysis_content 为空，user_tag / user_liked 为零值；
// 登录用户：返回完整 content 和 analysis_content，并查出自己的点赞和掌握状态
func GetQuestionDetail(ctx context.Context, req *model.GetQuestionDetailReq, userID string) (model.QuestionDetail, error) {
	q, err := data.GetQuestionByID(ctx, req.QuestionID)
	if err != nil {
		if errors.Is(err, data.ErrQuestionNotFound) {
			return model.QuestionDetail{}, ErrQuestionNotFound
		}
		return model.QuestionDetail{}, err
	}
	detail := model.QuestionDetail{OneQuestion: toOneQuestion(q)}

	// ① 游客：截断 content，其余保持零值
	if userID == "" {
		detail.Content = truncate(detail.Content, guestContentLimit)
		return detail, nil
	}

	// ② 登录用户：补上解析，再查点赞和掌握状态
	detail.AnalysisContent = q.AnalysisContent
	liked, err := data.IsQuestionLiked(ctx, userID, q.QuestionID)
	if err != nil {
		return model.QuestionDetail{}, fmt.Errorf("check liked GetQuestionDetail: %w", err)
	}
	tag, err := data.GetUserQuestionTag(ctx, userID, q.QuestionID)
	if err != nil {
		return model.QuestionDetail{}, fmt.Errorf("get tag GetQuestionDetail: %w", err)
	}
	detail.UserLiked = liked
	detail.UserTag = tag

	return detail, nil
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

// maxRandomSeed 服务端生成的随机种子不超过 2^53：前端 JavaScript 的整数超过这个值会丢精度，带回来就不是同一个种子了
const maxRandomSeed = 1 << 53

// shuffleKey 题目在某个种子下的排序键：种子和 question_id 拼起来算 SHA-256，取前 8 字节当随机数。
// 同一个种子、同一道题永远算出同一个值，所以顺序固定，翻页不重不漏；
// 新增或下线一道题只是在顺序里插进或抽掉它，其他题的先后不变（整体洗牌的话所有题都会换位置）
func shuffleKey(seed int64, questionID string) uint64 {
	sum := sha256.Sum256([]byte(strconv.FormatInt(seed, 10) + ":" + questionID))
	return binary.BigEndian.Uint64(sum[:8])
}

// ListRandomQuestions 按种子打乱全部正常题目后分页，只返回 ID 和标题，沉浸式刷题的推荐模式用。
// 没传种子（≤ 0）时生成一个，随响应返回，前端翻页时带上它
func ListRandomQuestions(ctx context.Context, req *model.ListRandomQuestionReq) (model.ListRandomQuestionData, error) {
	seed := req.Seed
	if seed <= 0 {
		seed = rand.Int64N(maxRandomSeed) + 1
	}

	// ① 取全部题目 ID，按排序键排好。排序键相同（概率可以忽略）时按 ID 排，保证顺序完全确定
	ids, err := data.ListQuestionIDs(ctx)
	if err != nil {
		return model.ListRandomQuestionData{}, fmt.Errorf("list ids ListRandomQuestions: %w", err)
	}
	keys := make(map[string]uint64, len(ids))
	for _, id := range ids {
		keys[id] = shuffleKey(seed, id)
	}
	slices.SortFunc(ids, func(a, b string) int {
		return cmp.Or(cmp.Compare(keys[a], keys[b]), strings.Compare(a, b))
	})

	// ② 切出这一页。调用方保证 page 已限制在上限内，这里的乘法不会溢出
	result := model.ListRandomQuestionData{
		Seed:  seed,
		Total: int64(len(ids)),
		List:  make([]model.QuestionMeta, 0, req.PageSize), // 用 make：没数据时返回 [] 而不是 null
	}
	start := (req.Page - 1) * req.PageSize
	if start >= len(ids) {
		return result, nil
	}
	pageIDs := ids[start:min(start+req.PageSize, len(ids))]

	// ③ 查这一页的标题，按打乱后的顺序放进结果
	list, err := data.ListQuestionMetaByIDs(ctx, pageIDs)
	if err != nil {
		return model.ListRandomQuestionData{}, fmt.Errorf("list meta ListRandomQuestions: %w", err)
	}
	titles := make(map[string]string, len(list))
	for _, q := range list {
		titles[q.QuestionID] = q.Title
	}
	for _, id := range pageIDs {
		title, ok := titles[id]
		if !ok { // 两次查询之间被隐藏或删除了
			continue
		}
		result.List = append(result.List, model.QuestionMeta{QuestionID: id, Title: title})
	}
	return result, nil
}

// ListQuestionTags 统计正常题目的标签和题目数，按题目数从多到少排；bank_id 不为空时只统计这个题库
func ListQuestionTags(ctx context.Context, req *model.ListQuestionTagReq) (model.ListQuestionTagData, error) {
	rows, err := data.ListQuestionTags(ctx, req.BankID)
	if err != nil {
		return model.ListQuestionTagData{}, fmt.Errorf("aggregate ListQuestionTags: %w", err)
	}

	result := make([]model.QuestionTagInfo, 0, len(rows)) // 用 make：没数据时返回 [] 而不是 null
	for _, row := range rows {
		result = append(result, model.QuestionTagInfo{Tag: row.Tag, Count: row.Count})
	}
	return model.ListQuestionTagData{List: result}, nil
}
