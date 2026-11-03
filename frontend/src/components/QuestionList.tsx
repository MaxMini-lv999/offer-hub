import { forwardRef, useEffect, useLayoutEffect, useRef, type FocusEvent } from 'react'
import { Link } from 'react-router-dom'
import IconChevronLeft from '~icons/solar/alt-arrow-left-linear'
import IconChevronRight from '~icons/solar/alt-arrow-right-linear'
import IconEye from '~icons/solar/eye-linear'
import IconFileText from '~icons/solar/file-text-linear'
import IconMagnifierClose from '~icons/solar/magnifier-close-linear'
import IconClose from '~icons/solar/close-linear'
import { DifficultyLabel } from '@/components/DifficultyLabel'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { LoadingBar } from '@/components/LoadingBar'
import { SearchBox } from '@/components/SearchBox'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DIFFICULTY_OPTIONS, SORT_OPTIONS, USER_TAG_OPTIONS } from '@/constants/question'
import { useLogin } from '@/hooks/useLogin'
import { PAGE_SIZE, type QuestionFilterState } from '@/hooks/useQuestionFilters'
import { useQuestionList } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'
import type { Difficulty, Question, UserTag } from '@/types/question'
import { questionPath } from '@/utils/route'

/** 吸顶导航栏的高度（layout.tsx 里的 h-14） */
const NAV_HEIGHT = 56

/**
 * 题库页和全部题目页的主栏：吸顶筛选栏 + 题目列表。筛选栏的墨线底边同时是列表的顶边，像表格的表头。
 * 筛选栏高度会变（手机端两行、选了标签多一行），用 ResizeObserver 量出来，把「导航栏 + 筛选栏」的高度写进 --list-offset，
 * 列表靠它决定翻页、改条件、Tab 聚焦时滚到哪里，保证内容不被吸顶的两条栏挡住
 */
export function QuestionWorkbench({ bankId, filters }: { bankId?: string; filters: QuestionFilterState }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLElement>(null)
  // 和列表组件同一个查询：改条件或翻页后、新数据回来前，旧列表还在，筛选栏底边出加载条
  const { isPlaceholderData } = useQuestionList(filters.query)

  useLayoutEffect(() => {
    const root = rootRef.current
    const bar = barRef.current
    if (!root || !bar) return
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--list-offset', `${NAV_HEIGHT + bar.offsetHeight}px`)
    })
    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={rootRef} className="min-w-0">
      <QuestionFilterBar ref={barRef} filters={filters} loading={isPlaceholderData} />
      <QuestionResults bankId={bankId} filters={filters} />
    </div>
  )
}

/**
 * 筛选栏：吸顶在导航栏下面，滚到列表中间也能改条件。平板以上搜索框、难度、排序排一行，手机端搜索框单独一行；
 * 登录后多一个掌握状态下拉，控件变多，≥1280px 才和搜索框排一行，手机端难度单独一行、掌握状态和排序并排。
 * 选了标签时多一行已选标签，可以单个移除或全部清除。loading 时墨线底边变成加载条
 */
