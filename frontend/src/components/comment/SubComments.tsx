import { CommentItem, CommentSkeleton } from '@/components/comment/CommentItem'
import { useCommentsContext } from '@/components/comment/context'
import { useSubComments } from '@/hooks/useCommentQueries'
import type { CommentItem as CommentItemData } from '@/types/comment'

/**
 * 顶层评论展开后的回复列表，左边一条竖线和顶层评论区分开。第一页用顶层评论附带的那几条，
 * 没加载完时底部是「查看更多回复」，每次再取一页
 */
export function SubComments({ parent }: { parent: CommentItemData }) {
  const { targetType, targetId } = useCommentsContext()
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useSubComments(targetType, targetId, parent)

  const replies = data?.pages.flatMap(page => page.list) ?? []
  const total = data?.pages.at(-1)?.total ?? parent.sub_comment_total

  return (
    <div className="mt-2 border-l pl-4">
      {isPending && (
        <div aria-hidden className="divide-y">
          <CommentSkeleton small />
          <CommentSkeleton small />
        </div>
      )}

      {replies.length > 0 && (
        <ul className="divide-y">
          {replies.map(reply => (
            <li key={reply.comment_id}>
              <CommentItem
                comment={reply}
                isSub
                // 直接回复顶层评论作者的不用标，回复的是楼里其他人才显示「回复 @xx」
                replyTargetName={
                  reply.reply_to && reply.reply_to !== parent.user_id
                    ? reply.reply_to_name
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}

      {isError && (
        <p role="alert" className="py-2 text-meta text-foreground">
          加载回复失败：{error.message}
          <button
            type="button"
            onClick={() => (data ? fetchNextPage() : refetch())}
            className="ml-2 font-medium underline underline-offset-4"
          >
            重试
          </button>
        </p>
      )}

      {hasNextPage && !isError && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="py-2 text-meta font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
        >
          {isFetchingNextPage ? '加载中…' : `查看更多回复（还有 ${total - replies.length} 条）`}
        </button>
      )}
    </div>
  )
}
