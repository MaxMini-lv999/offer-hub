import { Slot } from '@radix-ui/react-slot'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Bento 网格：手机单列、平板（≥768px）6 栏、桌面（≥1280px）12 栏。
 * 平板以上行高固定 160px，卡片以「3 栏 × 1 行」为单位拼 1×1、2×1、2×2 三种尺寸；手机端卡片按内容高度纵向排列
 */
export function BentoGrid({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-3 md:auto-rows-[160px] md:grid-cols-6 md:gap-4 xl:grid-cols-12', className)}
      {...props}
    />
  )
}

const SIZE_CLASSES = {
  '1x1': 'md:col-span-3',
  '2x1': 'md:col-span-6',
  '2x2': 'md:col-span-6 md:row-span-2',
}

/**
 * Bento 卡片：1px 墨线框，像漫画分镜格。asChild 时把样式交给唯一的子元素（通常是整张卡可点的 Link），
 * 可点的卡片悬停时底色变 muted
 */
export function BentoCard({
  size = '1x1',
  asChild = false,
  className,
  ...props
}: { size?: keyof typeof SIZE_CLASSES; asChild?: boolean } & ComponentPropsWithoutRef<'section'>) {
  const Comp = asChild ? Slot : 'section'
  return (
    <Comp
      className={cn(
        'relative flex min-w-0 flex-col overflow-hidden border border-foreground bg-card p-4 text-card-foreground md:p-6',
        asChild && 'transition-colors duration-micro ease-standard hover:bg-muted',
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  )
}

/** 分镜格左上角的说明框：墨底反白小字，像漫画里的旁白框 */
export function PanelCaption({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 bg-foreground px-2 text-meta font-medium text-background',
        className,
      )}
    >
      {children}
    </span>
  )
}
