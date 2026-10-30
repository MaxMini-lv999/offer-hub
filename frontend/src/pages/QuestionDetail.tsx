import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import IconChevronLeft from '~icons/solar/alt-arrow-left-linear'
import IconChevronRight from '~icons/solar/alt-arrow-right-linear'
import IconClock from '~icons/solar/clock-circle-linear'
import IconEye from '~icons/solar/eye-linear'
import IconFileText from '~icons/solar/file-text-linear'
import IconMenu from '~icons/solar/hamburger-menu-linear'
import IconAcademicCap from '~icons/solar/square-academic-cap-linear'
import IconThumbsUp from '~icons/solar/like-linear'
import { DifficultyLabel } from '@/components/DifficultyLabel'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { InterviewMode } from '@/components/InterviewMode'
import { Markdown } from '@/components/Markdown'
import { QuestionNav, QuestionNavSkeleton } from '@/components/QuestionNav'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { GUEST_CONTENT_LIMIT } from '@/constants/question'
import { useLogin } from '@/hooks/useLogin'
import { useNeighbors } from '@/hooks/useNeighbors'
import { useQuestionDetail } from '@/hooks/useQuestionQueries'
import { MASTERY_LABELS, recordVisit, useProgress } from '@/lib/progress'
import { ApiError } from '@/lib/request'
import { cn } from '@/lib/utils'
import type { Question } from '@/types/question'
import { bankPath, questionPath } from '@/utils/route'

/**
 * 题目详情，两种模式，用 URL 的 mode 参数切换：
 * 阅读模式（默认）是左侧题目栏（桌面端固定 280px，手机端收进抽屉）+ 右侧正文；
 * 模拟面试模式（mode=interview）是 VN 舞台，面试官念题、逐段讲解析。
 * 切题只改 URL 里的 questionId，这个组件和左侧题目栏都不重新挂载
 */
export function QuestionDetailPage() {
  const { questionId = '' } = useParams<{ questionId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const interview = searchParams.get('mode') === 'interview'
  const { data: question, isPending, isError, error, refetch } = useQuestionDetail(questionId)
  const { isLoggedIn } = useLogin()

  // 左侧题目栏的搜索词放在这里：手机端抽屉关掉再打开，搜索词还在
  const [navKeyword, setNavKeyword] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 优先用 URL 里的 bankId；没带（如从热门题目进来）或题目不属于它时，用题目所属的第一个题库
  const urlBankId = searchParams.get('bankId') ?? ''
  const bankId = question && !question.bank_list.includes(urlBankId) ? (question.bank_list[0] ?? '') : urlBankId

  // 后端题目不存在（含隐藏、删除）时返回 HTTP 200 + code 400
  const notFound = isError && error instanceof ApiError && error.code === 400
  // 游客拿到的 content 被后端截断到 150 字；满 150 字说明后面还有内容。在弹窗里登录后遮罩当场消失
  const truncated = !!question && !isLoggedIn && [...question.content].length >= GUEST_CONTENT_LIMIT

  // 记进本机的「最近浏览」，首页「继续上次」用
  useEffect(() => {
    if (question) recordVisit({ id: question.question_id, title: question.title, bankId: bankId || undefined })
  }, [question, bankId])

  function setInterview(on: boolean) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (on) next.set('mode', 'interview')
        else next.delete('mode')
        return next
      },
      { preventScrollReset: true },
    )
  }

  const notFoundState = notFound && (
    <EmptyState
      icon={<IconFileText className="size-8" />}
      title="题目不存在或已下线"
      action={
        <Button variant="outline" size="sm" asChild>
          <Link to={bankId ? bankPath(bankId) : '/'}>{bankId ? '返回题库' : '返回首页'}</Link>
        </Button>
      }
    />
  )
  const errorState = isError && !notFound && <ErrorState message={error.message} onRetry={() => refetch()} />

  if (interview) {
    return (
      <>
        {isPending && <div aria-hidden className="h-[calc(100dvh-13rem)] min-h-[460px] skeleton border bg-skeleton" />}
        {notFoundState}
        {errorState}
        {question && (
          <InterviewMode
            key={question.question_id}
            question={question}
            bankId={bankId}
            truncated={truncated}
            onExit={() => setInterview(false)}
          />
        )}
      </>
    )
  }

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
        icon={<IconFileText className="size-8" />}
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
                <IconMenu className="size-4" />
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

        {notFoundState}
        {errorState}

        {question && (
          <QuestionArticle
            question={question}
            bankId={bankId}
            truncated={truncated}
            onInterview={() => setInterview(true)}
          />
        )}
      </div>
    </div>
  )
}

function QuestionArticle({
  question,
  bankId,
  truncated,
  onInterview,
}: {
  question: Question
  bankId: string
  /** 内容被截断时加渐隐遮罩和登录入口 */
  truncated: boolean
  onInterview: () => void
}) {
  const { mastery } = useProgress()
  const mark = mastery[question.question_id]
  const { setShowLoginDialog } = useLogin()

  return (
    <article className="max-w-[72ch]">
      <header className="border-b pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <h1 className="font-title text-title font-semibold">{question.title}</h1>
          <Button variant="outline" onClick={onInterview} className="shrink-0 self-start">
            <IconAcademicCap />
            模拟面试
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-muted-foreground">
          <DifficultyLabel difficulty={question.difficulty} />
          {mark && <span className="border border-brand px-2 text-brand">本机标记：{MASTERY_LABELS[mark]}</span>}
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
            <IconEye className="size-3.5" />
            {question.view_count} 浏览
          </span>
          <span className="inline-flex items-center gap-1">
            <IconThumbsUp className="size-3.5" />
            {question.thumbs_up_count} 点赞
          </span>
          <span className="inline-flex items-center gap-1">
            <IconClock className="size-3.5" />
            {question.create_time}
          </span>
        </div>
      </header>

      {/* 游客遮罩高 200px，绝对定位叠在正文底部：下面 120px 是给按钮留的空白，
          渐变在上面 80px 内从透明变到背景色，只盖住正文最后约 3 行，不然游客能看的 150 字会被淡掉一大半 */}
      <div className={cn('relative mt-6', truncated && 'pb-[120px]')}>
        <Markdown content={question.content} />
        {truncated && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[200px] max-h-full items-end justify-center bg-gradient-to-b from-background/0 to-background to-40% pb-10">
            <Button className="pointer-events-auto" onClick={() => setShowLoginDialog(true)}>
              登录后查看完整内容
            </Button>
          </div>
        )}
      </div>

      {bankId && <PrevNextNav bankId={bankId} currentId={question.question_id} />}
    </article>
  )
}

/** 上一题 / 下一题，按题库内的默认顺序 */
function PrevNextNav({ bankId, currentId }: { bankId: string; currentId: string }) {
  const { found, prev, next } = useNeighbors(bankId, currentId)
  if (!found) return null

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
      {direction === 'prev' && <IconChevronLeft className="size-3.5" />}
      {label}
      {direction === 'next' && <IconChevronRight className="size-3.5" />}
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
    <div aria-hidden className="max-w-[72ch] skeleton">
      <div className="border-b pb-4">
        <div className="h-9 w-2/3 bg-skeleton" />
        <div className="mt-3 flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-5 w-16 bg-skeleton" />
          ))}
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {['w-full', 'w-full', 'w-5/6', 'w-full', 'w-2/3', 'w-full', 'w-3/4'].map((width, i) => (
          <div key={i} className={cn('h-4 bg-skeleton', width)} />
        ))}
      </div>
    </div>
  )
}
