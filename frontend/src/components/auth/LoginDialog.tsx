import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CharacterSprite } from '@/components/art'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { AUTH_LINES, AUTH_TITLES, type AuthMode } from '@/constants/auth'
import { useLogin } from '@/hooks/useLogin'

// 表单带着表单校验库（zod、react-hook-form），不进首屏包；游客在浏览器空闲时先下载好，点登录时不用等
const loadAuthForm = () => import('@/components/auth/AuthForm')
const AuthForm = lazy(() =>
  loadAuthForm().then(
    (m) => ({ default: m.AuthForm }),
    // 下载失败（断网、发版后旧文件没了）时在弹窗里提示刷新，不让错误冒到路由的出错页
    () => ({ default: AuthFormLoadError }),
  ),
)

/**
 * 全站唯一的登录 / 注册弹窗，挂在 Layout 里，开关是 useLogin() 的 showLoginDialog。
 * 每次打开都从登录页签开始，澜汐挥一次手；登录成功（或在其他标签页登录了）就关掉
 */
export function LoginDialog() {
  const { isLoggedIn, showLoginDialog, setShowLoginDialog } = useLogin()
  const open = showLoginDialog && !isLoggedIn
  // 弹窗由各处的按钮通过 Context 打开，没有 DialogTrigger，Radix 关闭时不知道把焦点还给谁；
  // 打开的那一刻记下焦点所在的按钮（layout effect 先于弹窗内部的自动聚焦），关闭时还回去
  const returnFocusRef = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (open) returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }, [open])

  useEffect(() => {
    if (isLoggedIn) {
      setShowLoginDialog(false)
      return
    }
    // Safari 没有 requestIdleCallback，延后 2 秒
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(() => void loadAuthForm().catch(() => {}))
      return () => cancelIdleCallback(id)
    }
    const timer = setTimeout(() => void loadAuthForm().catch(() => {}), 2000)
    return () => clearTimeout(timer)
  }, [isLoggedIn, setShowLoginDialog])

  return (
    <Dialog open={open} onOpenChange={setShowLoginDialog}>
      <DialogContent
        className="max-w-[420px]"
        onCloseAutoFocus={(e) => {
          // 登录成功后入口按钮可能已经不在了（换成了昵称），那就不抢焦点
          e.preventDefault()
          if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus()
        }}
      >
        <LoginDialogBody onSuccess={() => setShowLoginDialog(false)} />
      </DialogContent>
    </Dialog>
  )
}

/** 弹窗内容，关掉时跟着 DialogContent 卸载，所以页签状态不用手动重置 */
function LoginDialogBody({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<AuthMode>('login')

  return (
    <div className="space-y-5 p-6">
      {/* 右边留出关闭按钮的位置 */}
      <header className="flex items-start gap-4 pr-8">
        {/* 头像垫一块纸白，暗色下深蓝头发才看得清 */}
        <div className="flex shrink-0 bg-dialogue-foreground">
          <CharacterSprite name="wave" size={56} />
        </div>
        <div className="min-w-0 space-y-1">
          <DialogTitle>{AUTH_TITLES[mode]}</DialogTitle>
          <DialogDescription>{AUTH_LINES[mode]}</DialogDescription>
        </div>
      </header>

      <Suspense fallback={<AuthFormSkeleton />}>
        <AuthForm mode={mode} onModeChange={setMode} onSuccess={onSuccess} autoFocus />
      </Suspense>
    </div>
  )
}

/**
 * 表单还没下载好时的占位，和登录页签的表单同形状、同高度（页签、两个输入框、按钮），加载完不跳。
 * 行高照着真实表单：页签一行 26.5px（正文行高 + 2px 下划线），标签一行 25.5px，色块在行里垂直居中
 */
function AuthFormSkeleton() {
  return (
    <div aria-hidden className="skeleton space-y-5">
      <div className="grid grid-cols-2 border-b pb-3 pt-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex h-[26.5px] items-center justify-center">
            <span className="h-4 w-8 bg-skeleton" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2">
            <div className="flex h-[25.5px] items-center">
              <span className="h-4 w-12 bg-skeleton" />
            </div>
            <div className="h-9 bg-skeleton" />
          </div>
        ))}
        <div className="h-9 bg-skeleton" />
      </div>
    </div>
  )
}

function AuthFormLoadError() {
  return (
    <div role="alert" className="space-y-4 border-t pt-5">
      <p className="text-meta text-muted-foreground">登录表单没加载出来，可能是网络断了或网站刚更新过。</p>
      <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
        刷新页面
      </Button>
    </div>
  )
}
