import { Link, useParams } from 'react-router-dom'
import { BankLogo } from '@/components/BankLogo'
import { ErrorState } from '@/components/EmptyState'
import { HotContent } from '@/components/HotContent'
import { QuestionList } from '@/components/QuestionList'
import { useBankInfo } from '@/hooks/useQuestionQueries'
import type { QuestionBank } from '@/types/question'
import { NotFoundPage } from '@/pages/not-found'

/** 题库页：头部题库信息，左边题目列表，右边（手机端在下方）当前职位方向的热门题目 */
export function QuestionBankPage() {
  const { bankId = '' } = useParams<{ bankId: string }>()
  // 题库信息和职位方向从题库全量列表里查（/hot/list 不支持 bank_id，只能按职位方向过滤）
  const { data: info, isPending, isError, error, refetch } = useBankInfo(bankId)

  // 全量列表加载完了却找不到这个题库
  if (info === null) return <NotFoundPage />

  return (
    <div className="space-y-8">
      {isPending && <BankHeaderSkeleton />}
      {isError && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {info && <BankHeader bank={info.bank} jobName={info.jobName} />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <QuestionList bankId={bankId} />
        <aside>
          <HotContent jobName={info?.jobName} bankId={bankId} enabled={!!info} />
        </aside>
      </div>
    </div>
  )
}

function BankHeader({ bank, jobName }: { bank: QuestionBank; jobName: string }) {
  return (
    <header className="space-y-4 border-b pb-8">
      <nav aria-label="面包屑" className="flex gap-2 text-meta text-muted-foreground">
        <Link to="/" className="decoration-2 underline-offset-4 hover:text-foreground hover:underline">
          首页
        </Link>
        <span aria-hidden>/</span>
        <Link
          to={{ pathname: '/', search: `?job=${encodeURIComponent(jobName)}` }}
          className="decoration-2 underline-offset-4 hover:text-foreground hover:underline"
        >
          {jobName}
        </Link>
      </nav>
      <div className="flex items-start gap-4">
        <BankLogo name={bank.bank_name} className="h-14 w-14" />
        <div className="min-w-0 space-y-1">
          <h1 className="text-title font-semibold">{bank.bank_name}</h1>
          {bank.desc && <p className="text-muted-foreground">{bank.desc}</p>}
          <p className="text-meta text-muted-foreground">共 {bank.count} 题</p>
        </div>
      </div>
    </header>
  )
}

function BankHeaderSkeleton() {
  return (
    <div aria-hidden className="animate-pulse space-y-4 border-b pb-8">
      <div className="h-5 w-32 bg-muted" />
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 shrink-0 bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-9 w-48 bg-muted" />
          <div className="h-6 w-2/3 bg-muted" />
          <div className="h-5 w-16 bg-muted" />
        </div>
      </div>
    </div>
  )
}
