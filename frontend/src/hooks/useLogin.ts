import { createContext, useContext } from 'react'
import type { PasswordAuthUserDTO, UserInfo } from '@/types/auth'

export interface LoginContextValue {
  /** 本地有 token 就是 true。刷新页面后 getUserInfo 返回之前，可能已登录但 userInfo 还是 null */
  isLoggedIn: boolean
  /** snake_case，与 /api/v1/user_info/get_user_info 一致 */
  userInfo: UserInfo | null
  /** 登录成功后调用，传登录接口返回的 camelCase userInfo，内部转成 snake_case */
  login: (userInfo: PasswordAuthUserDTO, token: string) => void
  /** 先调登出接口把 token 拉黑，无论成功与否都清掉本地登录状态 */
  logout: () => Promise<void>
  showLoginDialog: boolean
  setShowLoginDialog: (show: boolean) => void
  /** 重新拉取用户信息，失败时抛出 ApiError */
  refreshUserInfo: () => Promise<void>
}

// Context 和 hook 不放在 LoginProvider.tsx 里：组件文件只导出组件，热更新才能保留状态
export const LoginContext = createContext<LoginContextValue | null>(null)

/** 读取登录状态，必须在 LoginProvider 内使用 */
export function useLogin() {
  const ctx = useContext(LoginContext)
  if (!ctx) {
    throw new Error('useLogin 必须在 LoginProvider 内使用')
  }
  return ctx
}
