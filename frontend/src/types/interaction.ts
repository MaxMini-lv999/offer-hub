/** 点赞目标类型：1题目 / 2面经 / 3评论 */
export type LikeTargetType = 1 | 2 | 3

/** POST /api/v1/interaction/like 请求体，点赞者取自 token */
export interface LikeParams {
  target_type: LikeTargetType
  target_id: string
}

/** POST /api/v1/interaction/like 响应 data，前端以这两个值校准缓存 */
export interface LikeData {
  /** 操作后的点赞状态 */
  liked: boolean
  /** 目标当前的总点赞数，取自题目 thumbs_up_count / 评论 thumbs_up 字段 */
  count: number
}

/** POST /api/v1/interaction/unlike 请求体，与点赞相同 */
export type UnlikeParams = LikeParams

/** POST /api/v1/interaction/unlike 响应 data，结构与点赞相同，liked 恒为 false */
export type UnlikeData = LikeData
