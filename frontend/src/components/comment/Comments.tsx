import { useCallback, useId, useMemo, useState } from 'react'
import { CommentInput } from '@/components/comment/CommentInput'
import { CommentList } from '@/components/comment/CommentList'
import { CommentsContext, type CommentsContextValue } from '@/components/comment/context'
import { LoadingBar } from '@/components/LoadingBar'
import { COMMENT_PAGE_SIZE, SUB_COMMENT_PAGE_SIZE } from '@/constants/comment'
import { useComments } from '@/hooks/useCommentQueries'
import { cn } from '@/lib/utils'
import type { CommentTargetType } from '@/types/comment'

/**
 * 评论区入口：标题 + 发表评论 + 顶层评论列表。回复框和编辑框同一时间只开一个，状态放在这里，
 * 通过 Context 交给下面每一层评论。换题目时要用 key 重新挂载，不然上一题打开的回复框还在
 */
export function Comments({
  targetType,
  targetId,
  className,
}: {
  targetType: CommentTargetType
  targetId: string
  className?: string
}) {
  const [replyingTo, setReplyingToState] = useState<string | null>(null)
  const [editingComment, setEditingCommentState] = useState<string | null>(null)
  const headingId = useId()

  const query = useComments({
    target_type: targetType,
    target_id: targetId,
    page_size: COMMENT_PAGE_SIZE,
    sub_comment_size: SUB_COMMENT_PAGE_SIZE,
  })
  const total = query.data?.pages[0]?.total
  // 发表、修改、删除后整页重新拉取时在标题下面的线上走加载条；首次加载有骨架、加载更多有按钮文案，不重复提示
  const refreshing = query.isFetching && !query.isPending && !query.isFetchingNextPage

  const setReplyingTo = useCallback((commentId: string | null) => {
    setReplyingToState(commentId)
    if (commentId) setEditingCommentState(null)
  }, [])
  const setEditingComment = useCallback((commentId: string | null) => {
    setEditingCommentState(commentId)
    if (commentId) setReplyingToState(null)
  }, [])

  const value = useMemo<CommentsContextValue>(
    () => ({ targetType, targetId, replyingTo, editingComment, setReplyingTo, setEditingComment }),
    [targetType, targetId, replyingTo, editingComment, setReplyingTo, setEditingComment]
  )

  return (
    <CommentsContext.Provider value={value}>
      <section aria-labelledby={headingId} className={cn('border-t pt-6', className)}>
        <div className="relative flex items-baseline gap-2 border-b pb-3">
          <h2 id={headingId} className="font-title text-heading font-semibold">
            评论
          </h2>
          {total !== undefined && (
            <span className="text-meta text-muted-foreground">{total} 条</span>
          )}
          {refreshing && <LoadingBar label="正在刷新评论" />}
        </div>
        <CommentInput className="mt-4" />
        <CommentList query={query} className="mt-6" />
      </section>
    </CommentsContext.Provider>
  )
}
