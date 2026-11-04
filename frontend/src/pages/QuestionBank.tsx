import { Link, useParams } from 'react-router-dom'
import IconRefresh from '~icons/solar/refresh-linear'
import { BankLogo } from '@/components/BankLogo'
import { HotContent } from '@/components/HotContent'
import { InterviewEntryLink } from '@/components/InterviewEntryLink'
import { QuestionWorkbench } from '@/components/QuestionList'
import { Button } from '@/components/ui/button'
import { useQuestionFilters } from '@/hooks/useQuestionFilters'
import { useBankInfo, useBankQuestionList, useQuestionList } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'
import type { QuestionBank } from '@/types/question'
import { NotFoundPage } from '@/pages/not-found'
import { questionPath } from '@/utils/route'

/**
 * 题库页：检索工作台，和全部题目页同一套布局。页头两行：面包屑和模拟面试入口、题库名和简介；
 * 下面左边是吸顶筛选栏 + 题目列表，右边当前职位方向的热门题目（桌面端吸顶、往下滚时收起，手机端在列表下面）
 */
export function QuestionBankPage() {
  const { bankId = '' } = useParams<{ bankId: string }>()
  // 题库信息和职位方向从题库全量列表里查（/hot/list 不支持 bank_id，只能按职位方向过滤）
  const { data: info, isPending, isError, refetch } = useBankInfo(bankId)
  const filters = useQuestionFilters(bankId)
  // 和列表组件同一个查询，只用来判断列表是否还在首次加载
  const { isPending: listPending } = useQuestionList(filters.query)
  // 题库的第一题，和详情页左侧题目栏共用同一份缓存
  const { data: navList } = useBankQuestionList(bankId)
  const first = navList?.pages[0]?.list[0]

  // 全量列表加载完了却找不到这个题库
  if (info === null) return <NotFoundPage />

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          {info ? (
            <Breadcrumb jobName={info.jobName} />
          ) : (
            <div aria-hidden className="h-[1.5em] w-28 skeleton bg-skeleton text-meta" />
          )}
          <InterviewEntryLink
            to={first && questionPath(first.question_id, bankId, 'interview')}
            label="从第一题开始"
          />
        </div>
        {isPending && <BankSummarySkeleton />}
        {isError && (
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground">题库信息加载失败</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <IconRefresh className="size-4" />
              重试
            </Button>
          </div>
        )}
        {info && <BankSummary bank={info.bank} />}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-4">
        <QuestionWorkbench bankId={bankId} filters={filters} />
        {/* 窄屏热门排在列表下面：等列表首次加载完再显示，否则题目比骨架少时热门会从屏幕外跳上来 */}
        <aside className={cn(listPending && 'hidden lg:block')}>
          <HotContent jobName={info?.jobName} bankId={bankId} enabled={!!info} sticky />
        </aside>
      </div>
    </div>
  )
}

function Breadcrumb({ jobName }: { jobName: string }) {
  return (
    <nav aria-label="面包屑" className="flex min-w-0 gap-2 text-meta text-muted-foreground">
      <Link
        to="/collections"
        className="shrink-0 decoration-2 underline-offset-4 hover:text-foreground hover:underline"
      >
        题库目录
      </Link>
      <span aria-hidden>/</span>
      <Link
        to={{ pathname: '/collections', search: `?job=${encodeURIComponent(jobName)}` }}
        className="truncate decoration-2 underline-offset-4 hover:text-foreground hover:underline"
      >
        {jobName}
      </Link>
    </nav>
  )
}

function BankSummary({ bank }: { bank: QuestionBank }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BankLogo name={bank.bank_name} />
      <div className="min-w-0">
        <h1 className="truncate font-title text-title font-semibold" title={bank.bank_name}>
          {bank.bank_name}
        </h1>
        <p className="truncate text-meta text-muted-foreground" title={bank.desc || undefined}>
          共 {bank.count} 题{bank.desc && ` · ${bank.desc}`}
        </p>
      </div>
    </div>
  )
}

/** 和 BankSummary 同高：40px 图标 + 标题一行（title 字号）+ 简介一行（meta 字号） */
function BankSummarySkeleton() {
  return (
    <div aria-hidden className="flex skeleton items-center gap-3">
      <div className="h-10 w-10 shrink-0 bg-skeleton" />
      <div className="flex-1">
        <div className="text-title">
          <div className="h-[1.3em] w-48 max-w-full bg-skeleton" />
        </div>
        <div className="text-meta">
          <div className="h-[1.5em] w-64 max-w-full bg-skeleton" />
        </div>
      </div>
    </div>
  )
}
