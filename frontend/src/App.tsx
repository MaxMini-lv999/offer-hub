import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { QueryProvider } from '@/components/provider/query-provider'
import { RouteLoading } from '@/components/RouteLoading'
import { ErrorPage } from '@/pages/ErrorPage'
import { HomePage } from '@/pages/home'
import { NotFoundPage } from '@/pages/not-found'
import { QuestionBankPage } from '@/pages/QuestionBank'
import { QuestionsPage } from '@/pages/Questions'

async function loadLoginPage(mode: 'login' | 'register') {
  const { LoginPage } = await import('@/pages/Login')
  return { element: <LoginPage mode={mode} /> }
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
            {
              path: 'question/:questionId',
              // 详情页带着 markdown 渲染和代码高亮，体积大，进入时再加载
              lazy: async () => ({ Component: (await import('@/pages/QuestionDetail')).QuestionDetailPage }),
            },
            // 旧的题库分类页已并入首页
            { path: 'collections', element: <Navigate to="/" replace /> },
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
  },
)

export default function App() {
  return (
    <QueryProvider>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryProvider>
  )
}
