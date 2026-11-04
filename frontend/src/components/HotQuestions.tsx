import { useId } from 'react'
import { createSearchParams, Link, useSearchParams } from 'react-router-dom'
import IconFire from '~icons/solar/fire-linear'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { RankBadge } from '@/components/RankBadge'
import { Button } from '@/components/ui/button'
import { useHotQuestions, useQuestionBanks } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'
import type { HotQuestion } from '@/types/question'
import { formatViewCount } from '@/utils/format'
import { questionPath } from '@/utils/route'

/** 热门榜单一次取的条数。首页和热门页查同一份（首页只显示前 max 条），从首页点「完整榜单」进来直接读缓存 */
const HOT_RANKING_LIMIT = 20

/**
 * 热门榜单：职位方向页签 + 按热度排名的题目，热门页和首页共用。
 * 当前方向放在 URL 的 job 参数里（缺失或不认识时取第一个方向），返回时还停在原来的页签；
 * 题库列表出错或为空时没有页签，退回全站热门。平板以上分两栏，先排满左栏再排右栏。
 * max 是最多显示几条，showMore 时页签行右边放「完整榜单」入口
 */
export function HotQuestions({ max, showMore = false }: { max?: number; showMore?: boolean }) {
  const { data: groups, isPending: groupsPending } = useQuestionBanks()
  const [searchParams, setSearchParams] = useSearchParams()
  const jobParam = searchParams.get('job')
  const activeJob = (groups?.find((group) => group.job_name === jobParam) ?? groups?.[0])?.job_name
  const panelId = useId()

  // 职位方向查出来之前不发请求，免得先查一次全站热门
  const { data, isPending, isError, error, refetch } = useHotQuestions(
    { limit: HOT_RANKING_LIMIT, job_name: activeJob },
    !groupsPending,
  )
  const list = data?.list.slice(0, max)

  function switchJob(jobName: string) {
    setSearchParams(
      (prev) => {
        prev.set('job', jobName)
        return prev
      },
      { replace: true, preventScrollReset: true },
    )
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 border-b">
        {groupsPending ? (
          <div aria-hidden className="skeleton flex gap-6 pb-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[1.7em] w-16 bg-skeleton" />
            ))}
          </div>
        ) : (
          groups &&
          groups.length > 0 && (
            <div role="tablist" aria-label="职位方向" className="scrollbar-none -mb-px flex min-w-0 gap-6 overflow-x-auto">
              {groups.map((group) => {
                const selected = group.job_name === activeJob
                return (
                  <button
                    key={group.job_name}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={panelId}
                    onClick={() => switchJob(group.job_name)}
                    className={cn(
                      // 横向滚动的容器会裁掉外扩的焦点框，这里改成内描边
                      'shrink-0 border-b-2 pb-3 font-medium transition-colors focus-visible:outline-offset-[-2px]',
                      selected
                        ? 'border-foreground text-foreground'
                        : 'border-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                    )}
                  >
                    {group.job_name}
                  </button>
                )
              })}
            </div>
          )
        )}
        {showMore && (
          <Link
            to={{ pathname: '/hot', search: activeJob ? `?${createSearchParams({ job: activeJob })}` : '' }}
            className="ml-auto shrink-0 pb-3 text-meta text-muted-foreground decoration-2 underline-offset-4 hover:text-foreground hover:underline"
          >
            完整榜单 →
          </Link>
        )}
      </div>

      <div id={panelId} role={activeJob ? 'tabpanel' : undefined} aria-label={activeJob}>
        {isPending && <RankingSkeleton rows={max ?? HOT_RANKING_LIMIT} />}

        {isError && <ErrorState message={error.message} onRetry={() => refetch()} className="mt-4" />}

        {list && list.length === 0 && (
          <EmptyState
            icon={<IconFire className="size-8" />}
            title={activeJob ? '这个方向还没有热门题目' : '暂无热门题目'}
            className="mt-4"
            action={
              <Button variant="outline" size="sm" asChild>
                <Link to="/questions">浏览全部题目</Link>
              </Button>
            }
          />
        )}

        {list && list.length > 0 && (
          <ol className="md:columns-2 md:gap-8">
            {list.map((question, index) => (
              <RankingRow key={question.question_id} question={question} rank={index + 1} />
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

/** 一行：排名序号、标题（手机上最多两行，平板以上一行截断）、浏览数缩写，悬停看完整数字 */
function RankingRow({ question, rank }: { question: HotQuestion; rank: number }) {
  return (
    <li className="break-inside-avoid border-b">
      <Link
        to={questionPath(question.question_id, question.bank_list[0])}
        className="flex items-baseline gap-3 px-2 py-3 transition-colors hover:bg-muted focus-visible:outline-offset-[-2px]"
      >
        <RankBadge rank={rank} />
        <span className="line-clamp-2 min-w-0 flex-1 md:truncate">{question.title}</span>
        <span className="shrink-0 text-meta tabular-nums text-muted-foreground" title={`${question.view_count} 次浏览`}>
          <span className="sr-only">{question.view_count} 次浏览</span>
          <span aria-hidden>{formatViewCount(question.view_count)} 浏览</span>
        </span>
      </Link>
    </li>
  )
}

/** 骨架和真实列表同形：序号方块 + 标题 + 浏览数，平板以上同样分两栏 */
function RankingSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden className="skeleton md:columns-2 md:gap-8">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex break-inside-avoid items-center gap-3 border-b px-2 py-3">
          <div className="h-[1.7em] w-[1.5em] shrink-0 bg-skeleton" />
          <div className={cn('h-[1.7em] bg-skeleton', i % 3 === 0 ? 'flex-1' : 'w-3/5')} />
          <div className="ml-auto h-[1.5em] w-14 shrink-0 bg-skeleton" />
        </div>
      ))}
    </div>
  )
}
