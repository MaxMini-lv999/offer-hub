import { useEffect } from 'react'
import { useBankQuestionList } from '@/hooks/useQuestionQueries'

/**
 * 当前题目在题库里的上一题和下一题，按题库内的默认顺序；和详情页左侧题目栏（未搜索时）共用同一份数据。
 * found 为 false 表示还没在已加载的页里找到当前题目
 */
export function useNeighbors(bankId: string, currentId: string) {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useBankQuestionList(bankId)
  const list = data?.pages.flatMap((page) => page.list) ?? []
  const index = list.findIndex((q) => q.question_id === currentId)

  // 当前题目排在已加载的页之后（题库超过 100 题）时，接着取下一页直到找到它
  useEffect(() => {
    if (data && index === -1 && hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [data, index, hasNextPage, isFetchingNextPage, fetchNextPage])

  return {
    found: index !== -1,
    prev: index > 0 ? list[index - 1] : undefined,
    next: index !== -1 ? list[index + 1] : undefined,
    /** 题库里的第一题，题库页「从第一题开始模拟面试」用 */
    first: list[0],
  }
}
