import type { QueryClient, QueryKey } from '@tanstack/react-query'

/**
 * 乐观更新改缓存之前，先停掉这些 query 正在进行的请求，免得请求晚到、拿旧数据把乐观值盖掉。
 * 返回有没有真的停掉请求：停掉的请求不会自己重发，mutation 结束后要重新拉一次
 */
export async function cancelInFlight(queryClient: QueryClient, queryKey: QueryKey) {
  if (queryClient.isFetching({ queryKey }) === 0) return false
  await queryClient.cancelQueries({ queryKey })
  return true
}
