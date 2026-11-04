import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  SLIDE_MS,
  useFeedGestures,
  useFeedKeys,
  type FeedDirection,
  type FeedGestureHandlers,
} from '@/hooks/useFeedGestures'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

/** 当前卡片前后各渲染几张：拖动时能看到相邻的卡片，再往外的提前挂载，详情和正文先准备好 */
const RENDER_AHEAD = 2
/** 键盘、滚轮翻到头时卡片往外弹的距离 */
const BOUNCE_PX = 48
/** 回弹提示显示多久 */
const EDGE_HINT_MS = 1500
const EASING = 'cubic-bezier(0.2, 0, 0, 1)'

function trackTransform(index: number, offset: number) {
  return `translate3d(0, calc(${-index * 100}% + ${offset}px), 0)`
}

/**
 * 沉浸式刷题的舞台：一屏一张卡片，上下切换。所有卡片竖着排在一条轨道上，第 i 张在 i 屏高的位置，
 * 切题就是把轨道平移到 -index 屏；拖动时轨道直接跟手（不经过 React 渲染），松手后用 SLIDE_MS 的过渡动画到位。
 * 系统开了「减少动态效果」时不播过渡和回弹动画，直接到位，只保留文字提示。
 * 只渲染当前卡片前后各 RENDER_AHEAD 张，其余的卸载
 */
export function FeedStage({
  count,
  index,
  onIndexChange,
  slideKey,
  renderSlide,
  edgeHint,
  enabled,
  children,
}: {
  /** 一共几张卡片 */
  count: number
  index: number
  onIndexChange: (index: number) => void
  slideKey: (index: number) => string
  renderSlide: (index: number, active: boolean) => ReactNode
  /** 翻到头时的提示文字：dir 1 是在最后一张往后翻，-1 是在第一张往前翻 */
  edgeHint: (dir: FeedDirection) => string
  /** 评论抽屉、登录弹窗打开时关掉手势和键盘 */
  enabled: boolean
  /** 叠在舞台上的内容（如进度） */
  children?: ReactNode
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  // 只有用户切题时才播过渡动画；队列变了导致 index 变（比如刷新后找回位置）直接跳过去
  const animateNext = useRef(false)
  const [hint, setHint] = useState<{ text: string; dir: FeedDirection; key: number } | null>(null)

  const apply = useCallback(
    (offset: number, animate: boolean) => {
      const track = trackRef.current
      if (!track) return
      track.style.transition =
        animate && !reducedMotion ? `transform ${SLIDE_MS}ms ${EASING}` : 'none'
      track.style.transform = trackTransform(index, offset)
    },
    [index, reducedMotion]
  )

  useLayoutEffect(() => {
    apply(0, animateNext.current)
    animateNext.current = false
  }, [apply])

  // 焦点在已经移走的卡片里（比如刚点过上一题的点赞按钮）：交给舞台，键盘用户不会把焦点丢在看不见的地方
  useEffect(() => {
    const stage = stageRef.current
    const focused = document.activeElement
    if (!stage || !focused || focused === stage || !stage.contains(focused)) return
    if (!focused.closest('[data-feed-active]')) stage.focus({ preventScroll: true })
  }, [index])

  useEffect(() => {
    if (!hint) return
    const timer = window.setTimeout(() => setHint(null), EDGE_HINT_MS)
    return () => window.clearTimeout(timer)
  }, [hint])

  const handlers: FeedGestureHandlers = {
    canGo: dir => index + dir >= 0 && index + dir < count,
    go: dir => {
      const next = index + dir
      if (next < 0 || next >= count) return
      animateNext.current = true
      onIndexChange(next)
    },
    edge: (dir, fromDrag) => {
      setHint(prev => ({ text: edgeHint(dir), dir, key: (prev?.key ?? 0) + 1 }))
      // 拖动时卡片已经被拉开，松手弹回去就是回弹；键盘、滚轮这里补一个往外弹再回来的动画
      if (fromDrag || reducedMotion) return
      trackRef.current?.animate(
        [
          { transform: trackTransform(index, 0) },
          { transform: trackTransform(index, -dir * BOUNCE_PX) },
          { transform: trackTransform(index, 0) },
        ],
        { duration: SLIDE_MS, easing: EASING }
      )
    },
    drag: apply,
  }
  useFeedGestures(stageRef, handlers, enabled)
  useFeedKeys(stageRef, handlers, enabled, reducedMotion)

  const from = Math.max(0, index - RENDER_AHEAD)
  const to = Math.min(count - 1, index + RENDER_AHEAD)
  const slides: number[] = []
  for (let i = from; i <= to; i++) slides.push(i)

  return (
    <div
      ref={stageRef}
      tabIndex={-1}
      aria-roledescription="题目流"
      // overflow: hidden 的元素仍然能被脚本滚动：页内查找跳到相邻卡片、focus()、scrollIntoView 都会把它滚开，
      // 卡片整体错位。支持 overflow: clip 的浏览器用 clip（不再是滚动容器），不支持的被滚动时立刻复位
      onScroll={e => {
        e.currentTarget.scrollTop = 0
        e.currentTarget.scrollLeft = 0
      }}
      className="relative h-full touch-manipulation overflow-hidden outline-none data-[grabbing]:cursor-grabbing data-[grabbing]:select-none supports-[overflow:clip]:overflow-clip"
    >
      <div ref={trackRef} className="absolute inset-0 will-change-transform">
        {slides.map(i => (
          <Slide key={slideKey(i)} index={i} active={i === index}>
            {renderSlide(i, i === index)}
          </Slide>
        ))}
      </div>

      {/* 回弹提示：往前翻到头显示在顶部，往后翻到头显示在底部 */}
      <div
        aria-live="polite"
        className={cn(
          'pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4',
          hint?.dir === -1 ? 'top-4' : 'bottom-20 md:bottom-6'
        )}
      >
        {hint && (
          <span
            key={hint.key}
            className="bg-foreground px-3 py-1 text-meta text-background animate-in fade-in-0"
          >
            {hint.text}
          </span>
        )}
      </div>

      {children}
    </div>
  )
}

/** 一张卡片，占满舞台。不是当前这张时设成 inert：读屏和 Tab 都跳过，拖动时仍然看得见 */
function Slide({
  index,
  active,
  children,
}: {
  index: number
  active: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (ref.current) ref.current.inert = !active
  }, [active])

  return (
    <div
      ref={ref}
      data-feed-active={active || undefined}
      aria-hidden={!active}
      className="absolute inset-x-0 h-full"
      style={{ top: `${index * 100}%` }}
    >
      {children}
    </div>
  )
}
