import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import IconRefresh from '~icons/solar/refresh-linear'
import { CharacterSprite } from '@/components/art'
import { Comments } from '@/components/comment/Comments'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { CardSkeleton, FEED_COLUMN, FeedQuestionCard } from '@/components/feed/FeedCard'
import { FeedStage } from '@/components/feed/FeedStage'
import { FeedTopBar } from '@/components/feed/FeedTopBar'
import { LoadingBar } from '@/components/LoadingBar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { COMMENT_TARGET_QUESTION } from '@/constants/comment'
import {
  buildFeedQueue,
  useFeedPages,
  useFeedParams,
  type FeedCategory,
  type FeedItem,
  type FeedSource,
} from '@/hooks/useFeed'
import type { FeedDirection } from '@/hooks/useFeedGestures'
import { useLogin } from '@/hooks/useLogin'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import {
  markSeen,
  newRecommendSession,
  openRecommendSession,
  rebuildRecommendSession,
  saveRecommendSession,
} from '@/lib/feedSession'
import { showGuideCue } from '@/lib/guideCue'
import { cn } from '@/lib/utils'

/** 离队尾还剩这么几题时加载下一批 */
const PRELOAD_TAIL = 3
/** 刷新、打开分享链接时，最多往后翻这么多页找 URL 里的题，找不到就把它放到队首 */
const RESTORE_MAX_PAGES = 10
/** 这一轮每看完这么多道题，澜汐在提示条里庆祝一次 */
const MILESTONE_EVERY = 10
const NO_EXCLUDE: string[] = []

/**
 * 沉浸式刷题：一屏一题，上下切换（手势在 FeedStage / useFeedGestures）。
 * 「推荐」按本次访问的随机种子出题，不重复，往回翻就是浏览历史；「分类」按标签、难度、掌握状态筛选后按默认顺序刷，刷完是结束页。
 * 切换模式或分类时下面的队列组件换 key 重新挂载：队列和位置清空重建。
 * 模式、分类和当前题目都在 URL 里，刷新或打开分享链接回到同一题
 */
export function FeedPage() {
  const params = useFeedParams()
  const regionRef = useRef<HTMLDivElement>(null)

  // 页面本身不滚动：关掉整页的回弹和下拉刷新，免得手指在卡片顶部往下拉时把整个页面拽下来
  useEffect(() => {
    const root = document.documentElement
    const prev = root.style.overscrollBehavior
    root.style.overscrollBehavior = 'none'
    return () => {
      root.style.overscrollBehavior = prev
    }
  }, [])

  const { bankId, tag, difficulty, userTag } = params.category

  return (
    <div className="flex h-full flex-col">
      <FeedTopBar
        mode={params.mode}
        category={params.category}
        onModeChange={params.setMode}
        onCategoryChange={params.setCategory}
        onFocusFeed={() => regionRef.current?.focus({ preventScroll: true })}
      />
      <div ref={regionRef} tabIndex={-1} className="relative min-h-0 flex-1 outline-none">
        {params.mode === 'recommend' ? (
          <RecommendFeed
            key="recommend"
            initialId={params.questionId}
            urlId={params.questionId}
            setUrlId={params.setQuestionId}
            onBrowseCategory={() => params.setMode('category')}
          />
        ) : (
          <CategoryFeed
            key={JSON.stringify([bankId, tag, difficulty, userTag])}
            category={params.category}
            initialId={params.questionId}
            urlId={params.questionId}
            setUrlId={params.setQuestionId}
            onClearCategory={() =>
              params.setCategory({
                bankId: undefined,
                tag: undefined,
                difficulty: undefined,
                userTag: undefined,
              })
            }
            onRecommend={() => params.setMode('recommend')}
          />
        )}
      </div>
    </div>
  )
}

interface UrlSync {
  /** 挂载时 URL 里的题目：刷新、分享链接从这题开始 */
  initialId?: string
  urlId?: string
  setUrlId: (id: string) => void
}

