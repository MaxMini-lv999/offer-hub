import { post } from '@/lib/request'
import type { LikeData, LikeParams, LikeTargetType, UnlikeData, UnlikeParams } from '@/types/interaction'

// code 非 0 时 post 会抛出 ApiError（继承 Error，message 是后端的 msg），这里不用再判断

/** POST /api/v1/interaction/like 点赞，需要登录 */
export function postLike(data: LikeParams) {
  return post<LikeData>('/api/v1/interaction/like', data)
}

/** POST /api/v1/interaction/unlike 取消点赞，需要登录 */
export function postUnlike(data: UnlikeParams) {
  return post<UnlikeData>('/api/v1/interaction/unlike', data)
}

/**
 * 点赞或取消点赞，题目（target_type 1）和评论（3）共用：isLike 为 true 调点赞，false 调取消点赞。
 * 取消点赞的响应只有 count，这里补上 liked: false，两种操作返回同样的结构
 */
export async function toggleLike(targetType: LikeTargetType, targetId: string, isLike: boolean): Promise<LikeData> {
  const target = { target_type: targetType, target_id: targetId }
  if (isLike) return postLike(target)
  const { count } = await postUnlike(target)
  return { liked: false, count }
}
