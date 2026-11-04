package data

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// QuestionStatusNormal 题目状态：正常
const QuestionStatusNormal = 1

// Question 对应 MongoDB question 集合
type Question struct {
	QuestionID      string    `bson:"question_id"`
	Title           string    `bson:"title"`
	Content         string    `bson:"content"`
	AnalysisContent string    `bson:"analysis_content"` // 题目解析，只返回给登录用户
	BankList        []string  `bson:"bank_list"`
	JobName         string    `bson:"job_name"`
	Difficulty      int       `bson:"difficulty"`
	Tags            []string  `bson:"tags"`
	Status          int       `bson:"status"`
	VIP             bool      `bson:"vip"`
	HotDegree       int       `bson:"hot_degree"`
	ViewCount       int       `bson:"view_count"`
	ThumbsUpCount   int       `bson:"thumbs_up_count"`
	DislikeCount    int       `bson:"dislike_count"`
	Order           int64     `bson:"order"`
	CreateTime      time.Time `bson:"create_time"`
	UpdateTime      time.Time `bson:"update_time"`
}

// QuestionFilter FilterQuestions 的查询条件，字段为零值表示不按该条件过滤
type QuestionFilter struct {
	BankID     string
	Keywords   []string // 每个词都要在标题或正文里出现；为空表示不按关键词过滤
	Difficulty int
	Tags       []string
	JobName    string
	SortBy     string // 排序字段，调用方保证已校验
	SortOrder  string // asc / desc
	Page       int
	PageSize   int
	MetaOnly   bool // true 时只取 question_id 和 title（meta/list 用）；默认 false，取全部字段
	// QuestionIDs 不为 nil 时只在这些题里查（登录用户按掌握状态筛选）；nil 表示不按 ID 过滤
	QuestionIDs []string
}

// QuestionBankSeries 对应 question_bank_series 集合
type QuestionBankSeries struct {
	SeriesID   string `bson:"series_id"`
	SeriesName string `bson:"series_name"`
	JobName    string `bson:"job_name"`
	Order      int64  `bson:"order"`
}

// QuestionBank 对应 question_bank 集合
type QuestionBank struct {
	BankID   string `bson:"bank_id"`
	SeriesID string `bson:"series_id"`
	BankName string `bson:"bank_name"`
	BankLogo string `bson:"bank_logo"`
	Desc     string `bson:"desc"`
	JobName  string `bson:"job_name"`
	Order    int64  `bson:"order"`
}

// ListQuestionBankSeries 查询题库系列
func ListQuestionBankSeries(ctx context.Context, jobName string) ([]QuestionBankSeries, error) {
	coll := GetData().MongoDB.Collection("question_bank_series") // 拿到集合

	filter := bson.M{} // 查询条件，空的就表示查全部
	if jobName != "" {
		filter["job_name"] = jobName // 传了 job_name 才加这个条件
	}
	opts := options.Find().SetSort(bson.D{{Key: "order", Value: 1}}) // 1 表示升序

	cur, err := coll.Find(ctx, filter, opts) // 执行查询，得到一个游标
	if err != nil {
		return nil, fmt.Errorf("find question_bank_series: %w", err)
	}
	var list []QuestionBankSeries
	if err := cur.All(ctx, &list); err != nil { // 把所有结果一次性读进 list
		return nil, fmt.Errorf("decode question_bank_series: %w", err)
	}
	return list, nil
}

// ListQuestionBank 查询题库
func ListQuestionBank(ctx context.Context, jobName string) ([]QuestionBank, error) {
	coll := GetData().MongoDB.Collection("question_bank")

	filter := bson.M{}
	if jobName != "" {
		filter["job_name"] = jobName
	}
	opts := options.Find().SetSort(bson.D{{Key: "order", Value: 1}})

	cur, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find question_bank: %w", err)
	}
	var list []QuestionBank
	if err := cur.All(ctx, &list); err != nil {
		return nil, fmt.Errorf("decode question_bank: %w", err)
	}

	return list, nil
}

// CountQuestionByBankIDs 聚合查询所有题库的题目数量
func CountQuestionByBankIDs(ctx context.Context, bankIDs []string) (map[string]int, error) {
	counts := make(map[string]int)
	if len(bankIDs) == 0 {
		return counts, nil // 没有题库就不用查了
	}

	coll := GetData().MongoDB.Collection("question")
	inBanks := bson.M{"$in": bankIDs}
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"status": QuestionStatusNormal, "bank_list": inBanks}}},
		{{Key: "$unwind", Value: "$bank_list"}},
		{{Key: "$match", Value: bson.M{"bank_list": inBanks}}},
		{{Key: "$group", Value: bson.M{"_id": "$bank_list", "count": bson.M{"$sum": 1}}}},
	}

	cur, err := coll.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("count question by bank: %w", err)
	}

	// 每一行结果长这样：{ "_id": "b001", "count": 2 }
	var rows []struct {
		BankID string `bson:"_id"`
		Count  int    `bson:"count"`
	}
	// TODO 1：模仿 2.2，用 cur.All 把结果读进 rows，别忘了处理 err
	if err = cur.All(ctx, &rows); err != nil {
		return nil, fmt.Errorf("decode count question by bank: %w", err)
	}

	// TODO 2：用 for range 遍历 rows，把每一行存进 counts，key 是 BankID，value 是 Count
	for _, row := range rows {
		counts[row.BankID] = row.Count
	}

	return counts, nil
}

