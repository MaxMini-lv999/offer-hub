import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { Book, Link2 } from 'reicon-react'
import { cn } from '@/lib/utils'

const REPO_URL = 'https://github.com/MaxMini-lv999/offer-hub'

/** 顶部导航项；题库页从首页进入，所以也算在「首页」下 */
const NAV_ITEMS = [
  { to: '/', label: '首页', isActive: (path: string) => path === '/' || path.startsWith('/bank/') },
  { to: '/questions', label: '全部题目', isActive: (path: string) => path === '/questions' },
]

/** 全站布局：56px 吸顶导航 + max-w-6xl 内容区 + 一行页脚 */
export function Layout() {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 h-14 border-b bg-background">
        {/* 手机上两侧按内容宽度、导航在剩余空间居中；宽屏两侧等宽，导航正好在页面正中 */}
        <div className="mx-auto grid h-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:grid-cols-[1fr_auto_1fr]">
          <Link to="/" className="flex items-center gap-2 justify-self-start whitespace-nowrap font-semibold">
            <Book size={20} />
            Offer Hub
          </Link>

          <nav aria-label="主导航" className="flex h-full gap-6 justify-self-center whitespace-nowrap">
            {NAV_ITEMS.map((item) => {
              const active = item.isActive(pathname)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex h-full items-center font-medium transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                  {/* 2px 下划线压在导航栏底边上 */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-x-0 -bottom-px h-0.5',
                      active ? 'bg-foreground' : 'bg-transparent group-hover:bg-muted-foreground',
                    )}
                  />
                </Link>
              )
            })}
          </nav>

          <Link
            to="/login"
            className="justify-self-end whitespace-nowrap font-medium decoration-2 underline-offset-4 hover:underline"
          >
            登录
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 text-meta text-muted-foreground">
          <span>© {new Date().getFullYear()} Offer Hub</span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 decoration-2 underline-offset-4 hover:text-foreground hover:underline"
          >
            <Link2 size={14} />
            GitHub 仓库
          </a>
        </div>
      </footer>

      {/* 换页时回到顶部，浏览器后退时还原滚动位置；改筛选条件的 setSearchParams 传了 preventScrollReset，不会跳 */}
      <ScrollRestoration />
    </div>
  )
}
