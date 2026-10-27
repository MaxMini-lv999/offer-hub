import { useState } from 'react'
import { createSearchParams, Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Eye, Search } from 'reicon-react'
import { HotContent } from '@/components/HotContent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DIFFICULTY_OPTIONS } from '@/constants/question'
import { useQuestionBanks, useQuestionList } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'
import type { Difficulty, Question, QuestionFilters } from '@/types/question'

const PAGE_SIZE = 20

/** URL 里的 difficulty 只认 1/2/3，其他值当作不过滤 */
function parseDifficulty(raw: string | null): Difficulty | undefined {
  return raw === '1' || raw === '2' || raw === '3' ? (Number(raw) as Difficulty) : undefined
}

/** URL 里的 page 缺失或不是正整数时回退到第 1 页 */
function parsePage(raw: string | null) {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

export function QuestionsPage() {
  // 筛选条件和页码都放在 URL 里：刷新、分享链接、从详情页返回时都能还原
  const [searchParams, setSearchParams] = useSearchParams()
  const bankId = searchParams.get('bank_id') ?? undefined
  const keyword = searchParams.get('keyword') ?? ''
  const difficulty = parseDifficulty(searchParams.get('difficulty'))
  const page = parsePage(searchParams.get('page'))

  const filters: QuestionFilters = {
    bank_id: bankId,
    keyword: keyword || undefined,
    difficulty,
    page,
    page_size: PAGE_SIZE,
  }
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useQuestionList(filters)

  // 题库名从题库全量列表里查，从题库页进来时已有缓存，不会多发请求
  const { data: groups } = useQuestionBanks()
  const bank = groups
    ?.flatMap((group) => group.series_list)
    .flatMap((series) => series.bank_list)
    .find((b) => b.bank_id === bankId)

  const activeIndex = searchParams.get('activeIndex')
  const backTo = activeIndex ? `/collections?activeIndex=${activeIndex}` : '/collections'
  const hasFilter = !!keyword || difficulty !== undefined
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  /** 改筛选条件：空值从 URL 删掉，同时回到第一页 */
  function updateFilter(key: 'keyword' | 'difficulty', value?: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  function clearFilters() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('keyword')
        next.delete('difficulty')
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  function goToPage(target: number) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (target > 1) {
          next.set('page', String(target))
        } else {
          next.delete('page')
        }
        return next
      },
      { replace: true },
    )
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6">
        <div className="space-y-2">
          {bankId && (
            <Link
              to={backTo}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={16} />
              返回题库
            </Link>
          )}
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold">{bank?.bank_name ?? (bankId ? '题目列表' : '全部题目')}</h1>
            {data && <span className="text-sm text-muted-foreground">共 {data.total} 题</span>}
          </div>
          {bank?.desc && <p className="text-sm text-muted-foreground">{bank.desc}</p>}
        </div>

        <div className="space-y-3">
          {/* key 跟着 URL 里的 keyword 变：浏览器前进后退时输入框内容同步还原 */}
          <KeywordSearch key={keyword} defaultValue={keyword} onSearch={(v) => updateFilter('keyword', v)} />

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">难度</span>
            <Button
              variant={difficulty === undefined ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateFilter('difficulty')}
            >
              全部
            </Button>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={difficulty === opt.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateFilter('difficulty', String(opt.value))}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {isPending && <ListSkeleton />}

        {isError && (
          <div className="flex items-center gap-3 border border-destructive/40 p-4 text-sm text-destructive">
            <AlertCircle size={18} />
            <span>{error.message}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </div>
        )}

        {data && data.list.length === 0 && (
          <div className="flex flex-col items-center gap-3 border py-12 text-sm text-muted-foreground">
            {/* total > 0 却没数据，说明 URL 里的页码超出范围 */}
            {data.total > 0 ? (
              <>
                <span>这一页没有题目</span>
                <Button variant="outline" size="sm" onClick={() => goToPage(1)}>
                  回到第一页
                </Button>
              </>
            ) : (
              <>
                <span>没有找到符合条件的题目</span>
                {hasFilter && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    清除筛选
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {data && data.list.length > 0 && (
          <>
            {/* 翻页时先保留上一页数据，变淡提示正在加载 */}
            <ul className={cn('divide-y border transition-opacity', isPlaceholderData && 'opacity-60')}>
              {data.list.map((q) => (
                <QuestionItem key={q.question_id} question={q} bankId={bankId} />
              ))}
            </ul>

            <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
          </>
        )}
      </div>

      <aside>
        <HotContent />
      </aside>
    </div>
  )
}

/** 关键词搜索：回车或点搜索才提交，避免每敲一个字发一次请求 */
function KeywordSearch({ defaultValue, onSearch }: { defaultValue: string; onSearch: (value: string) => void }) {
  const [value, setValue] = useState(defaultValue)

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch(value.trim())
      }}
    >
      <div className="relative flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="搜索题目标题或内容"
          className="pl-9"
        />
      </div>
      <Button type="submit">搜索</Button>
    </form>
  )
}

function QuestionItem({ question, bankId }: { question: Question; bankId?: string }) {
  const level = DIFFICULTY_OPTIONS.find((opt) => opt.value === question.difficulty)

  return (
    <li>
      <Link
        // 带上 bank_id，详情页侧边栏才能停在当前题库（一道题可能属于多个题库）
        to={{
          pathname: `/questions/${question.question_id}`,
          search: bankId ? createSearchParams({ bank_id: bankId }).toString() : '',
        }}
        className="block space-y-2 p-4 transition-colors hover:bg-accent"
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-medium">{question.title}</h3>
          {level && <span className={cn('shrink-0 text-sm', level.className)}>{level.label}</span>}
        </div>
        <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-1.5">
            {question.tags.map((tag) => (
              <span key={tag} className="border px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </div>
          <span className="flex shrink-0 items-center gap-1">
            <Eye size={14} />
            {question.view_count}
          </span>
        </div>
      </Link>
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
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  return (
    <nav aria-label="分页" className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">
        第 {page} / {totalPages} 页
      </span>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="上一页"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          {getPageItems(page, totalPages).map((item, i) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} className="w-9 text-center text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? 'default' : 'outline'}
                size="icon"
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onChange(item)}
              >
                {item}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="下一页"
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </nav>
  )
}

function ListSkeleton() {
  return (
    <div className="animate-pulse divide-y border">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2 p-4">
          <div className="h-5 w-2/3 bg-muted" />
          <div className="h-4 w-1/4 bg-muted" />
        </div>
      ))}
    </div>
  )
}
