import { useCallback, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useLogin } from '@/hooks/useLogin'
import { parseDifficulty, parseUserTag } from '@/hooks/useQuestionFilters'
import { queryKeys } from '@/hooks/useQuestionQueries'
import { getQuestionMetaList, getRandomQuestionList } from '@/services/question'
import type { Difficulty, QuestionMeta, UserTag } from '@/types/question'

/** 刷题队列每次加载的题数 */
export const FEED_PAGE_SIZE = 20
/** 后端分页最多跳过 10000 条，再往后请求会返回参数错误 */
const FEED_MAX_OFFSET = 10000

export type FeedMode = 'recommend' | 'category'

/** 分类模式的筛选条件。bankId 只能从题库页的入口带进来，筛选栏里只能去掉 */
export interface FeedCategory {
  bankId?: string
  tag?: string
  difficulty?: Difficulty
  /** 掌握状态，只对登录用户有效 */
  userTag?: Exclude<UserTag, 0>
}

/** 题目队列从哪来：推荐模式按随机种子取，分类模式按筛选条件、默认顺序取 */
export type FeedSource = { mode: 'recommend'; seed: number } | ({ mode: 'category' } & FeedCategory)

/** 队列里的一道题。固定在队首的题（分享链接里的）只知道 ID，标题等详情回来再显示 */
export interface FeedItem {
  question_id: string
  title?: string
}

interface FeedPage {
  total: number
  list: QuestionMeta[]
}

function fetchFeedPage(source: FeedSource, page: number): Promise<FeedPage> {
  if (source.mode === 'recommend') {
    return getRandomQuestionList({ seed: source.seed, page, page_size: FEED_PAGE_SIZE })
  }
  return getQuestionMetaList({
    bank_id: source.bankId,
    tags: source.tag ? [source.tag] : undefined,
    difficulty: source.difficulty,
    user_tag: source.userTag,
    page,
    page_size: FEED_PAGE_SIZE,
  })
}

/**
 * 刷题队列的分页数据，一页 FEED_PAGE_SIZE 题，快到队尾时由页面调 fetchNextPage 取下一批。
 * 永不过期：这次刷题期间队列不能自己变（比如在「未掌握」分类里标成已掌握，这道题也不能从队列里消失），
 * 登录、退出时 LoginProvider 让全部缓存失效，才会重新拉
 */
export function useFeedPages(source: FeedSource) {
  return useInfiniteQuery({
    queryKey: queryKeys.feed(source),
    queryFn: ({ pageParam }) => fetchFeedPage(source, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.length * FEED_PAGE_SIZE
      return loaded < lastPage.total && loaded <= FEED_MAX_OFFSET ? allPages.length + 1 : undefined
    },
    staleTime: Infinity,
  })
}

/**
 * 把分页数据拼成题目队列：anchor 放在第一道，其余按分页顺序，跳过 exclude 里的题和重复的题。
 * 后端在翻页期间新增、下线题目时，两页之间可能重复一道，这里去掉
 */
export function buildFeedQueue(
  pages: FeedPage[] | undefined,
  exclude: readonly string[],
  anchor?: string
): FeedItem[] {
  const skip = new Set(exclude)
  const added = new Set<string>()
  const queue: FeedItem[] = []
  if (anchor) {
    queue.push({ question_id: anchor })
    added.add(anchor)
  }
  for (const page of pages ?? []) {
    for (const item of page.list) {
      if (skip.has(item.question_id) || added.has(item.question_id)) continue
      added.add(item.question_id)
      queue.push(item)
    }
  }
  return queue
}

/**
 * 沉浸式刷题的 URL 参数：mode（recommend / category）、分类条件（bank、tag、difficulty、mastery）和当前题目 q。
 * 刷新或打开分享链接时按它们回到同一个位置。参数改动都用 replace，不留历史记录：浏览器后退直接离开刷题页。
 * 掌握状态只对登录用户有效，游客打开带 mastery 的链接时当作没有
 */
export function useFeedParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isLoggedIn } = useLogin()

  const mode: FeedMode = searchParams.get('mode') === 'category' ? 'category' : 'recommend'
  const bankId = searchParams.get('bank') || undefined
  const tag = searchParams.get('tag') || undefined
  const difficulty = parseDifficulty(searchParams.get('difficulty'))
  const userTag = isLoggedIn ? parseUserTag(searchParams.get('mastery')) : undefined
  const questionId = searchParams.get('q') || undefined

  const category = useMemo<FeedCategory>(
    () => ({ bankId, tag, difficulty, userTag }),
    [bankId, tag, difficulty, userTag]
  )

  /** 切换模式：清掉当前题目，推荐模式不带分类条件 */
  const setMode = useCallback(
    (next: FeedMode) =>
      setSearchParams(
        prev => {
          const params = new URLSearchParams(next === 'category' ? prev : undefined)
          params.set('mode', next)
          params.delete('q')
          return params
        },
        { replace: true }
      ),
    [setSearchParams]
  )

  /** 改分类条件：传 undefined 去掉这一项，同时清掉当前题目，从新队列的第一题开始 */
  const setCategory = useCallback(
    (patch: Partial<FeedCategory>) =>
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev)
          const names = { bankId: 'bank', tag: 'tag', difficulty: 'difficulty', userTag: 'mastery' }
          for (const [key, name] of Object.entries(names)) {
            if (!(key in patch)) continue
            const value = patch[key as keyof FeedCategory]
            if (value === undefined) params.delete(name)
            else params.set(name, String(value))
          }
          params.set('mode', 'category')
          params.delete('q')
          return params
        },
        { replace: true }
      ),
    [setSearchParams]
  )

  /** 记下当前题目；和 URL 里一样时不写，免得多一次渲染 */
  const setQuestionId = useCallback(
    (id: string) =>
      setSearchParams(
        prev => {
          if (prev.get('q') === id && prev.get('mode')) return prev
          const params = new URLSearchParams(prev)
          if (!params.get('mode')) params.set('mode', 'recommend')
          params.set('q', id)
          return params
        },
        { replace: true }
      ),
    [setSearchParams]
  )

  return { mode, category, questionId, setMode, setCategory, setQuestionId }
}
