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

// UserQuestionTag 对应 user_question_tag 集合
type UserQuestionTag struct {
	UserID     string    `bson:"user_id"`
	QuestionID string    `bson:"question_id"`
	Tag        int       `bson:"tag"` // 0未标记 / 1已掌握 / 2晚点再刷 / 3未掌握
	CreateTime time.Time `bson:"create_time"`
	UpdateTime time.Time `bson:"update_time"`
}

// GetUserQuestionTag 查询用户对某道题的掌握状态，没标记过返回 0（未标记）
func GetUserQuestionTag(ctx context.Context, userID, questionID string) (int, error) {
	coll := GetData().MongoDB.Collection("user_question_tag")
	filter := bson.M{"user_id": userID, "question_id": questionID}
	opts := options.FindOne().SetProjection(bson.M{"tag": 1, "_id": 0})

	var t UserQuestionTag
	if err := coll.FindOne(ctx, filter, opts).Decode(&t); err != nil {
		// 没有记录是正常情况，不是错误
		if errors.Is(err, mongo.ErrNoDocuments) {
			return 0, nil
		}
		return 0, fmt.Errorf("find GetUserQuestionTag: %w", err)
	}
	return t.Tag, nil
}

// ListQuestionIDsByUserTag 查询用户标成某种掌握状态的全部 question_id，题目列表按掌握状态筛选用。
// 条件和返回字段都在 (user_id, tag, question_id) 索引里，只扫索引、不读文档
func ListQuestionIDsByUserTag(ctx context.Context, userID string, tag int) ([]string, error) {
	coll := GetData().MongoDB.Collection("user_question_tag")
	filter := bson.M{"user_id": userID, "tag": tag}
	opts := options.Find().SetProjection(bson.M{"question_id": 1, "_id": 0})

	cur, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find ListQuestionIDsByUserTag: %w", err)
	}
	var list []UserQuestionTag
	if err := cur.All(ctx, &list); err != nil {
		return nil, fmt.Errorf("decode ListQuestionIDsByUserTag: %w", err)
	}

	ids := make([]string, 0, len(list))
	for _, t := range list {
		ids = append(ids, t.QuestionID)
	}
	return ids, nil
}

// UpsertUserQuestionTag 写入用户对某道题的掌握状态：标记过就改 tag，没标记过就新建一条。
// tag 0（取消标记）也照样写入，GetUserQuestionTag 读出来同样是 0。
// 两个请求同时第一次标记同一道题时，user_question_tag 上的唯一索引保证只插入一条（见 EnsureMongoIndexes）
func UpsertUserQuestionTag(ctx context.Context, userID, questionID string, tag int) error {
	coll := GetData().MongoDB.Collection("user_question_tag")
	filter := bson.M{"user_id": userID, "question_id": questionID}
	now := time.Now()
	update := bson.M{
		"$set":         bson.M{"tag": tag, "update_time": now},
		"$setOnInsert": bson.M{"create_time": now}, // 只在新建时写；filter 里的 2 个字段新建时会自动带上
	}
	opts := options.Update().SetUpsert(true)
	if _, err := coll.UpdateOne(ctx, filter, update, opts); err != nil {
		return fmt.Errorf("upsert tag %s UpsertUserQuestionTag: %w", questionID, err)
	}
	return nil
}
