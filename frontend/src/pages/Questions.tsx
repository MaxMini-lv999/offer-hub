import { HotContent } from '@/components/HotContent'
import { QuestionWorkbench } from '@/components/QuestionList'
import { useQuestionFilters } from '@/hooks/useQuestionFilters'
import { useQuestionList } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'

/**
 * 全部题目：检索工作台。一行标题（含题数），下面左边是吸顶筛选栏 + 紧凑题目列表（和题库页共用，只是不固定 bank_id），
 * 右边是全站热门，桌面端吸顶、往下滚时收起；手机端热门排在列表下面
 */
export function QuestionsPage() {
  const filters = useQuestionFilters()
  // 和列表组件同一个查询，只是取总数
  const { data, isPending: listPending, isPlaceholderData } = useQuestionList(filters.query)

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="shrink-0 font-title text-title font-semibold">全部题目</h1>
        {/* 加载中不放占位文字：手机上占位文字一长，标题行会先换行再缩回来 */}
        <p className="truncate text-meta tabular-nums text-muted-foreground">
          {/* 改条件后新数据回来前，data 还是上一次的结果，总数对不上，先显示加载中 */}
          {data &&
            (isPlaceholderData
              ? '加载中…'
              : `${filters.hasFilter ? '符合条件的' : '共'} ${data.total} 题`)}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-4">
        <QuestionWorkbench filters={filters} />
        {/* 窄屏热门排在列表下面：等列表首次加载完再显示，否则题目比骨架少时热门会从屏幕外跳上来 */}
        <aside className={cn(listPending && 'hidden lg:block')}>
          <HotContent sticky />
        </aside>
      </div>
    </div>
  )
}
