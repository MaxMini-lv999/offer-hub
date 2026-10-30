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
      // 500 时后端也会返回 { code, msg }，优先用后端的 msg；没有 msg（断网、超时、代理连不上后端）时换成中文提示，不显示 axios 的英文报错
      const body = err.response?.data
      const fallback = err.response
        ? `服务暂时不可用（HTTP ${err.response.status}），请稍后再试`
        : err.code === 'ECONNABORTED'
          ? '请求超时，请稍后再试'
          : '网络连接失败，请检查网络后重试'
      throw new ApiError(body?.code ?? err.response?.status ?? -1, body?.msg ?? fallback)
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
