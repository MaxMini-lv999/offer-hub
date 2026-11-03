import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SORT_OPTIONS } from '@/constants/question'
import { useLogin } from '@/hooks/useLogin'
import type { Difficulty, QuestionFilters, UserTag } from '@/types/question'

export const PAGE_SIZE = 20

/** URL 里的 difficulty 只认 1/2/3，其他值当作不过滤 */
function parseDifficulty(raw: string | null): Difficulty | undefined {
  return raw === '1' || raw === '2' || raw === '3' ? (Number(raw) as Difficulty) : undefined
}

/** URL 里的 mastery（掌握状态）只认 1/2/3，其他值当作不过滤 */
function parseUserTag(raw: string | null): Exclude<UserTag, 0> | undefined {
  return raw === '1' || raw === '2' || raw === '3' ? (Number(raw) as Exclude<UserTag, 0>) : undefined
}

/** URL 里的 page 缺失或不是正整数时回退到第 1 页 */
function parsePage(raw: string | null) {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** URL 里的 sort 不认识时回退到默认排序 */
function parseSort(raw: string | null) {
  return SORT_OPTIONS.find((opt) => opt.value === raw) ?? SORT_OPTIONS[0]
}

/**
 * 题目列表的筛选条件：关键词、难度、标签、掌握状态、排序和页码都放在 URL 里，刷新、分享链接、从详情页返回时都能还原。
 * bankId 为空时列出全部题目。页面调一次，把结果分别交给筛选卡片和列表；query 是请求参数，同样的条件共用查询缓存。
 * 掌握状态只对登录用户有效：游客打开带 mastery 的链接时不显示这项筛选，也不传 user_tag
 */
export function useQuestionFilters(bankId?: string) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isLoggedIn } = useLogin()
  const keyword = searchParams.get('keyword') ?? ''
  const difficulty = parseDifficulty(searchParams.get('difficulty'))
  const tags = [...new Set(searchParams.getAll('tag'))]
  const userTag = isLoggedIn ? parseUserTag(searchParams.get('mastery')) : undefined
  const sort = parseSort(searchParams.get('sort'))
  const page = parsePage(searchParams.get('page'))

  const query: QuestionFilters = {
    bank_id: bankId,
    keyword: keyword || undefined,
    difficulty,
    tags: tags.length > 0 ? tags : undefined,
    user_tag: userTag,
    sort_by: sort.sortBy,
    sort_order: sort.sortOrder,
    page,
    page_size: PAGE_SIZE,
  }

  /** 改筛选条件：任一条件变化都回到第 1 页；replace 不留历史记录，preventScrollReset 保持滚动位置 */
  const updateFilters = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          mutate(next)
          next.delete('page')
          return next
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setSearchParams],
  )

  // SearchBox 的防抖 effect 依赖 onSearch，要保持引用不变
  const setKeyword = useCallback(
    (value: string) => updateFilters((next) => (value ? next.set('keyword', value) : next.delete('keyword'))),
    [updateFilters],
  )

  function setDifficulty(value?: Difficulty) {
    updateFilters((next) => (value ? next.set('difficulty', String(value)) : next.delete('difficulty')))
  }

  function setUserTag(value?: Exclude<UserTag, 0>) {
    updateFilters((next) => (value ? next.set('mastery', String(value)) : next.delete('mastery')))
  }

  function setSort(value: string) {
    updateFilters((next) => (value === SORT_OPTIONS[0].value ? next.delete('sort') : next.set('sort', value)))
  }

  function addTag(tag: string) {
    if (tags.includes(tag)) return
    updateFilters((next) => next.append('tag', tag))
  }

  function removeTag(tag: string) {
    updateFilters((next) => {
      next.delete('tag')
      tags.filter((t) => t !== tag).forEach((t) => next.append('tag', t))
    })
  }

  function clearTags() {
    updateFilters((next) => next.delete('tag'))
  }

  function clearFilters() {
    updateFilters((next) => {
      next.delete('keyword')
      next.delete('difficulty')
      next.delete('tag')
      next.delete('mastery')
    })
  }

  function setPage(target: number) {
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
      { replace: true, preventScrollReset: true },
    )
  }

  return {
    keyword,
    difficulty,
    tags,
    userTag,
    sort,
    page,
    query,
    hasFilter: !!keyword || difficulty !== undefined || tags.length > 0 || userTag !== undefined,
    setKeyword,
    setDifficulty,
    setUserTag,
    setSort,
    addTag,
    removeTag,
    clearTags,
    clearFilters,
    setPage,
  }
}

export type QuestionFilterState = ReturnType<typeof useQuestionFilters>
