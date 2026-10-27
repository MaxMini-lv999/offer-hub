import { useQuery } from '@tanstack/react-query'
import { getHotQuestionList } from '@/services/question'
import type { HotQuestionListParams } from '@/types/question'

export function useHotQuestions(params?: HotQuestionListParams) {
  return useQuery({
    queryKey: ['question', 'hot', params],
    queryFn: () => getHotQuestionList(params),
  })
}
