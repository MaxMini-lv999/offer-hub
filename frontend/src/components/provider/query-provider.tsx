import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ApiError } from '@/lib/request'

/** 业务错误（参数错误、题目不存在等）重试结果也一样，只对网络错误和 5xx 重试一次 */
function shouldRetry(failureCount: number, error: Error) {
  const isBusinessError = error instanceof ApiError && error.code > 0 && error.code < 500
  return !isBusinessError && failureCount < 1
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
  },
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
