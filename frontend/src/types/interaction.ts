/** 点赞目标类型：1题目 / 2面经 / 3评论 */
export type LikeTargetType = 1 | 2 | 3

/** POST /api/v1/interaction/like 请求体，点赞者取自 token */
export interface LikeParams {
  target_type: LikeTargetType
  target_id: string
}

/** POST /api/v1/interaction/like 响应 data */
export interface LikeData {
  /** 操作后的点赞状态 */
  liked: boolean
  /** 目标当前的总点赞数 */
  count: number
}

/** POST /api/v1/interaction/unlike 请求体，与点赞相同 */
export type UnlikeParams = LikeParams

/** POST /api/v1/interaction/unlike 响应 data */
export interface UnlikeData {
  /** 取消点赞后目标的总点赞数 */
  count: number
}
