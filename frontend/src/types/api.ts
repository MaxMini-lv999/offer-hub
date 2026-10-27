/** 后端统一响应结构，code 为 0 表示成功，失败时 data 为 null */
export interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}
