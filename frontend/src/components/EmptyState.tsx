import type { ReactNode } from 'react'
import IconAlertCircle from '~icons/solar/danger-circle-linear'
import IconRefresh from '~icons/solar/refresh-linear'
import { CharacterSprite } from '@/components/art'
import { Button } from '@/components/ui/button'
import type { MotionName } from '@/constants/art'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

/**
 * 空状态：图标或澜汐的 Q 版 + 一句说明 + 一个操作按钮。
 * Q 版默认 120–160px，用在主内容区；评论区这类次要位置传 poseSize 缩到 96px，侧栏用图标。
 * 一屏最多两个角色、同一时刻只有一个在动，页面上已经有立绘（首页封面）时用图标
 */
export function EmptyState({
  icon,
  pose,
  poseSize,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode
  /** 澜汐的姿势，只显示静态封面：空状态和出错都不是进行中的状态，不放循环动画 */
  pose?: MotionName
  /** 不传时桌面 160px、手机 120px */
  poseSize?: number
  title: string
  /** 标题下面一行补充说明 */
  hint?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const isDesktop = useIsDesktop()

  return (
    <div
      className={cn('flex flex-col items-center gap-4 border px-4 py-12 text-center', className)}
    >
      {pose ? (
        <CharacterSprite name={pose} size={poseSize ?? (isDesktop ? 160 : 120)} still />
      ) : (
        <span className="text-muted-foreground">{icon}</span>
      )}
      <div className="space-y-1">
        <p className="text-body text-muted-foreground">{title}</p>
        {hint && <p className="text-meta">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

/**
 * 出错状态：错误信息 + 重试按钮。withArt 时配澜汐拿扳手修理的 Q 版（静态）；
 * 点重试后查询回到加载中，由各处的骨架屏接手。天青只用在系统提示那一行，重试按钮仍是墨色
 */
export function ErrorState({
  message,
  onRetry,
  withArt = false,
  className,
}: {
  message: string
  onRetry: () => void
  withArt?: boolean
  className?: string
}) {
  return (
    <EmptyState
      icon={<IconAlertCircle className="size-8" />}
      pose={withArt ? 'repair' : undefined}
      title={`加载失败：${message}`}
      hint={withArt && <span className="text-system">请检查网络连接后重试</span>}
      className={className}
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          <IconRefresh className="size-4" />
          重试
        </Button>
      }
    />
  )
}
