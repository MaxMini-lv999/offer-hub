import type { ReactNode } from 'react'
import { AlertCircle, Refresh } from 'reicon-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** 空状态：图标 + 一句说明 + 一个操作按钮 */
export function EmptyState({
  icon,
  title,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-4 border px-4 py-12 text-center', className)}>
      <span className="text-muted-foreground">{icon}</span>
      <p className="text-body text-muted-foreground">{title}</p>
      {action}
    </div>
  )
}

/** 出错状态：错误信息 + 重试按钮 */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string
  onRetry: () => void
  className?: string
}) {
  return (
    <EmptyState
      icon={<AlertCircle size={32} />}
      title={`加载失败：${message}`}
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
