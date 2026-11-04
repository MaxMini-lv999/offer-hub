import IconChat from '~icons/solar/chat-round-line-linear'
import { CommentItem, CommentSkeleton } from '@/components/comment/CommentItem'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import type { useComments } from '@/hooks/useCommentQueries'
import { cn } from '@/lib/utils'

/**
 * 顶层评论列表，数据由 Comments 查好传进来（标题里的总数也要用）。
 * 首次加载显示骨架，没加载出来时整块换成出错状态；已经有数据后再出错（加载更多、刷新失败）只在列表下面提示一行，不清掉已有评论
 */
export function CommentList({
  query,
  className,
}: {
  query: ReturnType<typeof useComments>
  className?: string
}) {
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = query

  if (isPending) {
    return (
      <div aria-hidden className={cn('divide-y border-y', className)}>
        {[0, 1, 2].map(i => (
          <CommentSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <ErrorState
        message={error?.message ?? '未知错误'}
        onRetry={() => refetch()}
        className={className}
      />
    )
  }

  const comments = data.pages.flatMap(page => page.list)

  if (comments.length === 0) {
    return (
      // 澜汐敲键盘的静态封面，缩到 96px：详情页正文下面、沉浸刷题的评论抽屉里都不抢主内容
      <EmptyState
        icon={<IconChat className="size-8" />}
        pose="typing"
        poseSize={96}
        title="还没有评论"
        hint="来写下第一条吧"
        className={className}
      />
    )
  }

  return (
    <div className={className}>
      <ul className="divide-y border-y">
        {comments.map(comment => (
          <li key={comment.comment_id}>
            <CommentItem comment={comment} />
          </li>
        ))}
      </ul>
      {isError && (
        <p role="alert" className="mt-4 text-meta text-foreground">
          加载失败：{error.message}
        </p>
      )}
      {hasNextPage && (
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? '加载中…' : '加载更多'}
        </Button>
      )}
    </div>
  )
}
