package service

import (
	"context"
	"fmt"
	"time"

	"offer-hub/data"
	"offer-hub/model"
)

// pageOf 取 list 的第 page 页（每页 size 条），越界时返回空切片。
// 调用方保证 page ≥ 1、size ≥ 1，否则 start 为负数会 panic
func pageOf(list []data.Comment, page, size int) []data.Comment {
	start := (page - 1) * size
	if start >= len(list) {
		return nil
	}
	end := min(start+size, len(list))
	return list[start:end]
}

// toCommentItem 把 data 层的评论转成响应里的 CommentItem。
// 用户名、头像从 users 里取，查不到（账号已删）时为空串；点赞状态从 liked 里取，游客传空 map 即全为 false。
// SubCommentTotal 和 SubComments 的内容由调用方填
func toCommentItem(c *data.Comment, users map[string]data.UserInfo, liked map[string]bool) model.CommentItem {
	return model.CommentItem{
		CommentID:   c.CommentID,
		UserID:      c.UserID,
		Content:     c.Content,
		ParentID:    c.ParentID,
		ReplyTo:     c.ReplyTo,
		Status:      c.Status,
		ThumbsUp:    c.ThumbsUp,
		UserName:    users[c.UserID].NickName,
		UserAvatar:  users[c.UserID].Avatar,
		ReplyToName: users[c.ReplyTo].NickName, // 顶层评论 ReplyTo 为空，取到零值即空串
		UserLiked:   liked[c.CommentID],
		SubComments: make([]model.CommentItem, 0), // 输出 [] 而不是 null
		CreateTime:  c.CreateTime.Local().Format(time.DateTime),
		UpdateTime:  c.UpdateTime.Local().Format(time.DateTime),
	}
}

// ListComments 查询评论列表，userID 为空表示游客。
// req.ParentID 为空：返回顶层评论，每条附带一页子评论和子评论总数；
// 不为空：只返回该评论下的子评论，不再嵌套
func ListComments(ctx context.Context, req *model.ListCommentsReq, userID string) (model.ListCommentsData, error) {
	// ① 查当前页：顶层评论，或某条评论下的子评论。total 是分页前的总数，前端据此判断还有没有下一页
	comments, total, err := data.ListComments(ctx, data.CommentFilter{
		TargetType: req.TargetType,
		TargetID:   req.TargetID,
		ParentID:   req.ParentID,
		SortBy:     req.SortBy,
		SortOrder:  req.SortOrder,
		Page:       req.Page,
		PageSize:   req.PageSize,
	})
	if err != nil {
		return model.ListCommentsData{}, fmt.Errorf("list comments ListComments: %w", err)
	}

	// ② 顶层模式：一次查出当前页所有评论的子评论，按 parent_id 分组。
	//    例：[c3 c4 c5] → {c1: [c3 c4], c2: [c5]}；parent_id 模式不查，groups 保持为空
	groups := make(map[string][]data.Comment)
	if req.ParentID == "" {
		parentIDs := make([]string, 0, len(comments))
		for _, c := range comments {
			parentIDs = append(parentIDs, c.CommentID)
		}
		subComments, err := data.ListSubCommentsByParentIDs(ctx, parentIDs)
		if err != nil {
			return model.ListCommentsData{}, fmt.Errorf("list sub comments ListComments: %w", err)
		}
		for _, s := range subComments {
			groups[s.ParentID] = append(groups[s.ParentID], s)
		}
	}

	// ③ 列名单：这一页要展示的评论 = 当前页 + 每组截出来的那页子评论，
	//    从中收集评论 ID（查点赞用）和用户 ID（查名字用，含被回复的人）。
	//    例：[c1 c3 c4 c2 c5] → 评论 {c1..c5}，用户 {u1 u2 u3}
	shown := make([]data.Comment, 0, len(comments))
	for _, c := range comments {
		shown = append(shown, c)
		shown = append(shown, pageOf(groups[c.CommentID], req.SubCommentPage, req.SubCommentSize)...)
	}

	commentIDs := make([]string, 0, len(shown))
	userIDs := make([]string, 0, len(shown))
	userIDSet := make(map[string]struct{}, len(shown))
	// addUserID 把非空、没出现过的用户 ID 加进 userIDs，保持首次出现的顺序
	addUserID := func(id string) {
		if id == "" {
			return
		}
		if _, ok := userIDSet[id]; ok {
			return
		}
		userIDSet[id] = struct{}{}
		userIDs = append(userIDs, id)
	}
	for _, c := range shown {
		commentIDs = append(commentIDs, c.CommentID)
		addUserID(c.UserID)
		addUserID(c.ReplyTo)
	}

	// ④ 按名单批量查用户，转成 user_id → 用户 的 map，组装时按 ID 取
	userList, err := data.ListUsersByUserIDs(ctx, userIDs)
	if err != nil {
		return model.ListCommentsData{}, fmt.Errorf("list users ListComments: %w", err)
	}
	users := make(map[string]data.UserInfo, len(userList))
	for _, u := range userList {
		users[u.UserID] = u
	}

	// ⑤ 登录用户：批量查这些评论里哪些点过赞；游客不查，空 map 读出来都是 false
	liked := make(map[string]bool)
	if userID != "" {
		liked, err = data.GetLikedTargetIDs(ctx, userID, data.InteractionTargetComment, commentIDs) // 用 = 赋给外层 liked，不能用 :=
		if err != nil {
			return model.ListCommentsData{}, fmt.Errorf("get liked ListComments: %w", err)
		}
	}

	// ⑥ 组装成树：遍历当前页，顶层模式下把每条评论自己那一组子评论截一页挂上去。
	//    例：c1 → {sub_comment_total: 2, sub_comments: [c3 c4]}
	result := make([]model.CommentItem, 0, len(comments))
	for _, c := range comments {
		item := toCommentItem(&c, users, liked)
		if req.ParentID == "" {
			group := groups[c.CommentID]
			item.SubCommentTotal = len(group) // 用实际查到的正常子评论条数，不用 child_count
			for _, s := range pageOf(group, req.SubCommentPage, req.SubCommentSize) {
				item.SubComments = append(item.SubComments, toCommentItem(&s, users, liked))
			}
		}
		result = append(result, item)
	}

	return model.ListCommentsData{Total: total, List: result}, nil
}
