import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { FileText, SearchStatus } from 'reicon-react'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { SearchBox } from '@/components/SearchBox'
import { Button } from '@/components/ui/button'
import { useBankInfo, useBankQuestionList } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'
import { bankPath, questionPath } from '@/utils/route'

/**
 * 详情页左侧题目栏：当前题库的题目（只有 ID 和标题），支持搜索，高亮当前题目并滚动到它的位置，滚到底自动加载下一页。
 * 切题时只有 currentId 变，组件不重新挂载，列表、滚动位置都保持不变；搜索词由父组件保存，手机端抽屉关了再开也还在
 */
export function QuestionNav({
  bankId,
  currentId,
  keyword,
  onKeywordChange,
  onNavigate,
  className,
}: {
  bankId: string
  currentId: string
  keyword: string
  onKeywordChange: (keyword: string) => void
  /** 点了题目或题库链接之后的回调，手机端用来关抽屉 */
  onNavigate?: () => void
  className?: string
}) {
  const { data: bankInfo } = useBankInfo(bankId)
  const { data, isPending, isError, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useBankQuestionList(bankId, keyword)
  const list = useMemo(() => data?.pages.flatMap((page) => page.list) ?? [], [data])
  const total = data?.pages[0]?.total ?? 0

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLLIElement>(null)
  const scrolledIdRef = useRef<string>()

  // 当前题目不在可视区域时滚到中间；已经看得见就不动，所以点左侧切题时滚动位置保持不变。
  // 每道题只自动滚一次，否则往下翻加载出新一页时会被拽回当前题目
  useEffect(() => {
    const container = scrollRef.current
    if (!container || container.clientHeight === 0 || scrolledIdRef.current === currentId) return
    const item = container.querySelector<HTMLElement>(`[data-question-id="${CSS.escape(currentId)}"]`)
    if (!item) return

    scrolledIdRef.current = currentId
    const box = container.getBoundingClientRect()
    const rect = item.getBoundingClientRect()
    if (rect.top < box.top || rect.bottom > box.bottom) {
      container.scrollTop += rect.top - box.top - (box.height - rect.height) / 2
    }
  }, [currentId, list])

  // 列表底部的哨兵进入可视区域（提前 200px）时加载下一页
  useEffect(() => {
    const root = scrollRef.current
    const target = sentinelRef.current
    if (!root || !target || !hasNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage()
      },
      { root, rootMargin: '200px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <nav aria-label="题目列表" className={cn('flex h-full min-h-0 flex-col border border-foreground', className)}>
      <div className="space-y-3 border-b p-4">
        <div className="flex items-baseline justify-between gap-2">
          <Link
            to={bankPath(bankId)}
            onClick={onNavigate}
            className="truncate font-semibold decoration-2 underline-offset-4 hover:underline"
          >
            {bankInfo?.bank.bank_name ?? '题目列表'}
          </Link>
          {data && (
            <span className="shrink-0 text-meta text-muted-foreground">
              {keyword ? `匹配 ${total} 题` : `共 ${total} 题`}
            </span>
          )}
        </div>
        <SearchBox value={keyword} onSearch={onKeywordChange} placeholder="搜索本题库" />
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {isPending && <NavListSkeleton />}

        {isError && <ErrorState message={error.message} onRetry={() => refetch()} className="border-0" />}

        {data && list.length === 0 && (
          <EmptyState
            icon={keyword ? <SearchStatus size={32} /> : <FileText size={32} />}
            title={keyword ? '没有匹配的题目' : '这个题库还没有题目'}
            className="border-0"
            action={
              keyword ? (
                <Button variant="outline" size="sm" onClick={() => onKeywordChange('')}>
                  清除搜索
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/">返回首页</Link>
                </Button>
              )
            }
          />
        )}

        {list.length > 0 && (
          <ol className="py-2">
            {list.map((q, index) => {
              const active = q.question_id === currentId
              return (
                <li key={q.question_id} data-question-id={q.question_id}>
                  <Link
                    to={questionPath(q.question_id, bankId)}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-baseline gap-3 px-4 py-2 transition-colors',
                      active ? 'bg-foreground text-background' : 'hover:bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'w-6 shrink-0 text-right text-meta tabular-nums',
                        active ? 'text-background/70' : 'text-muted-foreground',
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="line-clamp-2 min-w-0">{q.title}</span>
                  </Link>
                </li>
              )
            })}
            {hasNextPage && (
              <li ref={sentinelRef} className="px-4 py-2 text-meta text-muted-foreground">
                {isFetchingNextPage ? '加载中…' : '下拉加载更多'}
              </li>
            )}
          </ol>
        )}
      </div>
    </nav>
  )
}

/** 题目还没加载出来、不知道属于哪个题库时的占位，形状和题目栏一致 */
export function QuestionNavSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex h-full min-h-0 flex-col border', className)}>
      <div className="skeleton space-y-3 border-b p-4">
        <div className="flex justify-between">
          <div className="h-6 w-28 bg-skeleton" />
          <div className="h-5 w-12 bg-skeleton" />
        </div>
        <div className="h-9 bg-skeleton" />
      </div>
      <NavListSkeleton />
    </div>
  )
}

function NavListSkeleton() {
  return (
    <div aria-hidden className="skeleton py-2">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="flex gap-3 px-4 py-2">
          <div className="h-6 w-6 shrink-0 bg-skeleton" />
          <div className={cn('h-6 bg-skeleton', i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-4/5' : 'w-3/5')} />
        </div>
      ))}
    </div>
  )
}
