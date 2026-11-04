package service

import (
	"context"
	"errors"
	"fmt"
	"log"

	"offer-hub/data"
	"offer-hub/model"
)

// ErrLikeTargetNotFound 点赞对象不存在，ctrl 据此返回"点赞对象不存在"。
// 包括已隐藏、已删除的题目，以及审核中、已删除等非正常状态的评论
var ErrLikeTargetNotFound = errors.New("like target not found")

// getLikeThumbsUp 查点赞对象当前的点赞数，对象不存在时返回 ErrLikeTargetNotFound。
// 题目读 thumbs_up_count，评论读 thumbs_up
func getLikeThumbsUp(ctx context.Context, targetType int, targetID string) (int, error) {
	switch targetType {
	case data.InteractionTargetQuestion:
		q, err := data.GetQuestionByID(ctx, targetID)
		if err != nil {
			if errors.Is(err, data.ErrQuestionNotFound) {
				return 0, ErrLikeTargetNotFound
			}
			return 0, fmt.Errorf("get question getLikeThumbsUp: %w", err)
		}
		return q.ThumbsUpCount, nil
	case data.InteractionTargetComment:
		c, err := data.GetCommentByID(ctx, targetID)
		if err != nil {
			if errors.Is(err, data.ErrCommentNotFound) {
				return 0, ErrLikeTargetNotFound
			}
			return 0, fmt.Errorf("get comment getLikeThumbsUp: %w", err)
		}
		return c.ThumbsUp, nil
	default:
		// ctrl 的 binding 只放行 1 / 3，走到这里说明调用方没校验
		return 0, fmt.Errorf("unsupported target_type %d getLikeThumbsUp", targetType)
	}
}

// incLikeThumbsUp 把点赞对象的点赞数加 delta，返回改完后的点赞数，不会减成负数
func incLikeThumbsUp(ctx context.Context, targetType int, targetID string, delta int) (int, error) {
	switch targetType {
	case data.InteractionTargetQuestion:
		return data.IncQuestionThumbsUp(ctx, targetID, delta)
	case data.InteractionTargetComment:
		return data.IncCommentThumbsUp(ctx, targetID, delta)
	default:
		return 0, fmt.Errorf("unsupported target_type %d incLikeThumbsUp", targetType)
	}
}

// Like 以 userID 的身份点赞题目或评论，返回点赞后的状态和目标当前的点赞数。
// 幂等：重复点赞不会重复计数，点赞数只在点赞状态真的从无到有时 +1。
// count 一律取自计数字段，服务端不自己 ±1，见 ③
func Like(ctx context.Context, req *model.LikeReq, userID string) (model.LikeData, error) {
	// ① 查点赞对象：不存在或不是正常状态的不能点赞；顺便拿到当前点赞数，重复点赞或 ③ +1 失败时返回它
	count, err := getLikeThumbsUp(ctx, req.TargetType, req.TargetID)
	if err != nil {
		if errors.Is(err, ErrLikeTargetNotFound) {
			return model.LikeData{}, ErrLikeTargetNotFound
		}
		return model.LikeData{}, fmt.Errorf("get thumbs up Like: %w", err)
	}

	// ② 写点赞记录。changed 为 false 表示之前就是已点赞
	changed, err := data.UpsertLike(ctx, userID, req.TargetType, req.TargetID)
	if err != nil {
		return model.LikeData{}, fmt.Errorf("upsert like Like: %w", err)
	}

	// ③ 状态真的变了才给目标点赞数 +1。count 只认库里的计数字段，服务端不自己 ±1：
	//    +1 成功：count 换成 $inc 之后的值
	//    +1 失败：只记日志，count 保持 ① 读到的值（$inc 没写进去，库里还是这个数）。
	//    估算成 +1 的话前端这次显示 51、刷新又变回 50；少算的这 1 是冗余计数的代价，只记日志。
	//    点赞记录已经写进去了，所以仍返回成功，否则前端会把按钮恢复成未点赞，和库里的记录对不上
	if changed {
		newCount, err := incLikeThumbsUp(ctx, req.TargetType, req.TargetID, 1)
		if err != nil {
			log.Printf("inc thumbs up Like: %v", err)
		} else {
			count = newCount
		}
	}

	return model.LikeData{Liked: true, Count: count}, nil
}

// Unlike 以 userID 的身份取消点赞题目或评论，返回取消点赞后的状态和目标当前的点赞数。
// 幂等：没点过赞或已经取消过时什么都不改，点赞数只在点赞状态真的从有到无时 -1，最小为 0。
// count 一律取自计数字段，服务端不自己 ±1，见 Like ③
func Unlike(ctx context.Context, req *model.UnlikeReq, userID string) (model.UnlikeData, error) {
	// ① 查点赞对象，同 Like ①
	count, err := getLikeThumbsUp(ctx, req.TargetType, req.TargetID)
	if err != nil {
		if errors.Is(err, ErrLikeTargetNotFound) {
			return model.UnlikeData{}, ErrLikeTargetNotFound
		}
		return model.UnlikeData{}, fmt.Errorf("get thumbs up Unlike: %w", err)
	}

	// ② 把点赞记录置为已取消。changed 为 false 表示本来就没点赞
	changed, err := data.CancelLike(ctx, userID, req.TargetType, req.TargetID)
	if err != nil {
		return model.UnlikeData{}, fmt.Errorf("cancel like Unlike: %w", err)
	}

	// ③ 状态真的变了才给目标点赞数 -1，count 的取法和失败的处理同 Like ③
	if changed {
		newCount, err := incLikeThumbsUp(ctx, req.TargetType, req.TargetID, -1)
		if err != nil {
			log.Printf("dec thumbs up Unlike: %v", err)
		} else {
			count = newCount
		}
	}

	return model.UnlikeData{Liked: false, Count: count}, nil
}

// TagQuestion 以 userID 的身份标记题目的掌握状态，重复标记时覆盖之前的状态，tag 为 0 表示取消标记
func TagQuestion(ctx context.Context, req *model.TagQuestionReq, userID string) error {
	// ① 题目必须存在且是正常状态，避免给不存在的题写标记
	if _, err := data.GetQuestionByID(ctx, req.QuestionID); err != nil {
		if errors.Is(err, data.ErrQuestionNotFound) {
			return ErrQuestionNotFound
		}
		return fmt.Errorf("get question TagQuestion: %w", err)
	}

	// ② upsert：标记过就改 tag，没标记过就新建一条。ctrl 的 binding 保证 Tag 不为 nil
	if err := data.UpsertUserQuestionTag(ctx, userID, req.QuestionID, *req.Tag); err != nil {
		return fmt.Errorf("upsert tag TagQuestion: %w", err)
	}

	return nil
}
