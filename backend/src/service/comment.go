package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"offer-hub/data"
	"offer-hub/model"
	"offer-hub/tools"
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

// ErrParentCommentNotFound 父评论不存在，ctrl 据此返回"父评论不存在"。
// parent_id 必须是同一评论对象下、正常状态的顶层评论（评论只有两层），回复子评论时也传它所在的顶层评论 ID
var ErrParentCommentNotFound = errors.New("parent comment not found")

// AddComment 以 userID 的身份发表评论，返回新评论，格式和评论列表里的一致。
// req.ParentID 为空是顶层评论；不为空是回复，req.ReplyTo 为空时默认回复父评论的作者
func AddComment(ctx context.Context, req *model.AddCommentReq, userID string) (model.AddCommentData, error) {
	// ① 查评论者：token 有效但用户已不存在按未登录处理；不是正常状态（被禁用等）的账号不能发评论
	author, err := data.GetUserByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, data.ErrUserNotFound) {
			return model.AddCommentData{}, ErrInvalidToken
		}
		return model.AddCommentData{}, fmt.Errorf("get user AddComment: %w", err)
	}
	if author.UserStatus != data.UserStatusActive {
		return model.AddCommentData{}, ErrUserDisabled
	}

	// ② 回复：校验父评论，并补上默认的被回复人
	replyTo := req.ReplyTo
	if req.ParentID != "" {
		parent, err := data.GetCommentByID(ctx, req.ParentID)
		if err != nil {
			if errors.Is(err, data.ErrCommentNotFound) {
				return model.AddCommentData{}, ErrParentCommentNotFound
			}
			return model.AddCommentData{}, fmt.Errorf("get parent comment AddComment: %w", err)
		}
		if parent.TargetType != req.TargetType || parent.TargetID != req.TargetID || parent.ParentID != "" {
			return model.AddCommentData{}, ErrParentCommentNotFound
		}
		if replyTo == "" {
			replyTo = parent.UserID
		}
	}

	// ③ 查被回复人的昵称，组装响应时用。所有读操作放在写入之前，查询出错时不会留下半条数据。
	//    对方已注销时查不到，reply_to_name 为空串，和评论列表一致
	users := map[string]data.UserInfo{userID: *author}
	if replyTo != "" {
		list, err := data.ListUsersByUserIDs(ctx, []string{replyTo})
		if err != nil {
			return model.AddCommentData{}, fmt.Errorf("list users AddComment: %w", err)
		}
		for _, u := range list {
			users[u.UserID] = u
		}
	}

	// ④ 写入评论：内容先过滤敏感词（和 UpdateComment ④ 同一个函数，词库热更新后两边同时生效）；
	//    question_id 只有评论对象是题目时才填
	now := time.Now()
	c := data.Comment{
		CommentID:  uuid.NewString(),
		TargetType: req.TargetType,
		TargetID:   req.TargetID,
		UserID:     userID,
		Content:    tools.FilterSensitiveWords(req.Content),
		ParentID:   req.ParentID,
		ReplyTo:    replyTo,
		Status:     data.CommentStatusNormal,
		CreateTime: now,
		UpdateTime: now,
	}
	if req.TargetType == data.CommentTargetQuestion {
		c.QuestionID = req.TargetID
	}
	if err := data.InsertComment(ctx, &c); err != nil {
		return model.AddCommentData{}, fmt.Errorf("insert comment AddComment: %w", err)
	}

	// ⑤ 回复：父评论 child_count +1。评论已经写进去了，这里失败只记日志不报错：
	//    返回失败的话前端会重试，同一条回复就发了两次。child_count 只是冗余计数，
	//    评论列表的 sub_comment_total 按实际条数算，不读它
	if c.ParentID != "" {
		if err := data.IncCommentChildCount(ctx, c.ParentID, 1); err != nil {
			log.Printf("inc child count AddComment: %v", err)
		}
	}

	// ⑥ 新评论还没人点过赞，liked 传 nil，读出来都是 false
	return model.AddCommentData{
		CommentID: c.CommentID,
		Comment:   toCommentItem(&c, users, nil),
	}, nil
}

