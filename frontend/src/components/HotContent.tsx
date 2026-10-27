import { Link } from 'react-router-dom'
import { AlertCircle, Eye, Fire } from 'reicon-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useHotQuestions } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'

/** 热门题目模块，首页和题目列表页共用，点击题目进入详情 */
export function HotContent({ limit = 10 }: { limit?: number }) {
  const { data, isPending, isError, error, refetch } = useHotQuestions({ limit })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fire size={20} className="text-orange-500" />
          热门题目
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending && <p className="text-sm text-muted-foreground">加载中...</p>}

        {isError && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-destructive">
            <AlertCircle size={18} />
            <span>{error.message}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </div>
        )}

        {data && data.list.length === 0 && (
          <p className="text-sm text-muted-foreground">暂无热门题目</p>
        )}

        {data && data.list.length > 0 && (
          <ol className="divide-y">
            {data.list.map((q, index) => (
              <li key={q.question_id}>
                <Link
                  to={`/questions/${q.question_id}`}
                  className="flex items-center gap-3 py-3 text-sm transition-colors hover:text-primary"
                >
                  {/* 前三名高亮 */}
                  <span
                    className={cn(
                      'w-5 shrink-0 text-center font-semibold',
                      index < 3 ? 'text-orange-500' : 'text-muted-foreground',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{q.title}</span>
                  <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                    <Eye size={14} />
                    {q.view_count}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
