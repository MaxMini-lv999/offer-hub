package data

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// user_interactions 集合的枚举值，见 状态与枚举.md
const (
	InteractionTargetQuestion = 1 // target_type：题目
	InteractionTargetComment  = 3 // target_type：评论
	InteractionTypeLike       = 1 // interaction_type：点赞
	InteractionStatusValid    = 1 // status：有效
	InteractionStatusCanceled = 0 // status：已取消
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

// UpsertLike 把用户对目标的点赞记录置为有效，没有记录时新建一条，返回这次是否真的从"未点赞"变成了"已点赞"。
// 用 FindOneAndUpdate 一步完成"改状态 + 拿到改之前的状态"：改之前没有记录或 status=0 才算变了，
// 已经是 1 的重复点赞返回 false，调用方据此决定要不要给目标点赞数 +1。
// 两个请求同时第一次点赞时，user_interactions 上的唯一索引保证只插入一条（见 EnsureMongoIndexes），
// 后到的那次由 MongoDB 自动重试成更新，拿到的改之前状态是 1，返回 false
func UpsertLike(ctx context.Context, userID string, targetType int, targetID string) (bool, error) {
	coll := GetData().MongoDB.Collection("user_interactions")
	filter := bson.M{
		"user_id":          userID,
		"target_type":      targetType,
		"target_id":        targetID,
		"interaction_type": InteractionTypeLike,
	}
	now := time.Now()
	update := bson.M{
		"$set":         bson.M{"status": InteractionStatusValid, "update_time": now},
		"$setOnInsert": bson.M{"create_time": now}, // 只在新建时写；filter 里的 4 个字段新建时会自动带上
	}
	opts := options.FindOneAndUpdate().
		SetUpsert(true).
		SetReturnDocument(options.Before). // 返回改之前的文档
		SetProjection(bson.M{"status": 1, "_id": 0})

	var before struct {
		Status int `bson:"status"`
	}
	if err := coll.FindOneAndUpdate(ctx, filter, update, opts).Decode(&before); err != nil {
		// 改之前没有文档，说明这次是新建的：第一次点赞
		if errors.Is(err, mongo.ErrNoDocuments) {
			return true, nil
		}
		return false, fmt.Errorf("upsert like %d:%s UpsertLike: %w", targetType, targetID, err)
	}
	return before.Status != InteractionStatusValid, nil
}

// CancelLike 把用户对目标的有效点赞置为已取消，返回这次是否真的从"已点赞"变成了"未点赞"。
// 条件带上 status=1：没点过赞或已经取消过时匹配不到，返回 false，不会新建记录；
// 两个请求同时取消，只有先到的那次能改成功
func CancelLike(ctx context.Context, userID string, targetType int, targetID string) (bool, error) {
	coll := GetData().MongoDB.Collection("user_interactions")
	filter := bson.M{
		"user_id":          userID,
		"target_type":      targetType,
		"target_id":        targetID,
		"interaction_type": InteractionTypeLike,
		"status":           InteractionStatusValid,
	}
	update := bson.M{"$set": bson.M{"status": InteractionStatusCanceled, "update_time": time.Now()}}
	res, err := coll.UpdateOne(ctx, filter, update)
	if err != nil {
		return false, fmt.Errorf("update like %d:%s CancelLike: %w", targetType, targetID, err)
	}
	return res.ModifiedCount > 0, nil
}
