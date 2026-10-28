import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock, Eye, FileText, Menu, ThumbsUp } from 'reicon-react'
import { DifficultyLabel } from '@/components/DifficultyLabel'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Markdown } from '@/components/Markdown'
import { QuestionNav, QuestionNavSkeleton } from '@/components/QuestionNav'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { GUEST_CONTENT_LIMIT } from '@/constants/question'
import { useBankQuestionList, useQuestionDetail } from '@/hooks/useQuestionQueries'
import { hasToken } from '@/lib/axios'
import { ApiError } from '@/lib/request'
import { cn } from '@/lib/utils'
import type { Question } from '@/types/question'
import { bankPath, questionPath } from '@/utils/route'

/**
 * 题目详情：左侧题目栏（桌面端固定 280px，手机端收进抽屉）+ 右侧正文。
 * 切题只改 URL 里的 questionId，这个组件和左侧题目栏都不重新挂载
 */
export function QuestionDetailPage() {
  const { questionId = '' } = useParams<{ questionId: string }>()
  const [searchParams] = useSearchParams()
  const { data: question, isPending, isError, error, refetch } = useQuestionDetail(questionId)

  // 左侧题目栏的搜索词放在这里：手机端抽屉关掉再打开，搜索词还在
  const [navKeyword, setNavKeyword] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 优先用 URL 里的 bankId；没带（如从热门题目进来）或题目不属于它时，用题目所属的第一个题库
  const urlBankId = searchParams.get('bankId') ?? ''
  const bankId = question && !question.bank_list.includes(urlBankId) ? (question.bank_list[0] ?? '') : urlBankId

  // 后端题目不存在（含隐藏、删除）时返回 HTTP 200 + code 400
  const notFound = isError && error instanceof ApiError && error.code === 400

  function renderNav(className?: string, onNavigate?: () => void) {
    if (bankId) {
      return (
        <QuestionNav
          bankId={bankId}
          currentId={questionId}
          keyword={navKeyword}
          onKeywordChange={setNavKeyword}
          onNavigate={onNavigate}
          className={className}
        />
      )
    }
    // 还不知道属于哪个题库：题目加载中先放骨架，加载完仍然没有（题目不存在、URL 也没带）就给个入口
    if (isPending) return <QuestionNavSkeleton className={className} />
    return (
      <EmptyState
        icon={<FileText size={32} />}
        title="没有可显示的题目列表"
        className={cn('h-full justify-center', className)}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/">浏览题库</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* 吸顶在导航栏（56px）+ 内容区上边距（32px）下面，高度占满剩余视口，内部单独滚动 */}
      <aside className="sticky top-[88px] hidden h-[calc(100vh-120px)] lg:block">{renderNav()}</aside>

      <div className="min-w-0">
        <div className="mb-6 lg:hidden">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Menu size={16} />
                题目列表
              </Button>
            </SheetTrigger>
            <SheetContent side="left" aria-describedby={undefined} className="flex w-[300px] max-w-[85vw] flex-col p-0 pt-12">
              <SheetTitle className="sr-only">题目列表</SheetTitle>
              {renderNav('border-0 border-t', () => setDrawerOpen(false))}
            </SheetContent>
          </Sheet>
        </div>

        {isPending && <DetailSkeleton />}

        {notFound && (
          <EmptyState
            icon={<FileText size={32} />}
            title="题目不存在或已下线"
            action={
              <Button variant="outline" size="sm" asChild>
                <Link to={bankId ? bankPath(bankId) : '/'}>{bankId ? '返回题库' : '返回首页'}</Link>
              </Button>
            }
          />
        )}

        {isError && !notFound && <ErrorState message={error.message} onRetry={() => refetch()} />}

        {question && <QuestionArticle question={question} bankId={bankId} />}
      </div>
    </div>
  )
}

function QuestionArticle({ question, bankId }: { question: Question; bankId: string }) {
  // 游客拿到的 content 被后端截断到 150 字；满 150 字说明后面还有内容，加渐隐遮罩和登录入口
  const truncated = !hasToken() && [...question.content].length >= GUEST_CONTENT_LIMIT

  return (
    <article className="max-w-[72ch]">
      <header className="border-b pb-4">
        <h1 className="text-title font-semibold">{question.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-muted-foreground">
          <DifficultyLabel difficulty={question.difficulty} />
          {question.tags.length > 0 && (
            <span className="flex flex-wrap gap-2">
              {question.tags.map((tag) => (
                <span key={tag} className="border px-2">
                  {tag}
                </span>
              ))}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Eye size={14} />
            {question.view_count} 浏览
          </span>
          <span className="inline-flex items-center gap-1">
            <ThumbsUp size={14} />
            {question.thumbs_up_count} 点赞
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={14} />
            {question.create_time}
          </span>
        </div>
      </header>

      <div className="relative mt-6">
        <Markdown content={question.content} />
        {/* 遮住最后三行：3 × 行高 1.7em */}
        {truncated && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[5.1em] bg-gradient-to-b from-background/0 to-background"
          />
        )}
      </div>

      {truncated && (
        <div className="mt-6 flex justify-center">
          <Button asChild>
            <Link to="/login">登录后查看完整内容</Link>
          </Button>
        </div>
      )}

      {bankId && <PrevNextNav bankId={bankId} currentId={question.question_id} />}
    </article>
  )
}

/** 上一题 / 下一题，按题库内的默认顺序；和左侧题目栏（未搜索时）共用同一份数据 */
function PrevNextNav({ bankId, currentId }: { bankId: string; currentId: string }) {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useBankQuestionList(bankId)
  const list = data?.pages.flatMap((page) => page.list) ?? []
  const index = list.findIndex((q) => q.question_id === currentId)

  // 当前题目排在已加载的页之后（题库超过 100 题）时，接着取下一页直到找到它
  useEffect(() => {
    if (data && index === -1 && hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [data, index, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (index === -1) return null
  const prev = list[index - 1]
  const next = list[index + 1]

  return (
    <nav aria-label="上一题和下一题" className="mt-12 grid grid-cols-2 gap-4 border-t pt-6">
      <NeighborLink label="上一题" direction="prev" bankId={bankId} question={prev} />
      <NeighborLink label="下一题" direction="next" bankId={bankId} question={next} />
    </nav>
  )
}

function NeighborLink({
  label,
  direction,
  bankId,
  question,
}: {
  label: string
  direction: 'prev' | 'next'
  bankId: string
  question?: { question_id: string; title: string }
}) {
  const align = direction === 'next' && 'items-end text-right'
  const caption = (
    <span className="inline-flex items-center gap-1 text-meta text-muted-foreground">
      {direction === 'prev' && <ChevronLeft size={14} />}
      {label}
      {direction === 'next' && <ChevronRight size={14} />}
    </span>
  )

  if (!question) {
    return (
      <div className={cn('flex flex-col gap-1 border p-4 opacity-40', align)}>
        {caption}
        <span>{direction === 'prev' ? '已经是第一题' : '已经是最后一题'}</span>
      </div>
    )
  }
  return (
    <Link
      to={questionPath(question.question_id, bankId)}
      className={cn('flex min-w-0 flex-col gap-1 border p-4 transition-colors hover:border-foreground', align)}
    >
      {caption}
      <span className="line-clamp-2">{question.title}</span>
    </Link>
  )
}

/** 骨架和正文同形：标题 + 一行元信息 + 几行正文 */
function DetailSkeleton() {
  return (
    <div aria-hidden className="max-w-[72ch] animate-pulse">
      <div className="border-b pb-4">
        <div className="h-9 w-2/3 bg-muted" />
        <div className="mt-3 flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-5 w-16 bg-muted" />
          ))}
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {['w-full', 'w-full', 'w-5/6', 'w-full', 'w-2/3', 'w-full', 'w-3/4'].map((width, i) => (
          <div key={i} className={cn('h-4 bg-muted', width)} />
        ))}
      </div>
    </div>
  )
}
