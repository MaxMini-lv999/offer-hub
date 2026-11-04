import { Link } from 'react-router-dom'
import IconPlay from '~icons/solar/play-linear'
import { GuideNote } from '@/components/guide'
import { HotQuestions } from '@/components/HotQuestions'
import { Button } from '@/components/ui/button'

/**
 * 热门榜单页：一行标题，下面是职位方向页签和前 20 名（按后端的热度排序），点题目进详情；
 * 榜单下面澜汐一句话，推荐不知道先刷哪道的人去沉浸刷题
 */
export function HotContentPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h1 className="shrink-0 font-title text-title font-semibold">热门榜单</h1>
        <p className="truncate text-meta text-muted-foreground">按热度排名，点题目查看详情</p>
      </div>
      <HotQuestions />
      <GuideNote
        pose="explain"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/feed">
              <IconPlay />
              沉浸刷题
            </Link>
          </Button>
        }
      >
        不知道先刷哪道，就从榜首开始；想随机来几道，去沉浸刷题。
      </GuideNote>
    </div>
  )
}
