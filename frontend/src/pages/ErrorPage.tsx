import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'
import { StageNotice } from '@/components/vn/StageNotice'

/** 路由的 errorElement：渲染时抛出的异常都兜到这里，不至于整页白屏 */
export function ErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : '未知错误'

  return (
    // 布局本身出错时没有外层的内容区，这里自己限宽
    <div className="mx-auto w-full max-w-[1200px]">
      <StageNotice
        code="出错了"
        title="页面出错了"
        line="页面出了点问题，刷新一下通常就好了。"
        detail={message}
        choices={[
          { label: '刷新页面', onSelect: () => window.location.reload() },
          { label: '返回首页', onSelect: () => navigate('/') },
        ]}
      />
    </div>
  )
}
