import { post } from '@/lib/request'
import type {
  LikeData,
  LikeParams,
  LikeTargetType,
  UnlikeData,
  UnlikeParams,
} from '@/types/interaction'

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
 * 两个接口返回同样的结构：操作后的 liked 和目标当前的 count（取自后端的点赞数字段），调用方以它校准缓存
 */
export function toggleLike(
  targetType: LikeTargetType,
  targetId: string,
  isLike: boolean
): Promise<LikeData> {
  const target = { target_type: targetType, target_id: targetId }
  return isLike ? postLike(target) : postUnlike(target)
}

/**
 * 乐观更新用的预测值：现在是 liked、count，点一下之后应该是什么。
 * 只是预测，别人同时点的赞算不进来，接口返回后要换成服务端的 liked、count
 */
export function predictToggleLike(liked: boolean, count: number): LikeData {
  return { liked: !liked, count: Math.max(count + (liked ? -1 : 1), 0) }
}
