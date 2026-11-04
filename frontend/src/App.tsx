import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout, type RouteHandle } from '@/components/layout'
import { LoginProvider } from '@/components/provider/LoginProvider'
import { QueryProvider } from '@/components/provider/query-provider'
import { RouteLoading } from '@/components/RouteLoading'
import { BankCatalogPage } from '@/pages/BankCatalog'
import { ErrorPage } from '@/pages/ErrorPage'
import { HomePage } from '@/pages/home'
import { HotContentPage } from '@/pages/HotContent'
import { NotFoundPage } from '@/pages/not-found'
import { QuestionBankPage } from '@/pages/QuestionBank'
import { QuestionsPage } from '@/pages/Questions'

async function loadLoginPage(mode: 'login' | 'register') {
  const { LoginPage } = await import('@/pages/Login')
  return { element: <LoginPage mode={mode} /> }
}

// 详情页带着 markdown 渲染和代码高亮，体积大，按需加载；它又是最常去的页面，
// 所以首屏渲染完、浏览器空闲时先把代码下载好，点题目时不用再等（Safari 没有 requestIdleCallback，延后 2 秒）
const loadQuestionDetail = () => import('@/pages/QuestionDetail')
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => loadQuestionDetail())
} else {
  setTimeout(loadQuestionDetail, 2000)
}

// 注意：页面路由不要以 /api、/auth、/home 开头，开发时这几个前缀会被 Vite 代理到后端
const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      // 布局本身出错时的兜底，此时没有导航栏
      errorElement: <ErrorPage />,
      children: [
        {
          // 页面出错时在布局里显示出错页，导航栏和页脚保留
          errorElement: <ErrorPage />,
          // 直接打开按需加载的页面时，代码下载完之前内容区显示加载插画（300ms 后才淡入），导航栏和页脚照常显示
          hydrateFallbackElement: <RouteLoading />,
          children: [
            { index: true, element: <HomePage /> },
            { path: 'bank/:bankId', element: <QuestionBankPage /> },
            { path: 'questions', element: <QuestionsPage /> },
            { path: 'collections', element: <BankCatalogPage /> },
            { path: 'hot', element: <HotContentPage /> },
            {
              // 沉浸式刷题：内容区占满导航栏下面的整屏，没有页脚（见 layout.tsx）。带着 markdown 渲染，按需加载
              path: 'feed',
              handle: { immersive: true } satisfies RouteHandle,
              lazy: async () => ({ Component: (await import('@/pages/Feed')).FeedPage }),
            },
            {
              path: 'question/:questionId',
              lazy: async () => ({ Component: (await loadQuestionDetail()).QuestionDetailPage }),
            },
            // 登录页带着表单校验库（zod、react-hook-form），进入时再加载
            { path: 'login', lazy: () => loadLoginPage('login') },
            { path: 'register', lazy: () => loadLoginPage('register') },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ],
  {
    // 提前启用 v7 行为，消除控制台的 Future Flag 警告
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  }
)

export default function App() {
  return (
    <QueryProvider>
      <LoginProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </LoginProvider>
    </QueryProvider>
  )
}
