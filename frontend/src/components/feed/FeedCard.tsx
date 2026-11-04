import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import IconChatRound from '~icons/solar/chat-round-linear'
import IconChecklist from '~icons/solar/checklist-minimalistic-linear'
import IconEye from '~icons/solar/eye-linear'
import IconEyeClosed from '~icons/solar/eye-closed-linear'
import IconFileText from '~icons/solar/file-text-linear'
import IconRefresh from '~icons/solar/refresh-linear'
import { GuestFade } from '@/components/auth/GuestFade'
import { DifficultyLabel } from '@/components/DifficultyLabel'
import { TagMenu } from '@/components/detail/DetailHeader'
import { LikeContent } from '@/components/LikeContent'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/button'
import {
  COMMENT_PAGE_SIZE,
  COMMENT_TARGET_QUESTION,
  SUB_COMMENT_PAGE_SIZE,
} from '@/constants/comment'
import { GUEST_CONTENT_LIMIT, USER_TAG_OPTIONS } from '@/constants/question'
import { useComments } from '@/hooks/useCommentQueries'
import type { FeedItem } from '@/hooks/useFeed'
import { SLIDE_MS } from '@/hooks/useFeedGestures'
import { useLikeEffect } from '@/hooks/useLikeEffect'
import { useLogin } from '@/hooks/useLogin'
import { useLikeQuestion, useQuestionDetail, useTagQuestion } from '@/hooks/useQuestionQueries'
import { useIsDesktop, usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { recordVisit } from '@/lib/progress'
import { ApiError } from '@/lib/request'
import { cn } from '@/lib/utils'
import type { QuestionDetail } from '@/types/question'
import { questionPath } from '@/utils/route'

/**
 * 卡片内容的列宽：手机端左右各 16px；平板以上居中、最宽 640px，右边给竖排的操作栏留出 88px，
 * 屏幕不够宽时正文先变窄，操作栏不压在正文上。顶部的模式栏用同一列宽，左右对齐
 */
export const FEED_COLUMN =
  'mx-auto w-full max-w-[640px] px-4 md:max-w-[min(640px,calc(100%-176px))] md:px-0'

/**
 * 一张题目卡片：卡片内部单独滚动（data-feed-scroller，切题手势靠它判断有没有滚到头），
 * 里面是难度、标签、标题、题干和折叠的答案；操作栏手机端在底部，平板以上竖排在正文右边。
 * 详情（完整题干、答案、点赞和掌握状态）走题目详情接口，和详情页共用缓存，前后几张卡片提前挂载时就在加载。
 * 离开这张卡片、过渡动画结束后，答案收起、滚动回到顶部，翻回来是一张新的卡片
 */
export function FeedQuestionCard({
  item,
  active,
  position,
  onOpenComments,
}: {
  item: FeedItem
  active: boolean
  /** 进度，如「第 3 题」「3 / 30」，显示在难度、标签那一行的最右边 */
  position: string
  onOpenComments: (questionId: string) => void
}) {
  const { data: question, isPending, isError, error, refetch } = useQuestionDetail(item.question_id)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const answerRef = useRef<HTMLElement>(null)
  const answerId = useId()
  const [revealed, setRevealed] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  // 离开后等过渡动画播完再收起答案、回到顶部，免得卡片还在屏幕上时内容跳一下；
  // 动画没播完又翻回来，就立刻复位
  const leftAt = useRef<number | null>(null)
  useEffect(() => {
    const reset = () => {
      setRevealed(false)
      scrollerRef.current?.scrollTo({ top: 0 })
      leftAt.current = null
    }
    if (active) {
      if (leftAt.current !== null) reset()
      return
    }
    leftAt.current = Date.now()
    const timer = window.setTimeout(reset, SLIDE_MS)
    return () => window.clearTimeout(timer)
  }, [active])

  // 记进本机的「最近浏览」，首页「继续上次」用
  useEffect(() => {
    if (active && question) {
      recordVisit({
        id: question.question_id,
        title: question.title,
        bankId: question.bank_list[0],
      })
    }
  }, [active, question])

  function toggleAnswer() {
    const next = !revealed
    setRevealed(next)
    if (!next) return
    // 展开后把答案滚到卡片顶部附近。不用 scrollIntoView：它会连带滚动外面 overflow: hidden 的舞台
    requestAnimationFrame(() => {
      const scroller = scrollerRef.current
      const answer = answerRef.current
      if (!scroller || !answer) return
      const top =
        answer.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop
      scroller.scrollTo({ top: Math.max(0, top - 16), behavior: reducedMotion ? 'auto' : 'smooth' })
    })
  }

  const notFound = isError && error instanceof ApiError && error.code === 400

  return (
    <div className="relative flex h-full flex-col">
      <div
        ref={scrollerRef}
        data-feed-scroller
        className="min-h-0 flex-1 overflow-y-auto overscroll-none"
      >
        <div className={cn(FEED_COLUMN, 'pb-10 pt-6')}>
          {isPending && <CardSkeleton title={item.title} />}
          {notFound && (
            <CardMessage
              icon={<IconFileText className="size-8" />}
              text="题目不存在或已下线，继续往下翻吧"
            />
          )}
          {isError && !notFound && (
            <CardMessage
              icon={<IconRefresh className="size-8" />}
              text={`题目加载失败：${error.message}`}
              action={
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <IconRefresh />
                  重试
                </Button>
              }
            />
          )}
          {question && (
            <QuestionBody
              question={question}
              position={position}
              revealed={revealed}
              answerId={answerId}
              answerRef={answerRef}
              onToggleAnswer={toggleAnswer}
            />
          )}
        </div>
      </div>

      <FeedActions
        question={question}
        active={active}
        revealed={revealed}
        answerId={answerId}
        onToggleAnswer={toggleAnswer}
        onOpenComments={() => onOpenComments(item.question_id)}
      />
    </div>
  )
}

function QuestionBody({
  question,
  position,
  revealed,
  answerId,
  answerRef,
  onToggleAnswer,
}: {
  question: QuestionDetail
  position: string
  revealed: boolean
  answerId: string
  answerRef: RefObject<HTMLElement>
  onToggleAnswer: () => void
}) {
  const { isLoggedIn, setShowLoginDialog } = useLogin()
  const titleId = useId()
  // 退出登录后、详情重新拉回来之前，缓存里还是登录时的状态，先按游客显示
  const userTag = isLoggedIn ? question.user_tag : 0
  const tagOption = USER_TAG_OPTIONS.find(opt => opt.value === userTag)
  // 游客拿到的题干被后端截断到 150 字，满 150 字说明后面还有
  const truncated = !isLoggedIn && [...question.content].length >= GUEST_CONTENT_LIMIT

  return (
    <article aria-labelledby={titleId}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-meta text-muted-foreground">
        <DifficultyLabel difficulty={question.difficulty} />
        {question.tags.map(tag => (
          <span key={tag} className="border px-2">
            {tag}
          </span>
        ))}
        {tagOption && (
          <span className={cn('border px-2', tagOption.className)}>{tagOption.label}</span>
        )}
        <span className="ml-auto tabular-nums">{position}</span>
      </div>

      <h2 id={titleId} className="mt-3 font-title text-heading font-semibold md:text-title">
        {question.title}
      </h2>

      {/* 和详情页一样：游客的题干底部盖一层渐隐，中间是登录按钮 */}
      <div className={cn('relative mt-4', truncated && 'pb-[120px]')}>
        <Markdown content={question.content} />
        {truncated && <GuestFade />}
      </div>

      <section ref={answerRef} aria-label="答案" className="mt-8 border-t pt-4">
        {!revealed && (
          <button
            type="button"
            onClick={onToggleAnswer}
            aria-expanded={false}
            aria-controls={answerId}
            className="flex w-full items-center justify-center gap-2 border border-dashed py-6 text-muted-foreground transition-colors duration-micro hover:border-foreground hover:text-foreground"
          >
            <IconEye className="size-4" />
            查看答案
          </button>
        )}
        <div id={answerId} hidden={!revealed}>
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-title text-heading font-semibold">答案解析</h3>
            <button
              type="button"
              onClick={onToggleAnswer}
              aria-expanded={revealed}
              aria-controls={answerId}
              className="text-meta text-muted-foreground decoration-2 underline-offset-4 hover:text-foreground hover:underline"
            >
              收起答案
            </button>
          </div>
          <div className="mt-4">
            {!isLoggedIn ? (
              <div className="flex flex-col items-start gap-3 border px-4 py-6">
                <p className="text-muted-foreground">答案只对登录用户开放。</p>
                <Button size="sm" onClick={() => setShowLoginDialog(true)}>
                  登录后查看答案
                </Button>
              </div>
            ) : question.analysis_content ? (
              <Markdown content={question.analysis_content} />
            ) : (
              <p className="border px-4 py-6 text-muted-foreground">这道题还没有解析。</p>
            )}
          </div>
        </div>
      </section>

      <p className="mt-8 flex flex-wrap items-center gap-x-3 text-meta text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <IconEye className="size-3.5" />
          {question.view_count} 浏览
        </span>
        <Link
          to={questionPath(question.question_id, question.bank_list[0])}
          className="decoration-2 underline-offset-4 hover:text-foreground hover:underline"
        >
          在详情页打开
        </Link>
      </p>
    </article>
  )
}

/**
 * 操作栏：点赞、标记掌握、评论、查看答案。手机端是卡片底部一行四格，平板以上竖排在正文右边、贴着卡片底部，
 * 格子之间 1px 分隔线。点赞乐观更新（同详情页），标记悲观更新；游客点赞、标记先打开登录弹窗。
 * 评论数只给当前这张卡片拉，和评论抽屉共用一份缓存，打开抽屉不用再等
 */
function FeedActions({
  question,
  active,
  revealed,
  answerId,
  onToggleAnswer,
  onOpenComments,
}: {
  question?: QuestionDetail
  active: boolean
  revealed: boolean
  answerId: string
  onToggleAnswer: () => void
  onOpenComments: () => void
}) {
  const { isLoggedIn, setShowLoginDialog } = useLogin()
  const isDesktop = useIsDesktop()
  const like = useLikeQuestion()
  const [likeEffect, playLikeEffect] = useLikeEffect()
  const tag = useTagQuestion()
  const comments = useComments(
    {
      target_type: COMMENT_TARGET_QUESTION,
      target_id: question?.question_id ?? '',
      page_size: COMMENT_PAGE_SIZE,
      sub_comment_size: SUB_COMMENT_PAGE_SIZE,
    },
    active
  )
  const commentTotal = comments.data?.pages[0]?.total
  const liked = isLoggedIn && !!question?.user_liked
  const userTag = isLoggedIn && question ? question.user_tag : 0
  const tagOption = USER_TAG_OPTIONS.find(opt => opt.value === userTag)

  function handleLike() {
    if (!question) return
    if (!isLoggedIn) {
      setShowLoginDialog(true)
      return
    }
    if (like.isPending) return
    playLikeEffect(!question.user_liked)
    like.mutate(question)
  }

  const actionError = like.isError
    ? `点赞失败：${like.error.message}`
    : tag.isError
      ? `标记失败：${tag.error.message}`
      : null

  const cell =
    'group flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-meta transition-colors duration-micro hover:bg-muted disabled:pointer-events-none disabled:opacity-40 md:h-16 md:w-16 md:flex-none [&_svg]:size-5'

  const tagLabel = tag.isPending ? '保存中' : (tagOption?.label ?? '标记')
  const tagContent = (
    <>
      <span className="relative inline-flex">
        <IconChecklist />
        {tagOption && (
          <span
            aria-hidden
            className={cn('absolute -right-1 -top-1 h-1.5 w-1.5', tagOption.dotClassName)}
          />
        )}
      </span>
      <span className="max-w-full truncate px-1">{tagLabel}</span>
    </>
  )

  return (
    <div className="flex-none md:absolute md:bottom-8 md:left-[min(calc(50%+336px),calc(100%-72px))]">
      {actionError && (
        <p
          role="alert"
          className="border-t bg-background px-4 py-1 text-meta md:absolute md:bottom-full md:right-0 md:mb-2 md:w-48 md:border md:px-2"
        >
          {actionError}
        </p>
      )}
      <div
        role="group"
        aria-label="题目操作"
        className="flex divide-x border-t bg-background md:flex-col md:divide-x-0 md:divide-y md:border"
      >
        <button
          type="button"
          onClick={handleLike}
          disabled={!question}
          aria-pressed={liked}
          aria-busy={like.isPending}
          aria-label={question ? `给题目点赞，当前 ${question.thumbs_up_count} 个赞` : '点赞'}
          className={cn(cell, liked && 'text-foreground')}
        >
          <LikeContent liked={liked} effect={likeEffect}>
            {question?.thumbs_up_count ?? '赞'}
          </LikeContent>
        </button>

        {isLoggedIn && question ? (
          <TagMenu
            current={userTag}
            pending={tag.isPending}
            onChange={next => tag.mutate({ question_id: question.question_id, tag: next })}
            // 竖排在右边时菜单往左弹，手机端在底部时往上弹
            side={isDesktop ? 'left' : 'top'}
            align={isDesktop ? 'end' : 'center'}
            variant="ghost"
            triggerClassName={cn(cell, 'h-14 px-0 font-normal md:h-16')}
          >
            {tagContent}
          </TagMenu>
        ) : (
          <button
            type="button"
            onClick={() => setShowLoginDialog(true)}
            disabled={!question}
            aria-label="标记掌握状态（需要登录）"
            className={cell}
          >
            {tagContent}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenComments}
          disabled={!question}
          aria-label={commentTotal !== undefined ? `评论，${commentTotal} 条` : '评论'}
          className={cell}
        >
          <IconChatRound />
          <span className="tabular-nums">{commentTotal ?? '评论'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleAnswer}
          disabled={!question}
          aria-expanded={revealed}
          aria-controls={answerId}
          className={cn(cell, revealed && 'bg-foreground text-background hover:bg-foreground/90')}
        >
          {revealed ? <IconEyeClosed /> : <IconEye />}
          <span>{revealed ? '收起' : '答案'}</span>
        </button>
      </div>
    </div>
  )
}

function CardMessage({
  icon,
  text,
  action,
}: {
  icon: ReactNode
  text: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-4 border px-4 py-12 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <p className="text-muted-foreground">{text}</p>
      {action}
    </div>
  )
}

/** 和卡片正文同形：一行难度和标签、标题（已知时直接显示）、几行题干、折叠的答案框 */
export function CardSkeleton({ title }: { title?: string }) {
  return (
    <div aria-hidden className="skeleton">
      <div className="flex gap-3 text-meta">
        <div className="h-[calc(1.5em+2px)] w-10 bg-skeleton" />
        <div className="h-[calc(1.5em+2px)] w-16 bg-skeleton" />
        <div className="h-[calc(1.5em+2px)] w-12 bg-skeleton" />
      </div>
      {title ? (
        <p className="mt-3 font-title text-heading font-semibold md:text-title">{title}</p>
      ) : (
        <div className="mt-3 text-heading md:text-title">
          <div className="h-[1.3em] w-2/3 bg-skeleton" />
        </div>
      )}
      <div className="mt-4 space-y-3">
        {['w-full', 'w-full', 'w-5/6', 'w-full', 'w-2/3', 'w-3/4'].map((width, i) => (
          <div key={i} className={cn('h-4 bg-skeleton', width)} />
        ))}
      </div>
      <div className="mt-8 border-t pt-4">
        <div className="h-[78px] bg-skeleton" />
      </div>
    </div>
  )
}
