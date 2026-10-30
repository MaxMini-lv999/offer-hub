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
	Keyword    string
	Difficulty int
	Tags       []string
	JobName    string
	SortBy     string // 排序字段，调用方保证已校验
	SortOrder  string // asc / desc
	Page       int
	PageSize   int
	MetaOnly   bool // true 时只取 question_id 和 title（meta/list 用）；默认 false，取全部字段
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
	if f.Keyword != "" {
		re := bson.M{"$regex": regexp.QuoteMeta(f.Keyword), "$options": "i"}
		// title 或 content 任一匹配 re 就算命中，用 "$or"：
		filter["$or"] = bson.A{bson.M{"title": re}, bson.M{"content": re}}
	}

	// ② 先查总数（分页之前的总数，前端用它算一共多少页）
	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("count question: %w", err)
	}

	// ③ 排序 + 分页
	dir := 1 // 1 升序
	if f.SortOrder == "desc" {
		dir = -1 // -1 降序
	}
	opts := options.Find().
		SetSort(bson.D{{Key: f.SortBy, Value: dir}, {Key: "_id", Value: 1}}).
		SetSkip(int64((f.Page - 1) * f.PageSize)).
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
