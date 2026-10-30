import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LoginContext, type LoginContextValue } from '@/hooks/useLogin'
import { getToken, setToken, subscribeToken } from '@/lib/axios'
import { getUserInfo, mapPasswordAuthUserToUserInfo, postAuthLogout } from '@/services/auth'
import type { PasswordAuthUserDTO, UserInfo } from '@/types/auth'

/** 全局登录状态，需要放在 QueryProvider 里面：登录、登出后要让题目缓存失效 */
export function LoginProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  // token 以 localStorage 为准，拦截器遇到 401 清掉它时这里会跟着变
  const token = useSyncExternalStore(subscribeToken, getToken)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  const refreshUserInfo = useCallback(async () => {
    const requestToken = getToken()
    const info = await getUserInfo()
    // 请求期间登出或换了账号，丢掉旧账号的结果
    if (getToken() === requestToken) {
      setUserInfo(info)
    }
  }, [])

  // 页面打开时有 token 就恢复用户信息；token 换了（登录、其他标签页切换账号）也重新拉，拿到简介等完整资料
  useEffect(() => {
    if (!token) return
    refreshUserInfo().catch(() => {
      // 401 时拦截器已清掉 token；网络错误或 500 时保持登录，用户信息等下次再拉
    })
  }, [token, refreshUserInfo])

  const login = useCallback(
    (user: PasswordAuthUserDTO, newToken: string) => {
      setUserInfo(mapPasswordAuthUserToUserInfo(user))
      setToken(newToken)
      // 题目内容和掌握状态按登录态返回，缓存里的游客版本要重新拉
      void queryClient.invalidateQueries()
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    // 先调接口再清 token：请求拦截器要从 localStorage 读 token 放进请求头
    if (getToken()) {
      try {
        await postAuthLogout()
      } catch {
        // token 早已失效或网络出错时也照样退出，本地不能卡在已登录
      }
    }
    setToken(null)
    setUserInfo(null)
    void queryClient.invalidateQueries()
  }, [queryClient])

  const value = useMemo<LoginContextValue>(
    () => ({
      isLoggedIn: !!token,
      // token 被拦截器或其他标签页清掉时，userInfo 跟着作废
      userInfo: token ? userInfo : null,
      login,
      logout,
      showLoginDialog,
      setShowLoginDialog,
      refreshUserInfo,
    }),
    [token, userInfo, login, logout, showLoginDialog, refreshUserInfo],
  )

  return <LoginContext.Provider value={value}>{children}</LoginContext.Provider>
}
