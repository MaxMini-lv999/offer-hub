import type { ReactNode } from 'react'
import { AlertCircle, Refresh } from 'reicon-react'
import { ArtImage } from '@/components/art'
import { Button } from '@/components/ui/button'
import { ART, type ArtAsset } from '@/constants/art'
import { cn } from '@/lib/utils'

/**
 * 空状态：图标或插画 + 一句说明 + 一个操作按钮。
 * 插画只用在主内容区的空状态（120–160px），侧栏、抽屉这类窄地方用图标
 */
export function EmptyState({
  icon,
  art,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode
  art?: ArtAsset
  title: string
  /** 标题下面一行补充说明 */
  hint?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-4 border px-4 py-12 text-center', className)}>
      {art ? (
        <ArtImage art={art} variant="mobile" className="h-[120px] w-[120px] object-contain md:h-40 md:w-40" />
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
 * 出错状态：错误信息 + 重试按钮。withArt 时配「连接中断」插画，天青只用在系统提示那一行，重试按钮仍是墨色
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
      icon={<AlertCircle size={32} />}
      art={withArt ? ART.stateNetworkError : undefined}
      title={`加载失败：${message}`}
      hint={withArt && <span className="text-system">请检查网络连接后重试</span>}
      className={className}
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          <Refresh size={16} />
          重试
        </Button>
      }
    />
  )
}