// ErrCommentNotFound 评论不存在或已删除，ctrl 据此返回"评论不存在"
var ErrCommentNotFound = errors.New("comment not found")

// ErrCommentForbidden 评论不是当前用户发的，ctrl 据此返回 403
var ErrCommentForbidden = errors.New("comment not owned by user")

// DeleteComment 以 userID 的身份软删除评论，只能删自己的。
// 删的是回复时，父评论 child_count 减 1，和发表回复时的加 1 对应
func DeleteComment(ctx context.Context, req *model.DeleteCommentReq, userID string) error {
	// ① 查评论：不存在、已删除等非正常状态的都按不存在处理
	c, err := data.GetCommentByID(ctx, req.CommentID)
	if err != nil {
		if errors.Is(err, data.ErrCommentNotFound) {
			return ErrCommentNotFound
		}
		return fmt.Errorf("get comment DeleteComment: %w", err)
	}

	// ② 只能删自己的评论
	if c.UserID != userID {
		return ErrCommentForbidden
	}

	// ③ 软删除。①到③之间被另一个请求抢先删掉时，这里匹配不到，同样按不存在处理
	if err := data.SoftDeleteComment(ctx, c.CommentID); err != nil {
		if errors.Is(err, data.ErrCommentNotFound) {
			return ErrCommentNotFound
		}
		return fmt.Errorf("soft delete comment DeleteComment: %w", err)
	}

	// ④ 删的是回复：父评论 child_count -1。评论已经删掉了，这里失败只记日志不报错，理由同 AddComment ⑤
	if c.ParentID != "" {
		if err := data.IncCommentChildCount(ctx, c.ParentID, -1); err != nil {
			log.Printf("dec child count DeleteComment: %v", err)
		}
	}

	return nil
}

// UpdateComment 以 userID 的身份修改评论内容，只能改自己的。
// 改内容等于发新内容，所以和 AddComment 一样，被禁用的账号不能改
func UpdateComment(ctx context.Context, req *model.UpdateCommentReq, userID string) (model.UpdateCommentData, error) {
	// ① 查当前用户：token 有效但用户已不存在按未登录处理；不是正常状态（被禁用等）的账号不能改评论
	author, err := data.GetUserByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, data.ErrUserNotFound) {
			return model.UpdateCommentData{}, ErrInvalidToken
		}
		return model.UpdateCommentData{}, fmt.Errorf("get user UpdateComment: %w", err)
	}
	if author.UserStatus != data.UserStatusActive {
		return model.UpdateCommentData{}, ErrUserDisabled
	}

	// ② 查评论：不存在、已删除等非正常状态的都按不存在处理
	c, err := data.GetCommentByID(ctx, req.CommentID)
	if err != nil {
		if errors.Is(err, data.ErrCommentNotFound) {
			return model.UpdateCommentData{}, ErrCommentNotFound
		}
		return model.UpdateCommentData{}, fmt.Errorf("get comment UpdateComment: %w", err)
	}

	// ③ 只能改自己的评论
	if c.UserID != userID {
		return model.UpdateCommentData{}, ErrCommentForbidden
	}

	// ④ 新内容先过滤敏感词再写入，规则和 AddComment ④ 相同。②到④之间评论被删掉时，这里匹配不到，同样按不存在处理
	if err := data.UpdateCommentContent(ctx, c.CommentID, tools.FilterSensitiveWords(req.Content)); err != nil {
		if errors.Is(err, data.ErrCommentNotFound) {
			return model.UpdateCommentData{}, ErrCommentNotFound
		}
		return model.UpdateCommentData{}, fmt.Errorf("update comment UpdateComment: %w", err)
	}

	return model.UpdateCommentData{CommentID: c.CommentID}, nil
}
