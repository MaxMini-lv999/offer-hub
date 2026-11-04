import { Link, useSearchParams } from 'react-router-dom'
import IconBook from '~icons/solar/book-linear'
import { BankLogo } from '@/components/BankLogo'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { HotContent } from '@/components/HotContent'
import { Button } from '@/components/ui/button'
import { useQuestionBanks } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'
import type { JobQuestionGroup, QuestionBank } from '@/types/question'
import { bankPath } from '@/utils/route'

/**
 * 题库目录：一行标题，下面左边是职位方向 + 按系列分组的题库索引，右边（手机端在下方）当前方向的热门题目。
 * 整页没有立绘，目录整体出错或为空时配澜汐的静态 Q 版；某个方向下没有题库时只用图标
 */
export function BankCatalogPage() {
  const { data, isPending, isError, error, refetch } = useQuestionBanks()
  const [searchParams, setSearchParams] = useSearchParams()

  // 当前方向放在 URL 的 job 参数里，从题库页返回时还停在原来的方向；缺失或不认识时回退到第一个
  const jobParam = searchParams.get('job')
  const activeGroup = data?.find(group => group.job_name === jobParam) ?? data?.[0]
  const bankCount = data?.reduce((sum, group) => sum + countBanks(group), 0)

  function switchJob(jobName: string) {
    setSearchParams({ job: jobName }, { replace: true, preventScrollReset: true })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h1 className="shrink-0 font-title text-title font-semibold">题库目录</h1>
        <p className="truncate text-meta tabular-nums text-muted-foreground">
          {data && data.length > 0 && `${data.length} 个职位方向 · ${bankCount} 个题库`}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-4">
        <div className="min-w-0">
          {isPending && <IndexSkeleton />}

          {isError && <ErrorState message={error.message} onRetry={() => refetch()} withArt />}

          {data && data.length === 0 && (
            <EmptyState
              pose="explain"
              title="还没有任何题库"
              action={
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  刷新
                </Button>
              }
            />
          )}

          {data && activeGroup && (
            <BankIndex groups={data} active={activeGroup} onSelect={switchJob} />
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

/** 一个职位方向下的题库总数，显示在方向名后面 */
function countBanks(group: JobQuestionGroup) {
  return group.series_list.reduce((sum, series) => sum + series.bank_list.length, 0)
}

/**
 * 职位方向在桌面端竖排在左边（左侧 1px 线，选中项 2px 竖线压在上面），
 * 手机端横排成一行可左右滚动（底部 1px 线，选中项 2px 下划线压在上面）；右边或下面是当前方向的索引
 */
function BankIndex({
  groups,
  active,
  onSelect,
}: {
  groups: JobQuestionGroup[]
  active: JobQuestionGroup
  onSelect: (jobName: string) => void
}) {
  return (
    <div className="lg:grid lg:grid-cols-[160px_minmax(0,1fr)] lg:gap-8">
      <div className="border-b lg:self-start lg:border-b-0 lg:border-l">
        <div
          role="tablist"
          aria-label="职位方向"
          className="scrollbar-none -mb-px flex gap-6 overflow-x-auto lg:-ml-px lg:mb-0 lg:flex-col lg:gap-0 lg:overflow-visible"
        >
          {groups.map(group => {
            const selected = group === active
            return (
              <button
                key={group.job_name}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="bank-index"
                onClick={() => onSelect(group.job_name)}
                className={cn(
                  // 横向滚动的容器会裁掉外扩的焦点框，这里改成内描边
                  'flex shrink-0 items-baseline justify-between gap-2 border-b-2 pb-3 font-medium transition-colors focus-visible:outline-offset-[-2px] lg:border-b-0 lg:border-l-2 lg:py-2 lg:pl-4 lg:text-left',
                  selected
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                )}
              >
                {group.job_name}
                <span className="text-meta tabular-nums">{countBanks(group)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <SeriesIndex group={active} />
    </div>
  )
}

/** 当前方向下的系列，每个系列一段：宋体小标题压一条墨线，下面是题库索引行（平板以上两列） */
function SeriesIndex({ group }: { group: JobQuestionGroup }) {
  if (group.series_list.length === 0) {
    return (
      <EmptyState
        icon={<IconBook className="size-8" />}
        title="这个方向还没有题库"
        className="mt-6 lg:mt-0"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/questions">浏览全部题目</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div
      id="bank-index"
      role="tabpanel"
      aria-label={group.job_name}
      className="mt-6 space-y-6 lg:mt-0"
    >
      {group.series_list.map(series => (
        <section key={series.series_id} aria-label={series.series_name}>
          <h2 className="border-b border-foreground pb-2 font-title font-semibold">
            {series.series_name}
          </h2>
          {series.bank_list.length === 0 ? (
            <p className="py-3 text-meta text-muted-foreground">
              这个系列还没有题库，先去
              <Link
                to="/questions"
                className="mx-1 underline underline-offset-4 hover:text-foreground"
              >
                全部题目
              </Link>
              看看。
            </p>
          ) : (
            <ul className="grid md:grid-cols-2 md:gap-x-8">
              {series.bank_list.map(bank => (
                <BankIndexRow key={bank.bank_id} bank={bank} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

/** 目录行：图标 + 题库名，点线引到右边的题数，下面一行简介 */
function BankIndexRow({ bank }: { bank: QuestionBank }) {
  return (
    <li className="border-b">
      <Link
        to={bankPath(bank.bank_id)}
        className="flex items-center gap-3 px-2 py-3 transition-colors hover:bg-muted"
      >
        <BankLogo name={bank.bank_name} className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-medium">{bank.bank_name}</span>
            <span
              aria-hidden
              className="min-w-4 flex-1 border-b border-dotted border-muted-foreground"
            />
            <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
              {bank.count} 题
            </span>
          </div>
          <p className="truncate text-meta text-muted-foreground">{bank.desc || '暂无描述'}</p>
        </div>
      </Link>
    </li>
  )
}

/** 目录骨架，和真实内容同形同高：方向列表三项 + 两个系列，每个系列三行索引；侧栏骨架由 HotContent 自己出 */
function IndexSkeleton() {
  return (
    <div aria-hidden className="skeleton lg:grid lg:grid-cols-[160px_minmax(0,1fr)] lg:gap-8">
      <div className="border-b lg:self-start lg:border-b-0 lg:border-l">
        <div className="-mb-px flex gap-6 lg:-ml-px lg:mb-0 lg:flex-col lg:gap-0">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="border-b-2 border-transparent pb-3 lg:border-b-0 lg:border-l-2 lg:py-2 lg:pl-4"
            >
              <div className="h-[1.7em] w-20 bg-skeleton" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 space-y-6 lg:mt-0">
        {[0, 1].map(i => (
          <div key={i}>
            <div className="border-b border-foreground pb-2">
              <div className="h-[1.7em] w-20 bg-skeleton" />
            </div>
            <div className="grid md:grid-cols-2 md:gap-x-8">
              {[0, 1, 2].map(j => (
                <div key={j} className="flex items-center gap-3 border-b px-2 py-3">
                  <div className="h-8 w-8 shrink-0 bg-skeleton" />
                  <div className="min-w-0 flex-1">
                    <div className="h-[1.7em] w-1/2 bg-skeleton" />
                    <div className="text-meta">
                      <div className="h-[1.5em] w-3/4 bg-skeleton" />
                    </div>
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
