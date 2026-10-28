import type { CSSProperties } from 'react'
import { ART_BASE, type ArtAsset } from '@/constants/art'
import { cn } from '@/lib/utils'

function artSrc(art: ArtAsset, variant: 'desktop' | 'mobile') {
  return `${ART_BASE}/web/${variant}/${art.file}.webp`
}

/**
 * 插画。默认按断点只下载一档：<768px 用手机档，其余用桌面档；写死宽高，加载前就占好位置，不会把版面顶开。
 * variant="mobile" 固定用手机档，给 160px 以内的小图用，高分屏下也够清楚。
 * 不传 alt 时当装饰处理，读屏软件会跳过
 */
export function ArtImage({
  art,
  alt,
  variant,
  priority = false,
  className,
}: {
  art: ArtAsset
  alt?: string
  variant?: 'mobile'
  /** 首屏主图：立即加载；其余图片都懒加载 */
  priority?: boolean
  className?: string
}) {
  const imgProps = {
    alt: alt ?? '',
    'aria-hidden': alt ? undefined : true,
    loading: priority ? 'eager' : 'lazy',
    decoding: 'async',
    draggable: false,
    className,
  } as const

  if (variant === 'mobile') {
    return <img src={artSrc(art, 'mobile')} width={art.mobile.width} height={art.mobile.height} {...imgProps} />
  }
  return (
    // display: contents 让 <img> 直接参与外层布局，绝对定位和 object-fit 都写在 img 上
    <picture className="contents">
      <source
        media="(max-width: 767px)"
        srcSet={artSrc(art, 'mobile')}
        width={art.mobile.width}
        height={art.mobile.height}
      />
      <img src={artSrc(art, 'desktop')} width={art.desktop.width} height={art.desktop.height} {...imgProps} />
    </picture>
  )
}

/**
 * 3×2 图集里的一格（面试官表情或墨樱 Q 版），用背景图定位显示，整张图集只下载一次。
 * 96px 以内用手机档（每格 192px），更大用桌面档（每格 256px），高分屏下都不糊
 */
export function AtlasSprite({
  art,
  index,
  size,
  label,
  className,
}: {
  art: ArtAsset
  /** 0–5，从左到右、从上到下 */
  index: number
  size: number
  /** 有含义时给读屏软件的说明；不传当装饰 */
  label?: string
  className?: string
}) {
  const column = index % 3
  const row = Math.floor(index / 3)
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url(${artSrc(art, size <= 96 ? 'mobile' : 'desktop')})`,
    backgroundSize: '300% 200%',
    backgroundPosition: `${column * 50}% ${row * 100}%`,
    backgroundRepeat: 'no-repeat',
  }
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-block shrink-0', className)}
      style={style}
    />
  )
}

export type InkDecorName = 'ink-halftone' | 'ink-hatching' | 'panel-corner' | 'progress-seal'

/**
 * 墨线装饰：vectors/ 下的单色 SVG 当遮罩用，颜色取 currentColor，亮暗主题自动跟随。
 * tile 时按 120px 平铺（网点、斜线），否则整张缩放到容器里（角花、印章）
 */
export function InkDecor({ name, tile = false, className }: { name: InkDecorName; tile?: boolean; className?: string }) {
  const mask = `url(${ART_BASE}/vectors/${name}.svg)`
  const style: CSSProperties = {
    maskImage: mask,
    WebkitMaskImage: mask,
    maskSize: tile ? '120px' : 'contain',
    WebkitMaskSize: tile ? '120px' : 'contain',
    maskRepeat: tile ? 'repeat' : 'no-repeat',
    WebkitMaskRepeat: tile ? 'repeat' : 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  }
  return <span aria-hidden className={cn('pointer-events-none block select-none bg-current', className)} style={style} />
}
