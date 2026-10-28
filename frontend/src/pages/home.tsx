import { Link, useSearchParams } from 'react-router-dom'
import { Book } from 'reicon-react'
import { BankLogo } from '@/components/BankLogo'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { useQuestionBanks } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'
import type { JobQuestionGroup, QuestionBank } from '@/types/question'
import { bankPath } from '@/utils/route'

/** 首页：职位方向做成顶部 tab，每个方向下按系列分组展示题库卡片 */
export function HomePage() {
  const { data, isPending, isError, error, refetch } = useQuestionBanks()
  const [searchParams, setSearchParams] = useSearchParams()

  // 当前 tab 放在 URL 的 job 参数里，从题库页返回时还停在原来的方向；缺失或不认识时回退到第一个
  const jobParam = searchParams.get('job')
  const activeGroup = data?.find((group) => group.job_name === jobParam) ?? data?.[0]

  function switchTab(jobName: string) {
    setSearchParams({ job: jobName }, { replace: true, preventScrollReset: true })
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-title font-semibold">题库</h1>
        <p className="text-muted-foreground">按职位方向挑选题库，系统地准备面试。</p>
      </header>

      {isPending && <HomeSkeleton />}

      {isError && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={<Book size={32} />}
          title="还没有任何题库"
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              刷新
            </Button>
          }
        />
      )}

      {data && activeGroup && (
        <div>
          {/* 外层画底线，内层 -mb-px 让选中项的 2px 下划线压在底线上；方向多时内层横向滚动，页面本身不滚 */}
          <div className="border-b">
            <div role="tablist" aria-label="职位方向" className="scrollbar-none -mb-px flex gap-6 overflow-x-auto">
              {data.map((group) => {
                const active = group === activeGroup
                return (
                  <button
                    key={group.job_name}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => switchTab(group.job_name)}
                    className={cn(
                      'shrink-0 border-b-2 pb-3 font-medium transition-colors',
                      active
                        ? 'border-foreground text-foreground'
                        : 'border-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                    )}
                  >
                    {group.job_name}
                  </button>
                )
              })}
            </div>
          </div>

          <SeriesSections group={activeGroup} />
        </div>
      )}
    </div>
  )
}

/** 一个职位方向下的所有系列，系列之间用细线分隔 */
function SeriesSections({ group }: { group: JobQuestionGroup }) {
  if (group.series_list.length === 0) {
    return (
      <EmptyState
        icon={<Book size={32} />}
        title="这个方向还没有题库"
        className="mt-8"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/questions">浏览全部题目</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div role="tabpanel" aria-label={group.job_name} className="divide-y">
      {group.series_list.map((series) => (
        <section key={series.series_id} className="space-y-4 py-8">
          <h2 className="text-heading font-semibold">{series.series_name}</h2>

          {series.bank_list.length === 0 ? (
            <EmptyState
              icon={<Book size={32} />}
              title="这个系列还没有题库"
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/questions">浏览全部题目</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {series.bank_list.map((bank) => (
                <BankCard key={bank.bank_id} bank={bank} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

function BankCard({ bank }: { bank: QuestionBank }) {
  return (
    <Link to={bankPath(bank.bank_id)} className="flex h-full gap-4 border p-4 transition-colors hover:border-foreground">
      <BankLogo name={bank.bank_name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="truncate font-semibold">{bank.bank_name}</h3>
        {/* 描述固定占两行高度，卡片之间对齐 */}
        <p className="mt-1 line-clamp-2 min-h-[3em] text-meta text-muted-foreground">{bank.desc || '暂无描述'}</p>
        <p className="mt-2 text-meta text-muted-foreground">{bank.count} 题</p>
      </div>
    </Link>
  )
}

/** 骨架和真实内容同形：tab 行 + 两个系列，每个系列一行卡片 */
function HomeSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="flex gap-6 border-b pb-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-6 w-16 bg-muted" />
        ))}
      </div>
      <div className="divide-y">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-4 py-8">
            <div className="h-7 w-24 bg-muted" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex gap-4 border p-4">
                  <div className="h-10 w-10 shrink-0 bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-6 w-1/2 bg-muted" />
                    <div className="h-4 w-full bg-muted" />
                    <div className="h-4 w-2/3 bg-muted" />
                    <div className="h-4 w-10 bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
