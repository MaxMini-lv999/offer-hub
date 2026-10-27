import { createSearchParams, Link, useSearchParams } from 'react-router-dom'
import { AlertCircle } from 'reicon-react'
import { Button } from '@/components/ui/button'
import { useQuestionBanks } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'
import type { JobQuestionGroup } from '@/types/question'

export function QuestionCollectionsPage() {
  const { data, isPending, isError, error, refetch } = useQuestionBanks()
  const [searchParams, setSearchParams] = useSearchParams()

  // URL 里的 activeIndex 可能缺失、不是数字或越界，统一回退到第一个方向
  const rawIndex = Number(searchParams.get('activeIndex'))
  const activeIndex =
    data && Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < data.length ? rawIndex : 0

  function switchTab(index: number) {
    // replace：切 tab 不新增历史记录，从题目列表页返回时仍停在原来的 tab
    setSearchParams(
      (prev) => {
        prev.set('activeIndex', String(index))
        return prev
      },
      { replace: true },
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">题库</h1>

      {isPending && <CollectionsSkeleton />}

      {isError && (
        <div className="flex items-center gap-3 border border-destructive/40 p-4 text-sm text-destructive">
          <AlertCircle size={18} />
          <span>{error.message}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            重试
          </Button>
        </div>
      )}

      {data && data.length === 0 && <p className="text-sm text-muted-foreground">暂无题库</p>}

      {data && data.length > 0 && (
        <>
          <div role="tablist" className="flex gap-6 border-b">
            {data.map((group, index) => (
              <button
                key={group.job_name}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                onClick={() => switchTab(index)}
                className={cn(
                  '-mb-px border-b-2 pb-2 text-sm font-medium transition-colors',
                  index === activeIndex
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {group.job_name}
              </button>
            ))}
          </div>

          <SeriesSections group={data[activeIndex]} activeIndex={activeIndex} />
        </>
      )}
    </div>
  )
}

/** 一个职位方向下的所有系列，每个系列一组题库卡片 */
function SeriesSections({ group, activeIndex }: { group: JobQuestionGroup; activeIndex: number }) {
  return (
    <div className="space-y-8">
      {group.series_list.map((series) => (
        <section key={series.series_id} className="space-y-3">
          <h2 className="text-lg font-semibold">{series.series_name}</h2>

          {series.bank_list.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无题库</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {series.bank_list.map((bank) => (
                <Link
                  key={bank.bank_id}
                  to={{
                    pathname: '/questions',
                    search: createSearchParams({
                      bank_id: bank.bank_id,
                      activeIndex: String(activeIndex),
                    }).toString(),
                  }}
                  className="block border p-4 transition-colors hover:border-primary hover:bg-accent"
                >
                  <h3 className="font-medium">{bank.bank_name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{bank.desc}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

function CollectionsSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="flex gap-6 border-b pb-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-5 w-16 bg-muted" />
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-6 w-24 bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((j) => (
              <div key={j} className="space-y-2 border p-4">
                <div className="h-5 w-1/2 bg-muted" />
                <div className="h-4 w-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
