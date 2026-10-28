import { createSearchParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Book } from 'reicon-react'
import { BankLogo } from '@/components/BankLogo'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { HotContent } from '@/components/HotContent'
import { SearchBox } from '@/components/SearchBox'
import { Button } from '@/components/ui/button'
import { useQuestionBanks } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'
import type { JobQuestionGroup, QuestionBank } from '@/types/question'
import { bankPath } from '@/utils/route'

/** 首页：页头带搜索框；左边职位方向 tab，每个方向下按系列分组展示题库卡片，右边（手机端在下方）当前方向的热门题目 */
export function HomePage() {
  const { data, isPending, isError, error, refetch } = useQuestionBanks()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // 当前 tab 放在 URL 的 job 参数里，从题库页返回时还停在原来的方向；缺失或不认识时回退到第一个
  const jobParam = searchParams.get('job')
  const activeGroup = data?.find((group) => group.job_name === jobParam) ?? data?.[0]

  function switchTab(jobName: string) {
    setSearchParams({ job: jobName }, { replace: true, preventScrollReset: true })
  }

  // 首页不展示搜索结果，回车后带着关键词去全部题目页
  function searchQuestions(keyword: string) {
    if (!keyword) return
    navigate({ pathname: '/questions', search: `?${createSearchParams({ keyword })}` })
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-title font-semibold">题库</h1>
          <p className="text-muted-foreground">按职位方向挑选题库，系统地准备面试。</p>
        </div>
        <div className="sm:w-80">
          <SearchBox value="" onSearch={searchQuestions} placeholder="搜索题目标题或内容" auto={false} />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
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
            <>
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
                        <span className="ml-2 text-meta tabular-nums">{countBanks(group)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <SeriesSections group={activeGroup} />
            </>
          )}
        </div>

        {/* 题库列表出错或为空时 activeGroup 是 undefined，退回全站热门 */}
        <aside>
          <HotContent jobName={activeGroup?.job_name} enabled={!isPending} />
        </aside>
      </div>
    </div>
  )
}

/** 一个职位方向下的题库总数，显示在 tab 名后面 */
function countBanks(group: JobQuestionGroup) {
  return group.series_list.reduce((sum, series) => sum + series.bank_list.length, 0)
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
            // 主栏右边有热门侧栏，lg 下只剩约 680px，到 xl 才排三列
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

/** 主栏骨架，和真实内容同形：tab 行 + 两个系列，每个系列一组卡片；侧栏骨架由 HotContent 自己出 */
function HomeSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="flex gap-6 border-b pb-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-6 w-20 bg-muted" />
        ))}
      </div>
      <div className="divide-y">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-4 py-8">
            <div className="h-7 w-24 bg-muted" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
