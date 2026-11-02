package data

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// CommentStatusNormal 评论状态：正常，见 状态与枚举.md
const CommentStatusNormal = 2

// Comment 对应 MongoDB 的 comments 集合。
type Comment struct {
	CommentID  string    `bson:"comment_id"`
	TargetType int       `bson:"target_type"`
	TargetID   string    `bson:"target_id"`
	UserID     string    `bson:"user_id"`
	QuestionID string    `bson:"question_id"`
	Content    string    `bson:"content"`
	ParentID   string    `bson:"parent_id"`
	ChildCount int       `bson:"child_count"`
	ReplyTo    string    `bson:"reply_to"`
	Status     int       `bson:"status"`
	ThumbsUp   int       `bson:"thumbs_up"`
	ViewCount  int       `bson:"view_count"`
	CreateTime time.Time `bson:"create_time"`
	UpdateTime time.Time `bson:"update_time"`
}

// CommentFilter 评论查询条件，调用方保证已校验。
type CommentFilter struct {
	TargetType int    // 评论对象类型：1 题目 / 2 面经
	TargetID   string // 评论对象 ID
	ParentID   string // 父评论 ID，空串表示查顶层评论
	SortBy     string // 排序字段：create_time / view_count / thumbs_up
	SortOrder  string // 排序方向：asc / desc
	Page       int    // 页码，从 1 开始
	PageSize   int    // 每页数量
}

// ListComments 按条件分页查询正常状态的评论，返回当前页列表和满足条件的总数。
// f.ParentID 为空查顶层评论，不为空查该评论下的子评论
func ListComments(ctx context.Context, f CommentFilter) ([]Comment, int64, error) {
	coll := GetData().MongoDB.Collection("comments")
	filter := bson.M{
		"target_type": f.TargetType,
		"target_id":   f.TargetID,
		"parent_id":   f.ParentID, // 空串也要作为条件：只查顶层评论，不能让子评论混进来
		"status":      CommentStatusNormal,
	}

	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("find total ListComments: %w", err)
	}

	dir := 1 // 1 升序
	if f.SortOrder == "desc" {
		dir = -1 // -1 降序
	}
	opts := options.Find().
		SetSort(bson.D{{Key: f.SortBy, Value: dir}, {Key: "_id", Value: 1}}).
		SetSkip((int64(f.Page) - 1) * int64(f.PageSize)).SetLimit(int64(f.PageSize))

	cur, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, fmt.Errorf("find comment ListComments: %w", err)
	}

	var list []Comment
	if err := cur.All(ctx, &list); err != nil {
		return nil, 0, fmt.Errorf("decode comment ListComments: %w", err)
	}

	return list, total, nil
}

// ListSubCommentsByParentIDs 批量查询多条评论下的全部正常子评论，按 create_time 升序。
// 不分页：调用方按 parent_id 分组后自己截取，并用每组条数作为子评论总数
func ListSubCommentsByParentIDs(ctx context.Context, parentIDs []string) ([]Comment, error) {
	if len(parentIDs) == 0 {
		return nil, nil // 没有父评论就不用查了
	}
	coll := GetData().MongoDB.Collection("comments")
	filter := bson.M{
		"parent_id": bson.M{
			"$in": parentIDs,
		},
		"status": CommentStatusNormal,
	}

	opts := options.Find().SetSort(bson.D{{Key: "create_time", Value: 1}, {Key: "_id", Value: 1}})

	cur, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find comment ListSubCommentsByParentIDs: %w", err)
	}

	var list []Comment
	if err := cur.All(ctx, &list); err != nil {
		return nil, fmt.Errorf("decode comment ListSubCommentsByParentIDs: %w", err)
	}

	return list, nil
}
