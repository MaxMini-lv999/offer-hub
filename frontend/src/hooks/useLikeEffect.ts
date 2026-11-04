import { useCallback, useState } from 'react'

/** 一次点赞动效：key 每次加 1，连续点赞 / 取消时同一个元素也能重新播放 */
export interface LikeEffect {
  key: number
  /** 这次操作后的点赞状态，决定播点赞还是取消点赞的动效 */
  liked: boolean
}

/**
 * 点赞动效的触发器，配合 LikeContent 使用。play 在点击、调 mutate 的同时调用：点赞是乐观更新，
 * 按钮马上变，动效跟着点击播；登录后重新拉取数据时 liked 变了也不播。失败时缓存改回去，不再播反向动效
 */
export function useLikeEffect() {
  const [effect, setEffect] = useState<LikeEffect | null>(null)
  const play = useCallback(
    (liked: boolean) => setEffect(prev => ({ key: (prev?.key ?? 0) + 1, liked })),
    []
  )
  return [effect, play] as const
}
