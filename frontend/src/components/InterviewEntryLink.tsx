import { Link } from 'react-router-dom'
import IconAcademicCap from '~icons/solar/square-academic-cap-linear'
import { cn } from '@/lib/utils'

/**
 * 列表页标题行右侧的模拟面试入口。to 还没算出来（数据加载中）时显示成灰色文字、不可点；
 * 手机端只留「模拟面试 →」
 */
export function InterviewEntryLink({ to, label }: { to?: string; label: string }) {
  const content = (
    <>
      <IconAcademicCap className="size-4 self-center" />
      模拟面试
      <span className="hidden sm:inline">· {label}</span>→
    </>
  )
  const className = 'inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap font-medium'

  if (!to) return <span className={cn(className, 'text-muted-foreground')}>{content}</span>
  return (
    <Link to={to} className={cn(className, 'decoration-2 underline-offset-4 hover:underline')}>
      {content}
    </Link>
  )
}
