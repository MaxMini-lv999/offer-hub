import { post } from '@/lib/request'
import type { LikeData, LikeParams, UnlikeData, UnlikeParams } from '@/types/interaction'

// code 非 0 时 post 会抛出 ApiError（继承 Error，message 是后端的 msg），这里不用再判断

/** POST /api/v1/interaction/like 点赞，需要登录 */
export function postLike(data: LikeParams) {
  return post<LikeData>('/api/v1/interaction/like', data)
}

/** POST /api/v1/interaction/unlike 取消点赞，需要登录 */
export function postUnlike(data: UnlikeParams) {
  return post<UnlikeData>('/api/v1/interaction/unlike', data)
}
