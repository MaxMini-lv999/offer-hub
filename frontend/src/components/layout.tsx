import { Outlet, ScrollRestoration } from 'react-router-dom'
import IconLink from '~icons/solar/link-minimalistic-linear'
import { LoginDialog } from '@/components/auth/LoginDialog'
import { Header } from '@/components/Header'

const REPO_URL = 'https://github.com/MaxMini-lv999/offer-hub'

/** 全站布局：56px 吸顶导航 + 1200px 内容区 + 一行页脚 */
export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 md:py-8">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-4 text-meta text-muted-foreground">
          <span>© {new Date().getFullYear()} Offer Hub</span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 decoration-2 underline-offset-4 hover:text-foreground hover:underline"
          >
            <IconLink className="size-3.5" />
            GitHub 仓库
          </a>
        </div>
      </footer>

      <LoginDialog />

      {/* 换页时回到顶部，浏览器后退时还原滚动位置；改筛选条件的 setSearchParams 传了 preventScrollReset，不会跳 */}
      <ScrollRestoration />
    </div>
  )
}
