import { isAxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import http from '@/lib/axios'
import type { ApiResponse } from '@/types/api'

/** 接口错误：HTTP 出错，或 HTTP 200 但 code 非 0 */
export class ApiError extends Error {
  code: number

  constructor(code: number, msg: string) {
    super(msg)
    this.name = 'ApiError'
    this.code = code
  }
}

/** 拆开后端的 { code, msg, data }：code 为 0 返回 data，否则抛出 ApiError */
async function unwrap<T>(req: Promise<AxiosResponse<ApiResponse<T>>>) {
  let res: AxiosResponse<ApiResponse<T>>
  try {
    res = await req
  } catch (err) {
    if (isAxiosError<ApiResponse<unknown>>(err)) {
      // 500 时后端也会返回 { code, msg }，优先用后端的 msg
      const body = err.response?.data
      throw new ApiError(body?.code ?? err.response?.status ?? -1, body?.msg ?? err.message)
    }
    throw err
  }

  // 路径漏写 /api 前缀时，Vite 会返回 index.html（HTTP 200），body 不是 JSON
  const body = res.data
  if (body?.code !== 0) {
    throw new ApiError(body?.code ?? -1, body?.msg ?? '响应格式错误')
  }
  return body.data
}

/** GET 请求，直接返回 data 字段 */
export function get<T>(url: string, config?: AxiosRequestConfig) {
  return unwrap(http.get<ApiResponse<T>>(url, config))
}

/** POST 请求，直接返回 data 字段 */
export function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
  return unwrap(http.post<ApiResponse<T>>(url, data, config))
}