// FilterQuestions 按条件分页查询题目，返回当前页列表和满足条件的总数
func FilterQuestions(ctx context.Context, f QuestionFilter) ([]Question, int64, error) {
	coll := GetData().MongoDB.Collection("question")

	// ① 拼过滤条件
	filter := bson.M{"status": QuestionStatusNormal} // 接口没有 status 参数，所以永远只查正常题目
	if f.BankID != "" {
		filter["bank_list"] = f.BankID // 数组字段直接写等值 = "数组里包含这个值"
	}
	if f.Difficulty != 0 {
		filter["difficulty"] = f.Difficulty
	}
	// JobName 不为空时，加 job_name 条件
	if f.JobName != "" {
		filter["job_name"] = f.JobName
	}
	// len(f.Tags) > 0 时，加 tags 条件，值写成 bson.M{"$all": f.Tags}
	if len(f.Tags) > 0 {
		filter["tags"] = bson.M{"$all": f.Tags}
	}
	if f.QuestionIDs != nil {
		filter["question_id"] = bson.M{"$in": f.QuestionIDs}
	}
	if len(f.Keywords) > 0 {
		// 每个词各自是一个 "title 或 content 命中" 的 $or，再用 $and 要求所有词都命中。
		// bson.M 的 key 不能重复，多个 "$or" 直接放进 filter 会互相覆盖，所以要套一层 $and：
		// ["Redis", "持久化"] → {$and: [{$or: [title~Redis, content~Redis]}, {$or: [title~持久化, content~持久化]}]}
		and := make(bson.A, 0, len(f.Keywords))
		for _, kw := range f.Keywords {
			re := bson.M{"$regex": regexp.QuoteMeta(kw), "$options": "i"} // QuoteMeta：关键词里的 . * 等按普通字符匹配
			and = append(and, bson.M{"$or": bson.A{bson.M{"title": re}, bson.M{"content": re}}})
		}
		filter["$and"] = and
	}

	// ② 先查总数（分页之前的总数，前端用它算一共多少页）
	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("count question: %w", err)
	}

	// ③ 这一页的起点已经超过总数（包括 total 为 0）时，后面肯定没有数据，不用再查一次。
	// 调用方保证 page 已限制在上限内，这里的乘法不会溢出
	skip := int64((f.Page - 1) * f.PageSize)
	if skip >= total {
		return nil, total, nil
	}

	// ④ 排序 + 分页
	dir := 1 // 1 升序
	if f.SortOrder == "desc" {
		dir = -1 // -1 降序
	}
	opts := options.Find().
		// _id 兜底让分页稳定；方向跟主排序一致，倒序时 MongoDB 能直接倒着扫索引，不用在内存里排
		SetSort(bson.D{{Key: f.SortBy, Value: dir}, {Key: "_id", Value: dir}}).
		SetSkip(skip).
		SetLimit(int64(f.PageSize))

	if f.MetaOnly {
		opts.SetProjection(bson.M{
			"question_id": 1,
			"title":       1,
			"_id":         0,
		})
	}

	cur, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, fmt.Errorf("find FilterQuestions question: %w", err)
	}
	var list []Question
	if err := cur.All(ctx, &list); err != nil {
		return nil, 0, fmt.Errorf("decode FilterQuestions : %w", err)
	}
	return list, total, nil
}

// ErrQuestionNotFound 题目不存在（包括已隐藏、已删除的题）
var ErrQuestionNotFound = errors.New("question not found")

// GetQuestionByID 按 question_id 查询一道正常状态的题目，查不到时返回 ErrQuestionNotFound
func GetQuestionByID(ctx context.Context, questionID string) (*Question, error) {
	coll := GetData().MongoDB.Collection("question")
	filter := bson.M{"question_id": questionID, "status": QuestionStatusNormal}

	var detail Question
	if err := coll.FindOne(ctx, filter).Decode(&detail); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrQuestionNotFound
		}
		return nil, fmt.Errorf("find question %s GetQuestionByID: %w", questionID, err)
	}
	return &detail, nil
}

