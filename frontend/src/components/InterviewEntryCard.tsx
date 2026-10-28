import { Link } from 'react-router-dom'
import { Teacher } from 'reicon-react'
import { BentoCard, PanelCaption } from '@/components/bento'
import { cn } from '@/lib/utils'

/** 列表页页头的 1×1 卡片：进入模拟面试模式。to 还没算出来（数据加载中）时显示成不可点的样子 */
export function InterviewEntryCard({ to, label, className }: { to?: string; label: string; className?: string }) {
  const content = (
    <>
      <PanelCaption>
        <Teacher size={12} />
        模拟面试
      </PanelCaption>
      <p className="mt-auto font-title text-heading font-semibold">{label} →</p>
      <p className="text-meta text-muted-foreground">面试官念题、逐段讲解析，最后标记掌握程度</p>
    </>
  )

  if (!to) {
    return (
      <BentoCard size="1x1" aria-busy className={cn('gap-1 opacity-60', className)}>
        {content}
      </BentoCard>
    )
  }
  return (
    <BentoCard size="1x1" asChild className={cn('gap-1', className)}>
      <Link to={to}>{content}</Link>
    </BentoCard>
  )
}
