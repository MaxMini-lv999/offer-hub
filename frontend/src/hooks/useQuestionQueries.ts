import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  getAllQuestionList,
  getHotQuestionList,
  getQuestionDetail,
  getQuestionList,
  getQuestionMetaList,
} from '@/services/question'
import type { HotQuestionListParams, QuestionFilters } from '@/types/question'

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
}

/** 题库全量列表，按职位方向 → 系列 → 题库分组 */
export function useQuestionBanks(jobName?: string) {
  return useQuery({
    queryKey: queryKeys.banks(jobName),
    queryFn: () => getAllQuestionList({ job_name: jobName }),
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

/** 题库下的题目导航列表（只有 ID 和标题），bankId 为空时不发请求 */
export function useBankQuestionList(bankId: string, keyword?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.bankList(bankId, keyword),
    // 侧边栏要展示整个题库，按后端上限 100 一次取完
    queryFn: () => getQuestionMetaList({ bank_id: bankId, keyword, page_size: 100 }),
    enabled: enabled && !!bankId,
  })
}

/** 热门题目列表 */
export function useHotQuestions(params?: HotQuestionListParams) {
  return useQuery({
    queryKey: queryKeys.hot(params),
    queryFn: () => getHotQuestionList(params),
  })
}