// ListHotQuestions 按 hot_degree 降序查询前 limit 道正常状态的题目，jobName 为空时不按职位过滤，
// 只取 question_id / bank_list / title / view_count。调用方保证 limit > 0（MongoDB 里 limit 为 0 表示不限制）
func ListHotQuestions(ctx context.Context, jobName string, limit int64) ([]Question, error) {
	coll := GetData().MongoDB.Collection("question")
	filter := bson.M{"status": QuestionStatusNormal}
	if jobName != "" {
		filter["job_name"] = jobName
	}
	opts := options.Find().
		SetSort(bson.D{{Key: "hot_degree", Value: -1}, {Key: "_id", Value: 1}}).
		SetLimit(limit).
		SetProjection(bson.M{
			"question_id": 1,
			"bank_list":   1,
			"title":       1,
			"view_count":  1,
			"_id":         0,
		})

	cur, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return []Question{}, fmt.Errorf("find ListHotQuestions %s热门题目查询error: %w", jobName, err)
	}

	var list []Question
	if err := cur.All(ctx, &list); err != nil {
		return []Question{}, fmt.Errorf("decode ListHotQuestions: %w", err)
	}
	return list, nil
}

// ListQuestionIDs 查询全部正常状态题目的 question_id，随机题目列表在 service 里排序
func ListQuestionIDs(ctx context.Context) ([]string, error) {
	coll := GetData().MongoDB.Collection("question")
	filter := bson.M{"status": QuestionStatusNormal}
	opts := options.Find().SetProjection(bson.M{"question_id": 1, "_id": 0})

	cur, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find ListQuestionIDs: %w", err)
	}
	var list []Question
	if err := cur.All(ctx, &list); err != nil {
		return nil, fmt.Errorf("decode ListQuestionIDs: %w", err)
	}

	ids := make([]string, 0, len(list))
	for _, q := range list {
		ids = append(ids, q.QuestionID)
	}
	return ids, nil
}

// ListQuestionMetaByIDs 按 question_id 批量查询正常状态题目的 ID 和标题。
// 返回顺序和 ids 无关，查不到的（已隐藏、已删除）直接没有，调用方自己按需要的顺序排
func ListQuestionMetaByIDs(ctx context.Context, ids []string) ([]Question, error) {
	coll := GetData().MongoDB.Collection("question")
	filter := bson.M{"question_id": bson.M{"$in": ids}, "status": QuestionStatusNormal}
	opts := options.Find().SetProjection(bson.M{"question_id": 1, "title": 1, "_id": 0})

	cur, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find ListQuestionMetaByIDs: %w", err)
	}
	var list []Question
	if err := cur.All(ctx, &list); err != nil {
		return nil, fmt.Errorf("decode ListQuestionMetaByIDs: %w", err)
	}
	return list, nil
}

// QuestionTagCount 标签统计的一行：标签和带这个标签的题目数
type QuestionTagCount struct {
	Tag   string `bson:"_id"`
	Count int    `bson:"count"`
}

// ListQuestionTags 统计正常状态题目的标签，按题目数从多到少排，一样多的按标签名排。
// bankID 为空时统计全部题目
func ListQuestionTags(ctx context.Context, bankID string) ([]QuestionTagCount, error) {
	coll := GetData().MongoDB.Collection("question")
	match := bson.M{"status": QuestionStatusNormal}
	if bankID != "" {
		match["bank_list"] = bankID
	}
	// 一道题有几个标签，$unwind 就拆成几行，再按标签分组计数：
	// {tags: ["Redis", "缓存"]} → {tags: "Redis"}、{tags: "缓存"} → {_id: "Redis", count: 3}
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: match}},
		{{Key: "$unwind", Value: "$tags"}},
		{{Key: "$group", Value: bson.M{"_id": "$tags", "count": bson.M{"$sum": 1}}}},
		{{Key: "$sort", Value: bson.D{{Key: "count", Value: -1}, {Key: "_id", Value: 1}}}},
	}

	cur, err := coll.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("aggregate ListQuestionTags: %w", err)
	}
	var rows []QuestionTagCount
	if err := cur.All(ctx, &rows); err != nil {
		return nil, fmt.Errorf("decode ListQuestionTags: %w", err)
	}
	return rows, nil
}

// IncQuestionThumbsUp 把题目的 thumbs_up_count 加 delta（点赞传 1，取消点赞传 -1），返回改完后的点赞数。
// 用 $inc 原子自增，并发点赞不会丢计数；减的时候条件要求当前值够减，不会减成负数。
// 匹配不到（够不上减，或题目已被物理删除）时什么都不改，返回 0
func IncQuestionThumbsUp(ctx context.Context, questionID string, delta int) (int, error) {
	coll := GetData().MongoDB.Collection("question")
	filter := bson.M{"question_id": questionID}
	if delta < 0 {
		filter["thumbs_up_count"] = bson.M{"$gte": -delta}
	}
	update := bson.M{"$inc": bson.M{"thumbs_up_count": delta}}
	opts := options.FindOneAndUpdate().
		SetReturnDocument(options.After). // 返回改之后的文档
		SetProjection(bson.M{"thumbs_up_count": 1, "_id": 0})

	var q Question
	if err := coll.FindOneAndUpdate(ctx, filter, update, opts).Decode(&q); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return 0, nil
		}
		return 0, fmt.Errorf("update question %s IncQuestionThumbsUp: %w", questionID, err)
	}
	return q.ThumbsUpCount, nil
}