/** 推荐模式：随机种子和看过的题记在 sessionStorage（lib/feedSession），刷新后重建同一个队列 */
function RecommendFeed({
  initialId: urlInitialId,
  urlId,
  setUrlId,
  onBrowseCategory,
}: UrlSync & { onBrowseCategory: () => void }) {
  const [initialId, setInitialId] = useState(urlInitialId)
  const [session, setSession] = useState(() => openRecommendSession(urlInitialId))
  useEffect(() => saveRecommendSession(session), [session])

  const source = useMemo<FeedSource>(
    () => ({ mode: 'recommend', seed: session.seed }),
    [session.seed]
  )

  return (
    <FeedQueue
      // 重新开始换了种子：位置从头算
      key={session.seed}
      source={source}
      exclude={session.exclude}
      anchor={session.anchor}
      initialId={initialId}
      urlId={urlId}
      setUrlId={setUrlId}
      onMissing={id => setSession(s => rebuildRecommendSession(s, id))}
      onView={id => setSession(s => markSeen(s, id))}
      renderEnd={({ count }) => (
        <EmptyState
          pose="explain"
          title={count > 0 ? '这次访问的题目都刷完了' : '这次访问的题目都看过了'}
          hint={count > 0 ? `这一轮刷了 ${count} 题` : '可以重新开始一轮，或者按分类刷'}
          className="border-0"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => {
                  setInitialId(undefined)
                  setSession(newRecommendSession())
                }}
              >
                <IconRefresh />
                重新开始
              </Button>
              <Button variant="outline" onClick={onBrowseCategory}>
                按分类刷题
              </Button>
            </div>
          }
        />
      )}
      positionLabel={index => `第 ${index + 1} 题`}
    />
  )
}

/** 分类模式：按条件取题、默认顺序；URL 里的题不在这个分类里时放到第一道 */
function CategoryFeed({
  category,
  initialId: urlInitialId,
  urlId,
  setUrlId,
  onClearCategory,
  onRecommend,
}: UrlSync & {
  category: FeedCategory
  onClearCategory: () => void
  onRecommend: () => void
}) {
  const [initialId] = useState(urlInitialId)
  const [anchor, setAnchor] = useState<string>()
  const source = useMemo<FeedSource>(() => ({ mode: 'category', ...category }), [category])
  const filtered = Object.values(category).some(v => v !== undefined)

  return (
    <FeedQueue
      source={source}
      exclude={NO_EXCLUDE}
      anchor={anchor}
      initialId={initialId}
      urlId={urlId}
      setUrlId={setUrlId}
      onMissing={setAnchor}
      renderEnd={({ count, total, restart }) =>
        count === 0 ? (
          <EmptyState
            pose="thinking"
            title={filtered ? '没有符合条件的题目' : '这里还没有题目'}
            className="border-0"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {filtered && (
                  <Button variant="outline" onClick={onClearCategory}>
                    清除筛选
                  </Button>
                )}
                <Button variant="outline" onClick={onRecommend}>
                  去推荐
                </Button>
              </div>
            }
          />
        ) : (
          <EmptyState
            pose="explain"
            title={filtered ? '这个分类刷完了' : '全部题目刷完了'}
            hint={`共 ${total} 题`}
            className="border-0"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={restart}>
                  <IconRefresh />
                  从第一题再刷一遍
                </Button>
                <Button variant="outline" onClick={onRecommend}>
                  去推荐
                </Button>
              </div>
            }
          />
        )
      }
      positionLabel={(index, total) => `${index + 1} / ${total}`}
    />
  )
}

/** 位置：一般记题目 ID，队列变了（登录后重新拉取、把找不到的题放到队首）也停在同一题；在队尾那张卡片上时记序号 */
type Position = { id: string } | { index: number }

/**
 * 题目队列 + 舞台。队列是分页数据拼起来的（buildFeedQueue），最后多一张队尾卡片：
 * 下一批还在加载时是加载中，加载失败是重试，没有更多了是结束页。
 * - 预加载：舞台挂着当前题前后各 2 张卡片，详情跟着加载；离队尾还剩 PRELOAD_TAIL 题时取下一批
 * - 找回位置：URL 里的题不在已加载的队列里就往后翻页找，翻 RESTORE_MAX_PAGES 页还没有，交给 onMissing 放到队首
 * - 当前题写回 URL；onView 在每次换到一道题时调用（推荐模式记「看过」）
 * - 里程碑：这一轮（这个队列挂载以来）每看完 MILESTONE_EVERY 道不同的题，澜汐庆祝一次。离开一道题才算看完，
 *   来回翻同一道不重复算；每次切题不播任何角色动作
 */
