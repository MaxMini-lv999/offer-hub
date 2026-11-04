import type { ReactNode } from 'react'
import IconThumbsUpFilled from '~icons/solar/like-bold'
import IconThumbsUp from '~icons/solar/like-linear'
import type { LikeEffect } from '@/hooks/useLikeEffect'
import { cn } from '@/lib/utils'

/**
 * 点赞按钮的内容：图标 + 数字 + 动效层，题目和评论的点赞按钮共用。按钮要加 group 类，图标才能跟着悬停、按下动。
 * - 点赞前：没点过赞时悬停，大拇指往上翘一点；按下时图标缩小，像被按下去
 * - 点赞后：图标弹一下变实心，外面一圈方形墨线向外扩散，上方浮现 +1 并飘走，数字从下面滑进来
 * - 取消后：图标往里收一下变空心，浮现 -1 往下沉，数字从上面滑进来
 * 点赞是乐观更新，点下去 liked 和数字马上变，动效跟着点击播，不等接口返回。
 * effect 来自 useLikeEffect，每播一次换一个 key，让对应元素重新挂载、动画从头播放
 */
export function LikeContent({
  liked,
  effect,
  floatGap = 4,
  children,
}: {
  liked: boolean
  effect: LikeEffect | null
  /** ±1 底边离图标顶端的距离（px）。带边框的按钮要让 ±1 从边框外面冒出来，不压在边框线上 */
  floatGap?: number
  /** 数字或文字（如没人点赞时的「赞」） */
  children: ReactNode
}) {
  return (
    <>
      <span className="relative inline-flex">
        <span
          key={effect?.key}
          className={cn(
            'inline-flex transition-transform duration-micro ease-standard group-active:scale-75',
            !liked && 'group-hover:-rotate-12',
            effect && (effect.liked ? 'animate-like-pop' : 'animate-like-settle')
          )}
        >
          {liked ? <IconThumbsUpFilled /> : <IconThumbsUp />}
        </span>
        {effect?.liked && (
          <span
            key={`ring-${effect.key}`}
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-like-ring border border-foreground"
          />
        )}
        {/* 左右各多留 16px 再居中，不用 translateX：transform 要留给浮动动画 */}
        {effect && (
          <span
            key={`float-${effect.key}`}
            aria-hidden
            className={cn(
              'pointer-events-none absolute -inset-x-4 bottom-full text-center text-meta font-medium leading-none tabular-nums',
              effect.liked
                ? 'animate-like-float-up text-foreground'
                : 'animate-like-float-down text-muted-foreground'
            )}
            style={{ marginBottom: floatGap }}
          >
            {effect.liked ? '+1' : '-1'}
          </span>
        )}
      </span>
      <span
        key={effect ? `count-${effect.key}` : 'count'}
        className={cn(
          'inline-block tabular-nums',
          effect && (effect.liked ? 'animate-like-count-up' : 'animate-like-count-down')
        )}
      >
        {children}
      </span>
    </>
  )
}
