import { useRef, useState } from 'react'
import { Link, useLocation, useNavigation } from 'react-router-dom'
import { ChevronDown, Logout, Moon, Sun } from 'reicon-react'
import { LoadingBar } from '@/components/LoadingBar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogin } from '@/hooks/useLogin'
import { setTheme, useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import type { UserInfo } from '@/types/auth'

/** 顶部导航项；题库页从首页进入，所以也算在「首页」下 */
const NAV_ITEMS = [
  { to: '/', label: '首页', isActive: (path: string) => path === '/' || path.startsWith('/bank/') },
  { to: '/questions', label: '全部题目', isActive: (path: string) => path === '/questions' },
]

/** 站点标识：两本书夹一枚樱红书签。墨色和纸白跟随主题 token，暗色下自动反色；favicon 是同一个图形（public/favicon.svg） */
function BrandMark() {
  return (
    <svg viewBox="0 0 64 64" width={24} height={24} aria-hidden>
      <path className="fill-foreground" d="M6 8h22v48H6zM36 8h22v48H36z" />
      <path className="fill-background" d="M12 14h10v30l-5-4-5 4zM42 14h10v30l-5-4-5 4z" />
      <path className="fill-brand" d="M27 23h10v18H27z" />
    </svg>
  )
}

/** 56px 吸顶导航：左边站点标识，中间页面导航，右边主题切换和账号入口 */
export function Header() {
  const { pathname } = useLocation()
  const theme = useTheme()
  // 进入按需加载的页面（题目详情、登录）要先下载代码，这段时间旧页面还留在屏幕上，导航栏底边出加载条
  const navigating = useNavigation().state !== 'idle'

  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background">
      {/* 手机上两侧按内容宽度、导航在剩余空间居中；宽屏两侧等宽，导航正好在页面正中 */}
      <div className="mx-auto grid h-full max-w-[1200px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:grid-cols-[1fr_auto_1fr]">
        <Link to="/" aria-label="Offer Hub 首页" className="flex items-center gap-2 justify-self-start whitespace-nowrap">
          <BrandMark />
          {/* 手机上放不下，只留标识 */}
          <span className="hidden font-title text-heading font-semibold leading-none sm:inline">Offer Hub</span>
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

        <div className="flex min-w-0 items-center gap-3 justify-self-end">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
            title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
            className="flex h-9 w-9 shrink-0 items-center justify-center transition-colors duration-micro ease-standard hover:bg-muted"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <AccountEntry />
        </div>
      </div>
      {navigating && <LoadingBar label="页面加载中" />}
    </header>
  )
}

/**
 * 账号入口：游客是「登录」，打开登录弹窗；已登录是头像 + 昵称，点开下拉菜单退出登录。
 * 刷新页面后用户信息还没拉回来时先放骨架，不闪回「登录」
 */
function AccountEntry() {
  const { isLoggedIn, userInfo, logout, setShowLoginDialog } = useLogin()
  // 从菜单里退出后头像和菜单一起消失，焦点交给新出现的「登录」按钮，键盘用户不会丢位置
  const focusLoginRef = useRef(false)

  if (!isLoggedIn) {
    return (
      <button
        ref={(el) => {
          if (el && focusLoginRef.current) {
            focusLoginRef.current = false
            el.focus()
          }
        }}
        type="button"
        onClick={() => setShowLoginDialog(true)}
        className="whitespace-nowrap font-medium decoration-2 underline-offset-4 hover:underline"
      >
        登录
      </button>
    )
  }

  if (!userInfo) {
    return (
      <span aria-hidden className="skeleton flex h-9 items-center gap-2 px-1">
        <span className="h-7 w-7 bg-skeleton" />
        <span className="h-4 w-12 bg-skeleton sm:w-16" />
      </span>
    )
  }

  return (
    <UserMenu
      userInfo={userInfo}
      onLogout={() => {
        // 先立标记再退出：logout 清掉登录状态时「登录」按钮就挂载了，比 await 之后的代码早
        focusLoginRef.current = true
        return logout()
      }}
    />
  )
}

/** 头像 + 昵称，点开是账号菜单。退出要先调登出接口，请求期间菜单留着，菜单项显示「退出中…」 */
function UserMenu({ userInfo, onLogout }: { userInfo: UserInfo; onLogout: () => Promise<void> }) {
  const [leaving, setLeaving] = useState(false)
  const name = userInfo.nick_name || userInfo.username

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`账号菜单（${name}）`}
        className="flex h-9 min-w-0 items-center gap-2 px-1 transition-colors duration-micro ease-standard hover:bg-muted data-[state=open]:bg-muted"
      >
        <UserAvatar src={userInfo.avatar} name={name} />
        {/* 手机上导航栏挤，昵称最多显示 4 个字左右 */}
        <span className="max-w-[4.5em] truncate font-medium sm:max-w-[8em]">{name}</span>
        <ChevronDown size={14} aria-hidden className="hidden shrink-0 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuLabel className="space-y-0.5 py-2 font-normal">
          <p className="truncate text-body font-medium">{name}</p>
          {/* 注册时昵称默认等于用户名，一样就不重复显示 */}
          {name !== userInfo.username && (
            <p className="truncate text-meta text-muted-foreground">用户名：{userInfo.username}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={leaving}
          onSelect={(e) => {
            // 不让菜单立刻关掉：登出接口返回前留着菜单显示进度，返回后整个菜单随登录状态卸载
            e.preventDefault()
            setLeaving(true)
            void onLogout()
          }}
        >
          <Logout />
          {leaving ? '退出中…' : '退出登录'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** 头像：有头像地址就显示图片；没有或加载失败时用墨色方块里的昵称首字（注册时后端不设头像，大多数人是这种） */
function UserAvatar({ src, name }: { src: string; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string>()

  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt=""
        width={28}
        height={28}
        onError={() => setFailedSrc(src)}
        className="h-7 w-7 shrink-0 bg-muted object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center bg-foreground font-title text-meta font-semibold text-background"
    >
      {[...name][0]?.toUpperCase()}
    </span>
  )
}