function FeedQueue({
  source,
  exclude,
  anchor,
  initialId,
  urlId,
  setUrlId,
  onMissing,
  onView,
  renderEnd,
  positionLabel,
}: UrlSync & {
  source: FeedSource
  exclude: readonly string[]
  anchor?: string
  onMissing: (id: string) => void
  onView?: (id: string) => void
  renderEnd: (info: { count: number; total: number; restart: () => void }) => ReactNode
  positionLabel: (index: number, total: number) => string
}) {
  const pages = useFeedPages(source)
  const { showLoginDialog } = useLogin()
  const isDesktop = useIsDesktop()
  const queue = useMemo(
    () => buildFeedQueue(pages.data?.pages, exclude, anchor),
    [pages.data, exclude, anchor]
  )
  // 题目总数取后端的 total；放到队首的题不在这个分类里时，队列会比 total 多一道
  const total = Math.max(queue.length, pages.data?.pages[0]?.total ?? 0)

  const [position, setPosition] = useState<Position>(() =>
    initialId ? { id: initialId } : { index: 0 }
  )
  const [commentsFor, setCommentsFor] = useState<string | null>(null)

  const found =
    'id' in position
      ? queue.findIndex(item => item.question_id === position.id)
      : Math.min(position.index, queue.length)
  const searching = 'id' in position && found === -1
  const index = Math.max(found, 0)
  const current: FeedItem | undefined = searching ? undefined : queue[index]
  const loadedPages = pages.data?.pages.length ?? 0

  // 队尾卡片上等到了下一批：位置改记成那道题的 ID
  useEffect(() => {
    if ('index' in position && position.index < queue.length) {
      setPosition({ id: queue[position.index].question_id })
    }
  }, [position, queue])

  // 找回位置：往后翻页找 URL 里的题，翻完或到上限还没有就放到队首
  useEffect(() => {
    if (!searching || !pages.data || pages.isFetching || pages.isFetchNextPageError) return
    if (pages.hasNextPage && loadedPages < RESTORE_MAX_PAGES) {
      void pages.fetchNextPage()
      return
    }
    onMissing(position.id)
    // onMissing 每次渲染是新函数，只在查找状态变化时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, pages.data, pages.isFetching, pages.isFetchNextPageError, pages.hasNextPage])

  // 快到队尾：取下一批
  useEffect(() => {
    if (searching || !pages.hasNextPage || pages.isFetching || pages.isFetchNextPageError) return
    if (index >= queue.length - PRELOAD_TAIL) void pages.fetchNextPage()
  }, [searching, index, queue.length, pages])

  // 当前题写回 URL，记「看过」；离开的那道算看完，满 MILESTONE_EVERY 道庆祝
  const currentId = current?.question_id
  const leftId = useRef<string>()
  const finished = useRef(new Set<string>())
  useEffect(() => {
    if (!currentId) return
    if (currentId !== urlId) setUrlId(currentId)
    onView?.(currentId)
    const left = leftId.current
    leftId.current = currentId
    if (!left || left === currentId || finished.current.has(left)) return
    finished.current.add(left)
    const n = finished.current.size
    if (n % MILESTONE_EVERY === 0) showGuideCue('celebrate', `这一轮已经刷完 ${n} 题，继续保持`)
    // 只在换题时执行；urlId 跟着这里变，不用依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  const goTo = useCallback(
    (next: number) =>
      setPosition(next < queue.length ? { id: queue[next].question_id } : { index: next }),
    [queue]
  )

  // 出错后点重试，请求成功之前查询一直是出错状态；正在重新请求时按加载中显示
  const nextPageFailed = pages.isFetchNextPageError && !pages.isFetchingNextPage
  const firstPageFailed = pages.isError && !pages.data && !pages.isFetching
  if (firstPageFailed || (searching && nextPageFailed)) {
    return (
      <div className={cn(FEED_COLUMN, 'pt-6')}>
        <ErrorState
          message={pages.error?.message ?? '网络错误'}
          onRetry={() => (pages.data ? pages.fetchNextPage() : pages.refetch())}
          withArt
        />
      </div>
    )
  }
  if (!pages.data || searching) {
    return (
      <div className={cn(FEED_COLUMN, 'pt-6')}>
        <CardSkeleton />
        <p className="sr-only" role="status">
          {searching ? '正在回到上次看的题目' : '题目加载中'}
        </p>
      </div>
    )
  }

  // 下一批加载失败后点了重试、请求还没回来：出错状态留在屏幕上，澜汐循环修理
  const retryingNextPage = pages.isFetchNextPageError && pages.isFetchingNextPage
  const tailState: TailState = nextPageFailed
    ? 'error'
    : retryingNextPage
      ? 'retrying'
      : pages.hasNextPage
        ? 'loading'
        : 'end'
  const count = queue.length + 1

  function edgeHint(dir: FeedDirection) {
    if (dir === -1) return '已经是第一题了'
    if (tailState === 'loading') return '下一批题目正在加载'
    if (tailState === 'error') return '下一批题目加载失败，点重试'
    if (tailState === 'retrying') return '正在重新加载下一批题目'
    return queue.length > 0 ? '已经到底了' : '没有更多题目了'
  }

  return (
    <>
      <FeedStage
        count={count}
        index={index}
        onIndexChange={goTo}
        slideKey={i => (i < queue.length ? queue[i].question_id : 'tail')}
        renderSlide={(i, active) =>
          i < queue.length ? (
            <FeedQuestionCard
              item={queue[i]}
              active={active}
              position={positionLabel(i, total)}
              onOpenComments={setCommentsFor}
            />
          ) : (
            <TailCard
              state={tailState}
              message={pages.error?.message}
              onRetry={() => pages.fetchNextPage()}
              end={renderEnd({ count: queue.length, total, restart: () => goTo(0) })}
            />
          )
        }
        edgeHint={edgeHint}
        enabled={!commentsFor && !showLoginDialog}
      >
        {/* 下一批题目加载中：模式栏底边线下面走加载条 */}
        {pages.isFetchingNextPage && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px">
            <LoadingBar label="正在加载下一批题目" />
          </div>
        )}
        {/* 读屏念出换到了哪一题 */}
        <p className="sr-only" aria-live="polite">
          {current
            ? `${positionLabel(index, total)}${current.title ? `：${current.title}` : ''}`
            : ''}
        </p>
      </FeedStage>

      <Sheet open={!!commentsFor} onOpenChange={open => !open && setCommentsFor(null)}>
        <SheetContent
          side={isDesktop ? 'right' : 'bottom'}
          aria-describedby={undefined}
          className={cn(
            'flex flex-col overflow-y-auto overscroll-contain p-4 pt-10 md:p-6 md:pt-12',
            isDesktop ? 'w-[440px] sm:max-w-[440px]' : 'h-[75dvh]'
          )}
        >
          <SheetTitle className="sr-only">题目评论</SheetTitle>
          {commentsFor && (
            <Comments
              key={commentsFor}
              targetType={COMMENT_TARGET_QUESTION}
              targetId={commentsFor}
              className="border-t-0 pt-0"
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

type TailState = 'loading' | 'error' | 'retrying' | 'end'

/**
 * 队尾卡片：加载中 / 加载失败 / 重试中 / 结束页。
 * 加载中澜汐托腮思考、重试中拿扳手修理，都是循环动作，只在这张卡片是这个状态时挂着，请求结束就换掉
 */
function TailCard({
  state,
  message,
  onRetry,
  end,
}: {
  state: TailState
  message?: string
  onRetry: () => void
  end: ReactNode
}) {
  return (
    <div className="h-full overflow-y-auto overscroll-none" data-feed-scroller>
      <div className={cn(FEED_COLUMN, 'flex min-h-full flex-col justify-center py-6')}>
        {state === 'loading' && (
          <div>
            <CardSkeleton />
            <div className="mt-4 flex items-center justify-center gap-3">
              <CharacterSprite name="thinking" size={64} />
              <p role="status" className="text-meta text-muted-foreground">
                正在加载下一批题目…
              </p>
            </div>
          </div>
        )}
        {(state === 'error' || state === 'retrying') && (
          <ErrorState
            message={message ?? '网络错误'}
            onRetry={onRetry}
            withArt
            retrying={state === 'retrying'}
          />
        )}
        {state === 'end' && end}
      </div>
    </div>
  )
}
