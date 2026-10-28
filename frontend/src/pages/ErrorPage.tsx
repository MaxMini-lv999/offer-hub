import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { AlertTriangle } from 'reicon-react'
import { Button } from '@/components/ui/button'

/** 路由的 errorElement：渲染时抛出的异常都兜到这里，不至于整页白屏 */
export function ErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : '未知错误'

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-24 text-center">
      <AlertTriangle size={40} className="text-muted-foreground" />
      <h1 className="text-title font-semibold">页面出错了</h1>
      <p className="max-w-md break-words text-muted-foreground">{message}</p>
      <div className="flex gap-3">
        <Button onClick={() => window.location.reload()}>刷新页面</Button>
        <Button variant="outline" asChild>
          <Link to="/">返回首页</Link>
        </Button>
      </div>
    </div>
  )
}
