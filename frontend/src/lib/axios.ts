import axios, { type AxiosError } from 'axios'

export const TOKEN_KEY = 'token'
const tokenListeners = new Set<() => void>()

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/** 存入 token，传 null 清掉；同时通知订阅者，LoginProvider 靠它在 token 失效时同步退出登录 */
export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
  tokenListeners.forEach((listener) => listener())
}

/** 订阅 token 变化，给 useSyncExternalStore 用；其他标签页登录或登出时也会触发 */
export function subscribeToken(listener: () => void) {
  const onStorage = (e: StorageEvent) => {
    // key 为 null 表示整个 localStorage 被清空
    if (e.key === TOKEN_KEY || e.key === null) listener()
  }
  tokenListeners.add(listener)
  window.addEventListener('storage', onStorage)
  return () => {
    tokenListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** 本地有 token 就当作已登录；token 是否过期由后端判断，失效时响应拦截器会清掉它 */
export function hasToken() {
  return !!getToken()
}

const http = axios.create({
  // 空字符串：请求发到当前域名，开发时由 Vite 把 /api 代理到后端
  baseURL: '',
  timeout: 10_000,
  // 数组参数序列化成 tags=a&tags=b；axios 默认的 tags[]=a 绑定不到 Gin 的 form:"tags"
  paramsSerializer: { indexes: null },
})

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => {
    // 后端约定 token 失效时 HTTP 仍是 200，靠 body 里的 code 401 区分
    if (res.data?.code === 401) {
      setToken(null)
    }
    return res
  },
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      setToken(null)
    }
    return Promise.reject(err)
  },
)

export default http
