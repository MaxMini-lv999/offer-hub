import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Eye, FileText, SearchStatus, Xmark } from 'reicon-react'
import { DifficultyLabel } from '@/components/DifficultyLabel'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { SearchBox } from '@/components/SearchBox'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ART } from '@/constants/art'
import { DIFFICULTY_OPTIONS, SORT_OPTIONS } from '@/constants/question'
import { PAGE_SIZE, type QuestionFilterState } from '@/hooks/useQuestionFilters'
import { useQuestionList } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'
import type { Difficulty, Question } from '@/types/question'
import { questionPath } from '@/utils/route'

/** 筛选栏：搜索框一行，难度和排序一行；题库页和全部题目页放在页头的 Bento 卡片里 */
export function QuestionFilterBar({ filters }: { filters: QuestionFilterState }) {
  return (
    <div className="flex flex-col gap-3">
      <SearchBox value={filters.keyword} onSearch={filters.setKeyword} placeholder="搜索题目标题或内容" />
      <div className="flex gap-3">
        <DifficultyToggle value={filters.difficulty} onChange={filters.setDifficulty} />
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
  )
}

/**
 * 题目列表：已选标签 + 列表 + 分页，题库页和全部题目页共用。bankId 为空时列出全部题目。
 * 筛选条件来自页面上的 useQuestionFilters，和筛选栏是同一份
 */
export function QuestionResults({ bankId, filters }: { bankId?: string; filters: QuestionFilterState }) {
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useQuestionList(filters.query)
  const { tags, page, hasFilter } = filters

  const topRef = useRef<HTMLDivElement>(null)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  function goToPage(target: number) {
    filters.setPage(target)
    // 列表顶部已经滚出屏幕（被吸顶导航挡住）时，翻页后回到列表顶部
    const top = topRef.current?.getBoundingClientRect().top
    if (top !== undefined && top < 64) {
      topRef.current?.scrollIntoView({ block: 'start' })
    }
  }

  return (
    <div ref={topRef} className="min-w-0 scroll-mt-20 space-y-4">
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-meta">
          <span className="text-muted-foreground">标签</span>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => filters.removeTag(tag)}
              aria-label={`移除标签 ${tag}`}
              className="inline-flex items-center gap-1 border border-foreground bg-foreground px-2 text-background transition-opacity hover:opacity-80"
            >
              {tag}
              <Xmark size={12} />
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

      {isPending && <ListSkeleton />}

      {isError && <ErrorState message={error.message} onRetry={() => refetch()} withArt />}

      {data && data.list.length === 0 && (
        // total > 0 却没数据，说明 URL 里的页码超出范围
        <EmptyState
          icon={data.total > 0 ? <SearchStatus size={32} /> : <FileText size={32} />}
          art={data.total > 0 ? undefined : hasFilter ? ART.stateEmptySearch : ART.stateEmptyBookmarks}
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
            className={cn('divide-y border border-foreground transition-opacity', isPlaceholderData && 'opacity-60')}
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
function DifficultyToggle({ value, onChange }: { value?: Difficulty; onChange: (value?: Difficulty) => void }) {
  const options = [{ value: undefined, label: '全部', dotClassName: '' }, ...DIFFICULTY_OPTIONS]

  return (
    <div role="group" aria-label="难度" className="flex min-w-0 flex-1 divide-x border border-input">
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
    // 整行可点：标题链接用 after 伪元素铺满整行，标签按钮用 z-10 浮在上面，避免把按钮嵌进链接里
    <li className="relative px-4 py-4 transition-colors hover:bg-muted">
      <h3 className="text-body font-medium">
        <Link
          // 全部题目页没有 bankId 时，用题目所属的第一个题库
          to={questionPath(question.question_id, bankId ?? question.bank_list[0])}
          className="after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
        >
          {question.title}
        </Link>
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-meta text-muted-foreground">
        <DifficultyLabel difficulty={question.difficulty} />
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
        <span className="ml-auto inline-flex items-center gap-1 tabular-nums">
          <Eye size={14} />
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
            <ChevronLeft size={16} />
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
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </nav>
  )
}

/** 骨架和真实列表项同高：标题一行 + 难度 / 标签 / 浏览量一行 */
function ListSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="animate-pulse divide-y border">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="px-4 py-4">
            <div className={cn('h-6 bg-muted', i % 2 === 0 ? 'w-2/3' : 'w-1/2')} />
            <div className="mt-2 flex gap-3">
              <div className="h-5 w-10 bg-muted" />
              <div className="h-5 w-12 bg-muted" />
              <div className="h-5 w-16 bg-muted" />
              <div className="ml-auto h-5 w-12 bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-8 w-40 animate-pulse bg-muted" />
    </div>
  )
}