export const QuestionFilterBar = forwardRef<HTMLElement, { filters: QuestionFilterState; loading?: boolean }>(function QuestionFilterBar(
  { filters, loading = false },
  ref,
) {
  const { isLoggedIn } = useLogin()

  return (
    // 吸顶位置比导航栏底边高 1px、藏在导航栏下面：题目行高是半像素，滚到某些位置时两条栏之间会漏出列表的墨线边框
    <section
      ref={ref}
      aria-label="筛选题目"
      className="sticky top-[55px] z-30 space-y-2 border-b border-foreground bg-background py-3"
    >
      <div className={cn('flex flex-col gap-3', isLoggedIn ? 'xl:flex-row' : 'md:flex-row')}>
        <div className={cn('min-w-0', isLoggedIn ? 'xl:flex-1' : 'md:flex-1')}>
          <SearchBox value={filters.keyword} onSearch={filters.setKeyword} placeholder="搜索题目标题或内容" />
        </div>
        <div className="flex flex-wrap gap-3 md:flex-nowrap">
          <DifficultyToggle
            value={filters.difficulty}
            onChange={filters.setDifficulty}
            className={cn(isLoggedIn && 'basis-full md:basis-auto')}
          />
          {isLoggedIn && <UserTagSelect value={filters.userTag} onChange={filters.setUserTag} />}
          <Select value={filters.sort.value} onValueChange={filters.setSort}>
            <SelectTrigger aria-label="排序" className="w-32 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filters.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-meta">
          <span className="text-muted-foreground">标签</span>
          {filters.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => filters.removeTag(tag)}
              aria-label={`移除标签 ${tag}`}
              className="inline-flex items-center gap-1 border border-foreground bg-foreground px-2 text-background transition-opacity hover:opacity-80"
            >
              {tag}
              <IconClose className="size-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={filters.clearTags}
            className="text-muted-foreground decoration-2 underline-offset-4 hover:text-foreground hover:underline"
          >
            清除标签
          </button>
        </div>
      )}

      {loading && <LoadingBar label="正在更新题目列表" />}
    </section>
  )
})

/** 读 QuestionWorkbench 写进去的 --list-offset；单独使用列表、没有吸顶筛选栏时按导航栏高度算 */
function listOffset(el: HTMLElement) {
  return parseFloat(getComputedStyle(el).getPropertyValue('--list-offset')) || NAV_HEIGHT
}

/** 列表顶部已经滚到吸顶的导航栏和筛选栏下面时，滚回筛选栏正下方 */
function revealListTop(el: HTMLElement | null) {
  if (!el) return
  const offset = listOffset(el)
  const top = el.getBoundingClientRect().top
  if (top < offset) window.scrollBy({ top: top - offset })
}

/**
 * 题目列表 + 分页，题库页和全部题目页共用。bankId 为空时列出全部题目。
 * 筛选条件来自页面上的 useQuestionFilters，和筛选栏是同一份
 */
export function QuestionResults({ bankId, filters }: { bankId?: string; filters: QuestionFilterState }) {
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useQuestionList(filters.query)
  const { tags, page, hasFilter } = filters

  const topRef = useRef<HTMLDivElement>(null)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  // 筛选栏吸顶后，滚到列表中间也能改条件；条件变了就回到列表顶部，从第一条开始看。首次渲染（含从详情页返回）不滚
  const filterKey = JSON.stringify([filters.keyword, filters.difficulty, tags, filters.userTag, filters.sort.value])
  const prevFilterKey = useRef(filterKey)
  useEffect(() => {
    if (prevFilterKey.current === filterKey) return
    prevFilterKey.current = filterKey
    revealListTop(topRef.current)
  }, [filterKey])

  function goToPage(target: number) {
    filters.setPage(target)
    revealListTop(topRef.current)
  }

  // Tab 到被吸顶筛选栏挡住的题目时往下让出位置，焦点始终看得见
  function handleFocus(e: FocusEvent<HTMLDivElement>) {
    const offset = listOffset(e.currentTarget)
    const top = e.target.getBoundingClientRect().top
    if (top < offset) window.scrollBy({ top: top - offset })
  }

  return (
    <div ref={topRef} onFocus={handleFocus} className="min-w-0 space-y-4">
      {isPending && <ListSkeleton />}

      {isError && <ErrorState message={error.message} onRetry={() => refetch()} withArt className="border-t-0" />}

      {data && data.list.length === 0 && (
        // total > 0 却没数据，说明 URL 里的页码超出范围
        <EmptyState
          className="border-t-0"
          icon={data.total > 0 ? <IconMagnifierClose className="size-8" /> : <IconFileText className="size-8" />}
          pose={data.total > 0 ? undefined : hasFilter ? 'thinking' : 'explain'}
          title={data.total > 0 ? '这一页没有题目' : hasFilter ? '没有找到符合条件的题目' : '这里还没有题目'}
          action={
            data.total > 0 ? (
              <Button variant="outline" size="sm" onClick={() => goToPage(1)}>
                回到第一页
              </Button>
            ) : hasFilter ? (
              <Button variant="outline" size="sm" onClick={filters.clearFilters}>
                清除筛选
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link to="/">返回首页</Link>
              </Button>
            )
          }
        />
      )}

      {data && data.list.length > 0 && (
        <>
          {/* 筛选或翻页时先保留旧列表，变淡提示正在加载，加载完再恢复 */}
          <ul
            aria-busy={isPlaceholderData}
            className={cn('divide-y border border-t-0 border-foreground transition-opacity', isPlaceholderData && 'opacity-60')}
          >
            {data.list.map((q) => (
              <QuestionItem key={q.question_id} question={q} bankId={bankId} selectedTags={tags} onTagClick={filters.addTag} />
            ))}
          </ul>

          <Pagination page={page} totalPages={totalPages} total={data.total} onChange={goToPage} />
        </>
      )}
    </div>
  )
}

