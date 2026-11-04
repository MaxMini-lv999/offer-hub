import { GUIDE } from '@/constants/art'

export type AuthMode = 'login' | 'register'

export const AUTH_TITLES: Record<AuthMode, string> = {
  login: '登录 Offer Hub',
  register: '注册 Offer Hub',
}

/** 澜汐在登录 / 注册时说的话，登录页的 VN 对话框和登录弹窗共用 */
export const AUTH_LINES: Record<AuthMode, string> = {
  login: '欢迎回来！登录之后就能看完整解析，还能标记掌握状态。',
  register: `初次见面，我是${GUIDE.name}，Offer Hub 的引导员。注册一个账号，我们开始吧。`,
}
