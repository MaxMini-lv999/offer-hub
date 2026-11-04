import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { LIKE_TARGET_QUESTION } from '@/constants/interaction'
import { cancelInFlight } from '@/lib/query'
import { isUncertainError } from '@/lib/request'
import { predictToggleLike, toggleLike } from '@/services/interaction'
import {
  getAllQuestionList,
  getHotQuestionList,
  getQuestionDetail,
  getQuestionList,
  getQuestionMetaList,
  getQuestionTagList,
  tagQuestion,
} from '@/services/question'
import type { LikeData } from '@/types/interaction'
import type {
  HotQuestionListParams,
  JobQuestionGroup,
  Question,
  QuestionBank,
  QuestionFilters,
  TagQuestionParams,
} from '@/types/question'

/** 题目导航列表每页条数，等于后端 page_size 上限 */
const NAV_PAGE_SIZE = 100

/** 题目模块的 query key，按层级组织，invalidateQueries 传前缀即可批量失效（如 lists() 失效所有分页） */
export const queryKeys = {
  all: ['question'] as const,
  banks: (jobName?: string) => [...queryKeys.all, 'banks', { jobName }] as const,
  lists: () => [...queryKeys.all, 'list'] as const,
  list: (filters: QuestionFilters) => [...queryKeys.lists(), filters] as const,
  detail: (questionId: string) => [...queryKeys.all, 'detail', questionId] as const,
  bankList: (bankId: string, keyword?: string) =>
    [...queryKeys.all, 'bank-list', { bankId, keyword }] as const,
  hot: (params?: HotQuestionListParams) => [...queryKeys.all, 'hot', params] as const,
  tags: (bankId?: string) => [...queryKeys.all, 'tags', { bankId }] as const,
  /** 沉浸式刷题的题目队列。不在 lists() 下面：标记掌握状态后列表缓存失效，刷题队列不能跟着变 */
  feed: (source: object) => [...queryKeys.all, 'feed', source] as const,
}

/** 题库全量列表，按职位方向 → 系列 → 题库分组 */
export function useQuestionBanks(jobName?: string) {
  return useQuery({
    queryKey: queryKeys.banks(jobName),
    queryFn: () => getAllQuestionList({ job_name: jobName }),
  })
}

/** 在全量列表里按 bankId 找题库，连同它所属的职位方向一起返回；找不到时为 null */
function findBank(
  groups: JobQuestionGroup[],
  bankId: string
): { bank: QuestionBank; jobName: string } | null {
  for (const group of groups) {
    for (const series of group.series_list) {
      const bank = series.bank_list.find(b => b.bank_id === bankId)
      if (bank) return { bank, jobName: group.job_name }
    }
  }
  return null
}

/** 单个题库的信息和职位方向。和首页的 useQuestionBanks() 共用同一份缓存，从首页进来不会多发请求 */
export function useBankInfo(bankId: string) {
  return useQuery({
    queryKey: queryKeys.banks(undefined),
    queryFn: () => getAllQuestionList({ job_name: undefined }),
    select: groups => findBank(groups, bankId),
  })
}

/** 题目列表，翻页或改过滤条件时保留上一页数据，避免列表闪回加载态 */
export function useQuestionList(filters: QuestionFilters, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.list(filters),
    queryFn: () => getQuestionList(filters),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** 题目详情，questionId 为空时不发请求 */
export function useQuestionDetail(questionId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.detail(questionId),
    queryFn: () => getQuestionDetail({ question_id: questionId }),
    enabled: enabled && !!questionId,
  })
}

/** 题库下的题目导航列表（只有 ID 和标题），一页 100 条，滚动到底再取下一页；bankId 为空时不发请求 */
export function useBankQuestionList(bankId: string, keyword?: string, enabled: boolean = true) {
  // 空字符串和 undefined 归一，侧边栏没搜索时和「上一题 / 下一题」共用同一份缓存
  const kw = keyword || undefined
  return useInfiniteQuery({
    queryKey: queryKeys.bankList(bankId, kw),
    queryFn: ({ pageParam }) =>
      getQuestionMetaList({
        bank_id: bankId,
        keyword: kw,
        page: pageParam,
        page_size: NAV_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      allPages.length * NAV_PAGE_SIZE < lastPage.total ? allPages.length + 1 : undefined,
    enabled: enabled && !!bankId,
  })
}

/** 热门题目列表 */
export function useHotQuestions(params?: HotQuestionListParams, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.hot(params),
    queryFn: () => getHotQuestionList(params),
    enabled,
  })
}

/** 标签列表（带题目数），bankId 为空时统计全部题目 */
export function useQuestionTags(bankId?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.tags(bankId),
    queryFn: () => getQuestionTagList({ bank_id: bankId }),
    enabled,
  })
}

/**
 * 给题目点赞或取消点赞，按 user_liked 决定调哪个接口。乐观更新，只动详情缓存里的 user_liked 和 thumbs_up_count：
 * - 点击时：先按预测值改（点赞数 ±1），按钮马上变
 * - 成功：换成接口返回的 liked 和 count。count 是后端点赞数字段的值，别人同时点的赞也算进去，不用重新拉详情
 * - 失败：改回点击前的值；断网、超时、5xx 时服务端可能已经改了，再重新拉一次详情，以服务端为准
 * 回滚只改这两个字段、不整个恢复快照：请求期间标记掌握状态写进缓存的 user_tag 不会被冲掉。
 * 点赞数可能变了时（成功或结果说不准），题目列表能按点赞数排序，一并标记过期，回到列表时重新请求
 */
export function useLikeQuestion() {
  const queryClient = useQueryClient()
  const patchDetail = (questionId: string, { liked, count }: LikeData) =>
    queryClient.setQueryData<Question>(queryKeys.detail(questionId), old =>
      old ? { ...old, user_liked: liked, thumbs_up_count: count } : old
    )
  return useMutation({
    mutationFn: (question: Question) =>
      toggleLike(LIKE_TARGET_QUESTION, question.question_id, !question.user_liked),
    onMutate: async question => {
      const cancelled = await cancelInFlight(queryClient, queryKeys.detail(question.question_id))
      patchDetail(
        question.question_id,
        predictToggleLike(question.user_liked, question.thumbs_up_count)
      )
      return { cancelled }
    },
    onSuccess: (data, question) => patchDetail(question.question_id, data),
    onError: (_, question) =>
      patchDetail(question.question_id, {
        liked: question.user_liked,
        count: question.thumbs_up_count,
      }),
    onSettled: (_, error, question, context) => {
      const uncertain = !!error && isUncertainError(error)
      if (uncertain || context?.cancelled) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.detail(question.question_id) })
      }
      if (!error || uncertain) void queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
    },
  })
}

/**
 * 标记题目的掌握状态，tag 传 0 取消标记。悲观更新：接口成功后才改详情缓存里的 user_tag；
 * 题目列表能按掌握状态筛选，一并标记过期，回到列表时重新请求
 */
export function useTagQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ question_id, tag }: TagQuestionParams) => tagQuestion(question_id, tag),
    onSuccess: (_, { question_id, tag }) => {
      queryClient.setQueryData<Question>(queryKeys.detail(question_id), old =>
        old ? { ...old, user_tag: tag } : old
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
    },
  })
}
