import { useEffect } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createSearchParams, Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertCircle } from 'reicon-react'
import { Button } from '@/components/ui/button'
import { DIFFICULTY_OPTIONS } from '@/constants/question'
import { useBankQuestionList, useQuestionBanks, useQuestionDetail } from '@/hooks/useQuestionQueries'
import { ApiError } from '@/lib/request'
import { cn } from '@/lib/utils'
import type { Question } from '@/types/question'

/** 带 bank_id 的链接：侧边栏据此停在用户来的那个题库（一道题可能属于多个题库） */
function withBank(pathname: string, bankId: string) {
  return { pathname, search: createSearchParams({ bank_id: bankId }).toString() }
}

export function QuestionDetailPage() {
  const { id: questionId = '' } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { data: question, isPending, isError, error, refetch } = useQuestionDetail(questionId)

  // 优先用 URL 里的 bank_id；没带时（如从热门题目进来）用题目所属的第一个题库
  const bankId = searchParams.get('bank_id') || question?.bank_list[0] || ''

  // 从侧边栏切题时回到顶部，否则新题目会停在上一题的滚动位置
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [questionId])

  // 后端题目不存在（含隐藏、删除）时返回 HTTP 200 + code 400
  if (isError && error instanceof ApiError && error.code === 400) {
    return <QuestionNotFound bankId={bankId} />
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      {/* 窄屏时侧边栏排到正文下面 */}
      <aside className="order-last lg:order-first">
        {bankId ? <BankQuestionNav bankId={bankId} currentId={questionId} /> : isPending && <NavSkeleton />}
      </aside>

      <div className="min-w-0">
        {isPending && <DetailSkeleton />}

        {isError && (
          <div className="flex items-center gap-3 border border-destructive/40 p-4 text-sm text-destructive">
            <AlertCircle size={18} />
            <span>{error.message}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </div>
        )}

        {question && <QuestionContent question={question} />}
      </div>
    </div>
  )
}

function QuestionContent({ question }: { question: Question }) {
  const level = DIFFICULTY_OPTIONS.find((opt) => opt.value === question.difficulty)

  return (
    <article className="space-y-6">
      <header className="space-y-3 border-b pb-4">
        <h1 className="text-2xl font-bold">{question.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {level && <span className={cn('border border-current px-1.5 py-0.5', level.className)}>{level.label}</span>}
          {question.tags.map((tag) => (
            <span key={tag} className="border px-1.5 py-0.5 text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      </header>

      {/* react-markdown 默认不渲染原始 HTML，题目内容里的 <script> 等标签会被当成文本，没有 XSS 风险 */}
      <div className="prose prose-zinc max-w-none dark:prose-invert prose-pre:rounded-none prose-img:rounded-none">
        <Markdown remarkPlugins={[remarkGfm]}>{question.content}</Markdown>
      </div>
    </article>
  )
}

/** 左侧题目导航：当前题库的全部题目，高亮正在看的这道 */
function BankQuestionNav({ bankId, currentId }: { bankId: string; currentId: string }) {
  const { data, isPending, isError, error, refetch } = useBankQuestionList(bankId)

  // 题库名从题库全量列表里查，从题库页进来时已有缓存，不会多发请求
  const { data: groups } = useQuestionBanks()
  const bank = groups
    ?.flatMap((group) => group.series_list)
    .flatMap((series) => series.bank_list)
    .find((b) => b.bank_id === bankId)

  if (isPending) return <NavSkeleton />

  return (
    <nav aria-label="题目导航" className="border lg:sticky lg:top-4">
      <div className="flex items-baseline justify-between gap-2 border-b p-3">
        <Link to={withBank('/questions', bankId)} className="truncate font-semibold hover:text-primary">
          {bank?.bank_name ?? '题目列表'}
        </Link>
        {data && <span className="shrink-0 text-xs text-muted-foreground">共 {data.total} 题</span>}
      </div>

      {isError && (
        <div className="flex flex-wrap items-center gap-2 p-3 text-sm text-destructive">
          <span>{error.message}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            重试
          </Button>
        </div>
      )}

      {data && data.list.length === 0 && <p className="p-3 text-sm text-muted-foreground">暂无题目</p>}

      {data && data.list.length > 0 && (
        <ol className="py-1 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {data.list.map((q, index) => {
            const active = q.question_id === currentId
            return (
              <li key={q.question_id}>
                <Link
                  to={withBank(`/questions/${q.question_id}`, bankId)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex gap-2 border-l-2 px-3 py-2 text-sm transition-colors',
                    active
                      ? 'border-primary bg-accent font-medium text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <span className="w-5 shrink-0 text-right tabular-nums">{index + 1}</span>
                  <span className="line-clamp-2">{q.title}</span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </nav>
  )
}

function QuestionNotFound({ bankId }: { bankId: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">题目不存在</p>
      <Button asChild>
        {bankId ? <Link to={withBank('/questions', bankId)}>返回题目列表</Link> : <Link to="/collections">浏览题库</Link>}
      </Button>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-3 border-b pb-4">
        <div className="h-8 w-2/3 bg-muted" />
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-5 w-12 bg-muted" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {['w-full', 'w-full', 'w-5/6', 'w-full', 'w-2/3'].map((width, i) => (
          <div key={i} className={cn('h-4 bg-muted', width)} />
        ))}
      </div>
    </div>
  )
}

function NavSkeleton() {
  return (
    <div className="animate-pulse border">
      <div className="border-b p-3">
        <div className="h-5 w-24 bg-muted" />
      </div>
      <div className="space-y-3 p-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 bg-muted" />
        ))}
      </div>
    </div>
  )
}
