import { Outlet, ScrollRestoration, useMatches } from 'react-router-dom'
import IconLink from '~icons/solar/link-minimalistic-linear'
import { LoginDialog } from '@/components/auth/LoginDialog'
import { GuideCue } from '@/components/guide'
import { Header } from '@/components/Header'
import { cn } from '@/lib/utils'

const REPO_URL = 'https://github.com/MaxMini-lv999/offer-hub'

/** 路由的 handle：immersive 为 true 的页面（沉浸式刷题）占满导航栏下面的整屏，自己管滚动，不显示页脚 */
export interface RouteHandle {
  immersive?: boolean
}

/** 全站布局：56px 吸顶导航 + 1200px 内容区 + 一行页脚；沉浸式页面是导航 + 整屏内容区 */
export function Layout() {
  const immersive = useMatches().some(match => (match.handle as RouteHandle | undefined)?.immersive)

  return (
    <div
      className={cn(
        'flex flex-col',
        // clip 而不是 hidden：hidden 的容器还能被 scrollIntoView 滚动，整屏会被推上去
        immersive ? 'h-dvh overflow-hidden supports-[overflow:clip]:overflow-clip' : 'min-h-screen'
      )}
    >
      <Header />

      <main
        className={cn(
          immersive ? 'min-h-0 flex-1' : 'mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 md:py-8'
        )}
      >
        <Outlet />
      </main>

      <footer className={cn('border-t', immersive && 'hidden')}>
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
      <GuideCue immersive={immersive} />

      {/* 换页时回到顶部，浏览器后退时还原滚动位置；改筛选条件的 setSearchParams 传了 preventScrollReset，不会跳 */}
      <ScrollRestoration />
    </div>
  )
}
