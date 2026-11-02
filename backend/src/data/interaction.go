package data

import (
	"context"
	"fmt"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// user_interactions 集合的枚举值，见 状态与枚举.md
const (
	InteractionTargetQuestion = 1 // target_type：题目
	InteractionTypeLike       = 1 // interaction_type：点赞
	InteractionStatusValid    = 1 // status：有效（0 为已取消）
)

// IsQuestionLiked 查询用户当前是否点赞了某道题，取消过的点赞（status=0）不算
func IsQuestionLiked(ctx context.Context, userID, questionID string) (bool, error) {
	coll := GetData().MongoDB.Collection("user_interactions")
	filter := bson.M{
		"user_id":          userID,
		"target_type":      InteractionTargetQuestion,
		"target_id":        questionID,
		"interaction_type": InteractionTypeLike,
		"status":           InteractionStatusValid,
	}
	// 只关心有没有，数到 1 条就停
	n, err := coll.CountDocuments(ctx, filter, options.Count().SetLimit(1))
	if err != nil {
		return false, fmt.Errorf("count IsQuestionLiked: %w", err)
	}
	return n > 0, nil
}

// target_type：评论
const InteractionTargetComment = 3

func GetLikedTargetIDs(ctx context.Context, userID string, targetType int, targetIDs []string) (map[string]bool, error) {
	if len(targetIDs) == 0 {
		return map[string]bool{}, nil
	}

	coll := GetData().MongoDB.Collection("user_interactions")
	filter := bson.M{
		"user_id":          userID,
		"target_type":      targetType,
		"target_id":        bson.M{"$in": targetIDs},
		"interaction_type": InteractionTypeLike,
		"status":           InteractionStatusValid,
	}

	opts := options.Find().SetProjection(bson.M{"target_id": 1, "_id": 0})

	var ts []struct {
		TargetID string `bson:"target_id"`
	}

	cur, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return map[string]bool{}, fmt.Errorf("find GetLikedTargetIDs:%w", err)
	}

	if err := cur.All(ctx, &ts); err != nil {
		return map[string]bool{}, fmt.Errorf("decode GetLikedTargetIDs:%w", err)
	}

	m := make(map[string]bool, 0)
	for _, t := range ts {
		m[t.TargetID] = true
	}

	return m, nil
}
