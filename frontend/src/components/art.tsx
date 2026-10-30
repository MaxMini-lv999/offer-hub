import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { ART_BASE, artSrc, MOTIONS, type ArtAsset, type MotionName, type VectorName } from '@/constants/art'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * 场景或立绘。写死宽高，加载前就占好位置，不会把版面顶开。
 * 不传 alt 时当装饰处理，读屏软件会跳过
 */
export function ArtImage({
  art,
  alt,
  priority = false,
  className,
}: {
  art: ArtAsset
  alt?: string
  /** 首屏主图：立即加载；其余图片都懒加载 */
  priority?: boolean
  className?: string
}) {
  return (
    <img
      src={artSrc(art)}
      width={art.width}
      height={art.height}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={className}
    />
  )
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

/** 页面在前台；切到别的标签页时停掉动画 */
function usePageVisible() {
  return useSyncExternalStore(subscribeVisibility, () => !document.hidden)
}

/**
 * 澜汐的 Q 版动作（8 帧序列图，CSS steps 逐帧播放）。96px 以内用 192px 档，更大用 288px 档，高分屏下都不糊。
 * 先显示静态封面，序列图下载解码完、进入视口才开始播；系统减少动态效果、页面切到后台、离开视口时停在封面，
 * 回来后从头播。一次性动作（挥手、庆祝）播完停在封面，换 playKey 重播。
 * 动作要跟真实状态绑定：请求结束、步骤切换时由调用方换掉 name 或改成 still
 */
export function CharacterSprite({
  name,
  size,
  playKey = 0,
  loop,
  still = false,
  label,
  className,
}: {
  name: MotionName
  size: number
  playKey?: string | number
  /** 不传按动作的默认值：挥手和庆祝播一次，其余循环 */
  loop?: boolean
  /** 只显示静态封面，不下载序列图 */
  still?: boolean
  /** 有含义时给读屏软件的说明；不传当装饰 */
  label?: string
  className?: string
}) {
  const motion = MOTIONS[name]
  const repeat = loop ?? motion.loop
  const tier = size <= 96 ? 192 : 288
  const sheet = `${ART_BASE}/sprites/${name}-${tier}.webp`
  const poster = `${ART_BASE}/posters/${name}-${tier}.webp`
  const runKey = `${name}-${playKey}`

  const reducedMotion = usePrefersReducedMotion()
  const pageVisible = usePageVisible()
  const ref = useRef<HTMLSpanElement>(null)
  const [inView, setInView] = useState(false)
  const [loadedSheet, setLoadedSheet] = useState<string>()
  const [finishedKey, setFinishedKey] = useState<string>()

  const playable = !still && !reducedMotion

  useEffect(() => {
    const el = ref.current
    if (!el || !playable) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [playable, runKey])

  // 进入视口才下载序列图，解码完再切过去，第一帧不会是空白
  const wantSheet = playable && inView && loadedSheet !== sheet
  useEffect(() => {
    if (!wantSheet) return
    let cancelled = false
    const img = new Image()
    img.src = sheet
    img.decode().then(
      () => {
        if (!cancelled) setLoadedSheet(sheet)
      },
      // 下载失败就一直显示封面
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [wantSheet, sheet])

  const active = playable && pageVisible && inView && loadedSheet === sheet && finishedKey !== runKey
  const style: CSSProperties = {
    width: size,
    backgroundImage: `url(${active ? sheet : poster})`,
    animationName: active ? `ohm-frames-${name}` : 'none',
    animationDuration: `${motion.duration}ms`,
    animationIterationCount: repeat ? 'infinite' : 1,
  }

  return (
    <span
      // 换 playKey 时重新挂载，CSS 动画从第一帧开始
      key={runKey}
      ref={ref}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-active={active}
      className={cn('ohm-sprite', className)}
      style={style}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && !repeat) setFinishedKey(runKey)
      }}
    />
  )
}

/**
 * 动效包的 64px 动画 SVG（翻书、完成勾、里程碑等），按当前主题选亮色或暗色文件。
 * 动画写在 SVG 文件里，系统减少动态效果时文件自己会停
 */
export function MotionVector({
  name,
  size = 64,
  alt,
  className,
}: {
  name: VectorName
  size?: number
  alt?: string
  className?: string
}) {
  const theme = useTheme()
  return (
    <img
      src={`${ART_BASE}/vectors/${name}-${theme}.svg`}
      width={size}
      height={size}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      className={cn('shrink-0', className)}
    />
  )
}
