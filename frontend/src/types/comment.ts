import type { SortOrder } from '@/types/question'

/** 评论对象类型：1题目 / 2面经 */
export type CommentTargetType = 1 | 2

/** 评论状态：1审核中 / 2正常 / 3拒绝 / 4隐藏 / 5删除 */
export type CommentStatus = 1 | 2 | 3 | 4 | 5

/** 评论列表排序字段 */
export type CommentSortBy = 'create_time' | 'view_count' | 'thumbs_up'

/** GET /api/v1/open/list_comments 请求参数 */
export interface CommentListParams {
  target_type: CommentTargetType
  target_id: string
  /** 为空返回顶层评论（每条附带一页子评论），不为空只返回该评论下的子评论 */
  parent_id?: string
  /** 默认 create_time */
  sort_by?: CommentSortBy
  /** 顶层评论默认 desc，子评论默认 asc */
  sort_order?: SortOrder
  /** 默认 1 */
  page?: number
  /** 默认 20，最大 100 */
  page_size?: number
  /** 顶层评论里附带的子评论页码，默认 1 */
  sub_comment_page?: number
  /** 默认 5，最大 20 */
  sub_comment_size?: number
}

/** 评论，列表和发表评论共用 */
export interface CommentItem {
  comment_id: string
  user_id: string
  user_name: string
  user_avatar: string
  content: string
  /** 顶层评论为空串 */
  parent_id: string
  /** 被回复的用户 ID，顶层评论为空串 */
  reply_to: string
  /** 被回复的用户名，顶层评论为空串 */
  reply_to_name: string
  status: CommentStatus
  thumbs_up: number
  /** 子评论总数，大于 sub_comments 长度时显示"查看更多回复" */
  sub_comment_total: number
  /** 游客为 false */
  user_liked: boolean
  /** 只有顶层评论列表会填，其余情况为空数组，不会是 null */
  sub_comments: CommentItem[]
  /** 格式 2024-01-01 12:00:00 */
  create_time: string
  update_time: string
}

export interface CommentListData {
  total: number
  list: CommentItem[]
}

/** POST /api/v1/comment/add 请求体，评论者取自 token */
export interface AddCommentParams {
  target_type: CommentTargetType
  target_id: string
  /** 父评论 ID，顶层评论不传 */
  parent_id?: string
  /** 被回复的用户 ID，顶层评论不传 */
  reply_to?: string
  /** 最长 1000 字，后端会过滤敏感词 */
  content: string
}

/** POST /api/v1/comment/add 响应 data，comment 是过滤敏感词后实际存下的评论 */
export interface AddCommentData {
  comment_id: string
  comment: CommentItem
}

/** POST /api/v1/comment/delete 请求体，只能删自己的评论 */
export interface DeleteCommentParams {
  comment_id: string
}

/** POST /api/v1/comment/update 请求体，只能改自己的评论 */
export interface UpdateCommentParams {
  comment_id: string
  /** 最长 1000 字，后端去掉首尾空白后过滤敏感词，全是空白返回参数错误 */
  content: string
}

/** POST /api/v1/comment/update 响应 data */
export interface UpdateCommentData {
  comment_id: string
}
