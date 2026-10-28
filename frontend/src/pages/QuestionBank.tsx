import { Link, useParams } from 'react-router-dom'
import { Refresh } from 'reicon-react'
import { BankLogo } from '@/components/BankLogo'
import { BentoCard, BentoGrid } from '@/components/bento'
import { HotContent } from '@/components/HotContent'
import { InterviewEntryCard } from '@/components/InterviewEntryCard'
import { QuestionFilterBar, QuestionResults } from '@/components/QuestionList'
import { Button } from '@/components/ui/button'
import { useQuestionFilters } from '@/hooks/useQuestionFilters'
import { useBankInfo, useBankQuestionList } from '@/hooks/useQuestionQueries'
import type { QuestionBank } from '@/types/question'
import { NotFoundPage } from '@/pages/not-found'
import { questionPath } from '@/utils/route'

/**
 * 题库页：页头是一行 Bento（题库信息、筛选栏、从第一题开始模拟面试），
 * 下面左边题目列表，右边（手机端在下方）当前职位方向的热门题目
 */
export function QuestionBankPage() {
  const { bankId = '' } = useParams<{ bankId: string }>()
  // 题库信息和职位方向从题库全量列表里查（/hot/list 不支持 bank_id，只能按职位方向过滤）
  const { data: info, isPending, isError, refetch } = useBankInfo(bankId)
  const filters = useQuestionFilters(bankId)
  // 题库的第一题，和详情页左侧题目栏共用同一份缓存
  const { data: navList } = useBankQuestionList(bankId)
  const first = navList?.pages[0]?.list[0]

  // 全量列表加载完了却找不到这个题库
  if (info === null) return <NotFoundPage />

  return (
    <div className="space-y-4">
      <BentoGrid className="md:grid-flow-row-dense">
        <BentoCard size="1x1" className="justify-between gap-2">
          {isPending && <BankSummarySkeleton />}
          {isError && (
            <>
              <p className="text-muted-foreground">题库信息加载失败</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="self-start">
                <Refresh size={16} />
                重试
              </Button>
            </>
          )}
          {info && <BankSummary bank={info.bank} jobName={info.jobName} />}
        </BentoCard>
        <BentoCard size="2x1" aria-label="筛选" className="justify-center">
          <QuestionFilterBar filters={filters} />
        </BentoCard>
        <InterviewEntryCard
          to={first && questionPath(first.question_id, bankId, 'interview')}
          label="从第一题开始"
          className="hidden md:flex"
        />
      </BentoGrid>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-4">
        <QuestionResults bankId={bankId} filters={filters} />
        <aside>
          <HotContent jobName={info?.jobName} bankId={bankId} enabled={!!info} />
        </aside>
      </div>
    </div>
  )
}

function BankSummary({ bank, jobName }: { bank: QuestionBank; jobName: string }) {
  return (
    <>
      <nav aria-label="面包屑" className="flex min-w-0 gap-2 text-meta text-muted-foreground">
        <Link to="/" className="shrink-0 decoration-2 underline-offset-4 hover:text-foreground hover:underline">
          首页
        </Link>
        <span aria-hidden>/</span>
        <Link
          to={{ pathname: '/', search: `?job=${encodeURIComponent(jobName)}` }}
          className="truncate decoration-2 underline-offset-4 hover:text-foreground hover:underline"
        >
          {jobName}
        </Link>
      </nav>
      <div className="flex min-w-0 items-start gap-3">
        <BankLogo name={bank.bank_name} />
        <div className="min-w-0">
          <h1 className="truncate font-title text-heading font-semibold" title={bank.bank_name}>
            {bank.bank_name}
          </h1>
          <p className="line-clamp-2 text-meta text-muted-foreground" title={bank.desc || undefined}>
            共 {bank.count} 题{bank.desc && ` · ${bank.desc}`}
          </p>
        </div>
      </div>
    </>
  )
}

function BankSummarySkeleton() {
  return (
    <div aria-hidden className="flex h-full animate-pulse flex-col justify-between">
      <div className="h-5 w-24 bg-muted" />
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-2/3 bg-muted" />
          <div className="h-4 w-1/2 bg-muted" />
        </div>
      </div>
    </div>
  )
}
