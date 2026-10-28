import axios, { type AxiosError } from 'axios'

export const TOKEN_KEY = 'token'

/** 本地有 token 就当作已登录；token 是否过期由后端判断，失效时响应拦截器会清掉它 */
export function hasToken() {
  return !!localStorage.getItem(TOKEN_KEY)
}

const http = axios.create({
  // 空字符串：请求发到当前域名，开发时由 Vite 把 /api 代理到后端
  baseURL: '',
  timeout: 10_000,
  // 数组参数序列化成 tags=a&tags=b；axios 默认的 tags[]=a 绑定不到 Gin 的 form:"tags"
  paramsSerializer: { indexes: null },
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => {
    // 后端约定 token 失效时 HTTP 仍是 200，靠 body 里的 code 401 区分
    if (res.data?.code === 401) {
      localStorage.removeItem(TOKEN_KEY)
    }
    return res
  },
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
    }
    return Promise.reject(err)
  },
)

export default http
