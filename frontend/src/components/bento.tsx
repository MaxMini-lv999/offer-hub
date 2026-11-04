import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * 墨线分镜格：1px 墨线框，像漫画分镜格。首页用它把封面、今日一题和学习进度框成一块，
 * 格子内部再用 1px 线分段
 */
export function BentoCard({ className, ...props }: ComponentPropsWithoutRef<'section'>) {
  return (
    <section
      className={cn(
        'relative flex min-w-0 flex-col overflow-hidden border border-foreground bg-card p-4 text-card-foreground md:p-6',
        className
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
        className
      )}
    >
      {children}
    </span>
  )
}