/** 难度切换：全部 / 简单 / 中等 / 困难，选中项反白 */
function DifficultyToggle({
  value,
  onChange,
  className,
}: {
  value?: Difficulty
  onChange: (value?: Difficulty) => void
  className?: string
}) {
  const options = [{ value: undefined, label: '全部', dotClassName: '' }, ...DIFFICULTY_OPTIONS]

  return (
    <div role="group" aria-label="难度" className={cn('flex min-w-0 flex-1 divide-x border border-input', className)}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap px-2 text-body transition-colors sm:px-3',
              active
                ? 'bg-foreground text-background'
                : 'decoration-2 underline-offset-4 hover:underline',
            )}
          >
            {/* 手机上放不下色块，只留文字 */}
            {opt.dotClassName && <span aria-hidden className={cn('hidden h-1.5 w-1.5 sm:inline-block', opt.dotClassName)} />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/** 掌握状态下拉的「不过滤」选项；Select 的选项值不能是空字符串 */
const ALL_USER_TAGS = 'all'

/** 掌握状态筛选：全部状态 / 已掌握 / 晚点再刷 / 未掌握，只有登录后显示 */
function UserTagSelect({
  value,
  onChange,
}: {
  value?: Exclude<UserTag, 0>
  onChange: (value?: Exclude<UserTag, 0>) => void
}) {
  return (
    <Select
      value={value ? String(value) : ALL_USER_TAGS}
      onValueChange={(v) => onChange(v === ALL_USER_TAGS ? undefined : (Number(v) as Exclude<UserTag, 0>))}
    >
      <SelectTrigger aria-label="掌握状态" className="min-w-0 flex-1 md:w-32 md:flex-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_USER_TAGS}>全部状态</SelectItem>
        {USER_TAG_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={String(opt.value)}>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0', opt.dotClassName)} />
              {opt.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * 题目行。≥1280px 一行一题：标题在左，标签、难度、浏览量靠右，难度和浏览量定宽，上下对齐好扫读；
 * 更窄时标题一行，难度、标签、浏览量另起一行
 */
function QuestionItem({
  question,
  bankId,
  selectedTags,
  onTagClick,
}: {
  question: Question
  bankId?: string
  selectedTags: string[]
  onTagClick: (tag: string) => void
}) {
  return (
    // 整行可点：标题链接用 after 伪元素铺满整行，标签按钮用 z-10 浮在上面，避免把按钮嵌进链接里；
    // 聚焦时伪元素画一圈内描边，整行都是焦点框
    <li className="relative px-4 py-3 transition-colors hover:bg-muted xl:flex xl:items-center xl:gap-4">
      <h3 className="text-body font-medium xl:min-w-0 xl:flex-1">
        <Link
          // 全部题目页没有 bankId 时，用题目所属的第一个题库
          to={questionPath(question.question_id, bankId ?? question.bank_list[0])}
          className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring"
        >
          {question.title}
        </Link>
      </h3>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-meta text-muted-foreground xl:mt-0 xl:shrink-0 xl:flex-nowrap">
        <span className="xl:order-2 xl:w-12">
          <DifficultyLabel difficulty={question.difficulty} />
        </span>
        {question.tags.length > 0 && (
          <span className="flex flex-wrap gap-2 xl:order-1">
            {question.tags.map((tag) => {
              const selected = selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTagClick(tag)}
                  aria-pressed={selected}
                  title={selected ? '已在筛选中' : `按「${tag}」筛选`}
                  className={cn(
                    'relative z-10 border px-2 transition-colors',
                    selected
                      ? 'border-foreground bg-foreground text-background'
                      : 'hover:border-foreground hover:bg-foreground hover:text-background',
                  )}
                >
                  {tag}
                </button>
              )
            })}
          </span>
        )}
        <span className="ml-auto inline-flex items-center justify-end gap-1 tabular-nums xl:order-3 xl:ml-0 xl:w-16">
          <IconEye className="size-3.5" />
          {question.view_count}
        </span>
      </div>
    </li>
  )
}

/** 页码序列：首页、末页、当前页前后各 1 页；只隔一页时直接补上，隔得更远才用省略号 */
function getPageItems(page: number, totalPages: number): (number | 'ellipsis')[] {
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b)

  const items: (number | 'ellipsis')[] = []
  pages.forEach((p, i) => {
    const prev = pages[i - 1]
    if (prev !== undefined && p - prev === 2) items.push(prev + 1)
    if (prev !== undefined && p - prev > 2) items.push('ellipsis')
    items.push(p)
  })
  return items
}

function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  onChange: (page: number) => void
}) {
  const itemClass = 'inline-flex h-8 min-w-8 items-center justify-center border px-2 text-meta tabular-nums transition-colors'

  return (
    <nav aria-label="分页" className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-meta text-muted-foreground">
        共 {total} 题 · 第 {page} / {totalPages} 页
      </span>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="上一页"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            className={cn(itemClass, 'hover:border-foreground disabled:pointer-events-none disabled:opacity-40')}
          >
            <IconChevronLeft className="size-4" />
          </button>
          {getPageItems(page, totalPages).map((item, i) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} className="w-8 text-center text-meta text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onChange(item)}
                className={cn(
                  itemClass,
                  item === page ? 'border-foreground bg-foreground text-background' : 'hover:border-foreground',
                )}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label="下一页"
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1)}
            className={cn(itemClass, 'hover:border-foreground disabled:pointer-events-none disabled:opacity-40')}
          >
            <IconChevronRight className="size-4" />
          </button>
        </div>
      )}
    </nav>
  )
}

/** 骨架和真实题目行同形同高：类名和 QuestionItem 一一对应，色块高度按行高（正文 1.7em、meta 1.5em + 标签边框）算 */
function ListSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="skeleton divide-y border border-t-0">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="px-4 py-3 xl:flex xl:items-center xl:gap-4">
            <div className="text-body xl:min-w-0 xl:flex-1">
              <div className={cn('h-[1.7em] bg-skeleton', i % 2 === 0 ? 'w-2/3' : 'w-1/2')} />
            </div>
            <div className="mt-1 flex items-center gap-3 text-meta xl:mt-0 xl:shrink-0">
              <div className="h-[calc(1.5em+2px)] w-10 bg-skeleton xl:order-2 xl:w-12" />
              <div className="h-[calc(1.5em+2px)] w-24 bg-skeleton xl:order-1" />
              <div className="ml-auto h-[calc(1.5em+2px)] w-12 bg-skeleton xl:order-3 xl:ml-0 xl:w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-8 w-40 skeleton bg-skeleton" />
    </div>
  )
}
