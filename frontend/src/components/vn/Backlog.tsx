import type { ReactNode } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

/** 回看日志：从右侧滑出，显示完整解析；Esc 或点遮罩关闭 */
export function Backlog({
  open,
  onOpenChange,
  subtitle,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subtitle?: string
  children: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[720px]"
      >
        <div className="border-b px-6 py-4 pr-12">
          <SheetTitle className="font-title">回看日志</SheetTitle>
          {subtitle && <p className="mt-1 text-meta text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
