import { Link } from 'react-router-dom'
import { SearchStatus } from 'reicon-react'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <SearchStatus size={40} className="text-muted-foreground" />
      <h1 className="text-title font-semibold">404</h1>
      <p className="text-muted-foreground">页面不存在，可能链接有误或内容已下线。</p>
      <Button asChild>
        <Link to="/">返回首页</Link>
      </Button>
    </div>
  )
}
