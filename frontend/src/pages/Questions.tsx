import { HotContent } from '@/components/HotContent'
import { QuestionList } from '@/components/QuestionList'

/** 全部题目：和题库页共用列表组件，只是不固定 bank_id；侧栏是全站热门题目 */
export function QuestionsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 border-b pb-8">
        <h1 className="text-title font-semibold">全部题目</h1>
        <p className="text-muted-foreground">所有题库的题目都在这里，可以按关键词、难度和标签筛选。</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <QuestionList />
        <aside>
          <HotContent />
        </aside>
      </div>
    </div>
  )
}
