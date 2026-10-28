import { Link } from 'react-router-dom'
import { Fire } from 'reicon-react'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { useHotQuestions } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'
import { questionPath } from '@/utils/route'

const HOT_LIMIT = 10

/**
 * 热门题目前 10 条，题库页和全部题目页的侧栏共用，点击进入详情。
 * jobName 为空时取全站热门；enabled 为 false 时（职位方向还没查出来）先显示骨架。
 * bankId 是当前题库：热门题目也属于它时，链接带上它，详情页左侧就停在这个题库
 */
export function HotContent({ jobName, bankId, enabled = true }: { jobName?: string; bankId?: string; enabled?: boolean }) {
  const { data, isPending, isError, error, refetch } = useHotQuestions({ limit: HOT_LIMIT, job_name: jobName }, enabled)

  return (
    <section aria-labelledby="hot-title" className="border border-foreground">
      <h2 id="hot-title" className="flex items-center gap-2 border-b px-4 py-3 font-title text-heading font-semibold">
        <Fire size={20} />
        热门题目
      </h2>

      {isPending && <HotSkeleton />}

      {isError && <ErrorState message={error.message} onRetry={() => refetch()} className="border-0" />}

      {data && data.list.length === 0 && (
        <EmptyState
          icon={<Fire size={32} />}
          title="暂无热门题目"
          className="border-0"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/questions">浏览全部题目</Link>
            </Button>
          }
        />
      )}

      {data && data.list.length > 0 && (
        <ol className="divide-y">
          {data.list.map((q, index) => (
            <li key={q.question_id}>
              <Link
                to={questionPath(q.question_id, bankId && q.bank_list.includes(bankId) ? bankId : q.bank_list[0])}
                className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted"
              >
                {/* 前三名加粗 */}
                <span
                  className={cn(
                    'w-5 shrink-0 text-right tabular-nums',
                    index < 3 ? 'font-bold text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {index + 1}
                </span>
                <span className="line-clamp-2 min-w-0 flex-1">{q.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function HotSkeleton() {
  return (
    <div className="animate-pulse divide-y" aria-hidden>
      {Array.from({ length: HOT_LIMIT }, (_, i) => (
        <div key={i} className="flex gap-3 px-4 py-3">
          <div className="h-6 w-5 shrink-0 bg-muted" />
          <div className={cn('h-6 bg-muted', i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-4/5' : 'w-3/5')} />
        </div>
      ))}
    </div>
  )
}
