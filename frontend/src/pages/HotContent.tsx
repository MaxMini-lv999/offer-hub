import { HotQuestions } from '@/components/HotQuestions'

/** 热门榜单页：一行标题，下面是职位方向页签和前 20 名（按后端的热度排序），点题目进详情 */
export function HotContentPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h1 className="shrink-0 font-title text-title font-semibold">热门榜单</h1>
        <p className="truncate text-meta text-muted-foreground">按热度排名，点题目查看详情</p>
      </div>
      <HotQuestions />
    </div>
  )
}
