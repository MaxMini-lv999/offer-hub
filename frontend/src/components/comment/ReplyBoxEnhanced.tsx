import { CommentEditor } from '@/components/comment/CommentEditor'
import { useCommentsContext } from '@/components/comment/context'
import { useAddComment } from '@/hooks/useCommentQueries'
import type { CommentItem } from '@/types/comment'

/**
 * 回复框，开在被回复的评论下面。评论只有两层：回复顶层评论时 parent_id 是它自己，
 * 回复子评论时 parent_id 是子评论所属的顶层评论；reply_to 都是被回复的那个人
 */
export function ReplyBoxEnhanced({ comment, onReplied }: { comment: CommentItem; onReplied?: () => void }) {
  const { targetType, targetId, setReplyingTo } = useCommentsContext()
  const addComment = useAddComment()
  const name = comment.user_name || '已注销用户'

  return (
    <div className="mt-3">
      <p className="mb-2 text-meta text-muted-foreground">
        回复 <span className="text-foreground">@{name}</span>
      </p>
      <CommentEditor
        label={`回复 ${name}`}
        placeholder={`回复 @${name}…`}
        submitLabel="回复"
        autoFocus
        onSubmit={async (content) => {
          await addComment.mutateAsync({
            target_type: targetType,
            target_id: targetId,
            parent_id: comment.parent_id || comment.comment_id,
            reply_to: comment.user_id,
            content,
          })
          setReplyingTo(null)
          onReplied?.()
        }}
        onCancel={() => setReplyingTo(null)}
      />
    </div>
  )
}
