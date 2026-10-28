import { BentoCard, BentoGrid, PanelCaption } from '@/components/bento'
import { HotContent } from '@/components/HotContent'
import { InterviewEntryCard } from '@/components/InterviewEntryCard'
import { QuestionFilterBar, QuestionResults } from '@/components/QuestionList'
import { useQuestionFilters } from '@/hooks/useQuestionFilters'
import { useQuestionList } from '@/hooks/useQuestionQueries'
import { useTodayQuestion } from '@/hooks/useTodayQuestion'
import { questionPath } from '@/utils/route'

/**
 * 全部题目：页头是一行 Bento（标题、筛选栏、模拟面试入口），下面和题库页共用列表组件，只是不固定 bank_id；
 * 侧栏是全站热门题目。页头一行 160px，比原来的标题区加筛选栏还矮，首屏能看到的题目不会变少
 */
export function QuestionsPage() {
  const filters = useQuestionFilters()
  // 和列表组件同一个查询，只是取总数
  const { data } = useQuestionList(filters.query)
  const { today } = useTodayQuestion()

  return (
    <div className="space-y-4">
      <BentoGrid className="md:grid-flow-row-dense">
        <BentoCard size="1x1" className="justify-between gap-2">
          <PanelCaption>题目</PanelCaption>
          <div>
            <h1 className="font-title text-title font-semibold">全部题目</h1>
            <p className="mt-1 text-meta tabular-nums text-muted-foreground">
              {data ? `${filters.hasFilter ? '符合条件的' : '共'} ${data.total} 题` : '所有题库的题目都在这里'}
            </p>
          </div>
        </BentoCard>
        <BentoCard size="2x1" aria-label="筛选" className="justify-center">
          <QuestionFilterBar filters={filters} />
        </BentoCard>
        <InterviewEntryCard
          to={today && questionPath(today.question_id, today.bank_list[0], 'interview')}
          label="从今日一题开始"
          className="hidden md:flex"
        />
      </BentoGrid>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-4">
        <QuestionResults filters={filters} />
        <aside>
          <HotContent />
        </aside>
      </div>
    </div>
  )
}
