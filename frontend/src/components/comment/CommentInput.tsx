import { CommentEditor } from '@/components/comment/CommentEditor'
import { useCommentsContext } from '@/components/comment/context'
import { useAddComment } from '@/hooks/useCommentQueries'
import { useLogin } from '@/hooks/useLogin'
import { cn } from '@/lib/utils'

/**
 * 发表顶层评论。游客看到的是一个长得像输入框的按钮，点它（或聚焦后按回车）打开登录弹窗；
 * 登录成功后弹窗关闭，这里当场换成真正的输入框
 */
export function CommentInput({ className }: { className?: string }) {
  const { isLoggedIn, setShowLoginDialog } = useLogin()
  const { targetType, targetId } = useCommentsContext()
  const addComment = useAddComment()

  if (!isLoggedIn) {
    return (
      <button
        type="button"
        onClick={() => setShowLoginDialog(true)}
        className={cn(
          'flex min-h-[88px] w-full items-start justify-between gap-4 border border-input px-3 py-2 text-left text-body text-muted-foreground transition-colors duration-micro hover:border-foreground',
          className,
        )}
      >
        <span>写下你的想法…</span>
        <span className="shrink-0 text-meta underline underline-offset-4">登录后发表评论</span>
      </button>
    )
  }

  return (
    <CommentEditor
      label="发表评论"
      placeholder="写下你的想法…"
      submitLabel="发表"
      onSubmit={(content) => addComment.mutateAsync({ target_type: targetType, target_id: targetId, content })}
      className={className}
    />
  )
}
