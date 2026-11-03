import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import IconAltArrowDown from '~icons/solar/alt-arrow-down-linear'
import IconAltArrowUp from '~icons/solar/alt-arrow-up-linear'
import IconChat from '~icons/solar/chat-round-line-linear'
import IconPen from '~icons/solar/pen-linear'
import IconTrash from '~icons/solar/trash-bin-minimalistic-linear'
import { CommentEditor } from '@/components/comment/CommentEditor'
import { useCommentsContext } from '@/components/comment/context'
import { ReplyBoxEnhanced } from '@/components/comment/ReplyBoxEnhanced'
import { SubComments } from '@/components/comment/SubComments'
import { LikeContent } from '@/components/LikeContent'
import { useDeleteComment, useThumbsUpComment, useUpdateComment } from '@/hooks/useCommentQueries'
import { useLikeEffect } from '@/hooks/useLikeEffect'
import { useLogin } from '@/hooks/useLogin'
import { cn } from '@/lib/utils'
import type { CommentItem as CommentItemData } from '@/types/comment'

/** 作者账号已注销时后端返回空的 user_name */
const UNKNOWN_USER = '已注销用户'

/**
 * 一条评论：头像、昵称、时间、内容，底部是点赞 / 回复 / 编辑 / 删除（后两个只有自己的评论有）。
 * isSub 为 false 的顶层评论有回复时，下面多一个「查看 N 条回复」，展开后是 SubComments。
 * 回复框和编辑框开在哪条评论下面由 Comments 统一管，同一时间只开一个
 */
export function CommentItem({
  comment,
  isSub = false,
  replyTargetName,
}: {
  comment: CommentItemData
  isSub?: boolean
  /** 子评论回复的不是顶层评论的作者时，昵称后面显示「回复 @xx」 */
  replyTargetName?: string
}) {
  const { isLoggedIn, userInfo, setShowLoginDialog } = useLogin()
  const { replyingTo, editingComment, setReplyingTo, setEditingComment } = useCommentsContext()
  const thumbsUp = useThumbsUpComment()
  const [likeEffect, playLikeEffect] = useLikeEffect()
  const deleteComment = useDeleteComment()
  const updateComment = useUpdateComment()
  const [expanded, setExpanded] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const id = comment.comment_id
  const name = comment.user_name || UNKNOWN_USER
  const isOwn = !!userInfo && userInfo.user_id === comment.user_id
  const replying = replyingTo === id
  const editing = editingComment === id
  // 发表时 create_time 和 update_time 相同，修改评论只改 update_time
  const edited = comment.update_time !== comment.create_time

  // 点赞和回复要登录，游客点了先打开登录弹窗
  function requireLogin(action: () => void) {
    if (isLoggedIn) action()
    else setShowLoginDialog(true)
  }

  const actionError = thumbsUp.isError
    ? `点赞失败：${thumbsUp.error.message}`
    : deleteComment.isError
      ? `删除失败：${deleteComment.error.message}`
      : null

  return (
    <article className={cn('flex gap-3', isSub ? 'py-3' : 'py-4')}>
      <Avatar src={comment.user_avatar} name={name} small={isSub} />

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-2 text-meta">
          <span className="font-medium text-foreground">{name}</span>
          {replyTargetName && (
            <span className="text-muted-foreground">
              回复 <span className="text-foreground">@{replyTargetName}</span>
            </span>
          )}
          <time dateTime={comment.create_time.replace(' ', 'T')} className="text-muted-foreground">
            {comment.create_time.slice(0, 16)}
          </time>
          {edited && <span className="text-muted-foreground">已编辑</span>}
        </header>

        {editing ? (
          <CommentEditor
            label="编辑评论"
            submitLabel="保存"
            initialValue={comment.content}
            autoFocus
            onSubmit={async (content) => {
              await updateComment.mutateAsync({ comment_id: id, content })
              setEditingComment(null)
            }}
            onCancel={() => setEditingComment(null)}
            className="mt-2"
          />
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-body">{comment.content}</p>
        )}

        {!editing && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-muted-foreground">
            {confirmingDelete ? (
              <>
                <span className="text-foreground">确定删除这条评论？</span>
                <ActionButton
                  onClick={() => deleteComment.mutate({ comment_id: id }, { onError: () => setConfirmingDelete(false) })}
                  disabled={deleteComment.isPending}
                  className="font-medium text-foreground"
                >
                  {deleteComment.isPending ? '删除中…' : '删除'}
                </ActionButton>
                {!deleteComment.isPending && (
                  <ActionButton onClick={() => setConfirmingDelete(false)}>取消</ActionButton>
                )}
              </>
            ) : (
              <>
                {/* 不用 disabled：变灰会打断按下的动效，请求进行中的点击直接忽略 */}
                <ActionButton
                  onClick={() =>
                    requireLogin(() => {
                      if (thumbsUp.isPending) return
                      thumbsUp.mutate(comment, { onSuccess: (data) => playLikeEffect(data.liked) })
                    })
                  }
                  aria-pressed={comment.user_liked}
                  aria-busy={thumbsUp.isPending}
                  aria-label={`点赞，当前 ${comment.thumbs_up} 个赞`}
                  className={cn('group', comment.user_liked && 'text-foreground')}
                >
                  <LikeContent liked={comment.user_liked} pending={thumbsUp.isPending} effect={likeEffect}>
                    {comment.thumbs_up > 0 ? comment.thumbs_up : '赞'}
                  </LikeContent>
                </ActionButton>
                <ActionButton
                  onClick={() => requireLogin(() => setReplyingTo(replying ? null : id))}
                  aria-expanded={replying}
                  className={cn(replying && 'text-foreground')}
                >
                  <IconChat />
                  回复
                </ActionButton>
                {isOwn && (
                  <>
                    <ActionButton onClick={() => setEditingComment(id)}>
                      <IconPen />
                      编辑
                    </ActionButton>
                    <ActionButton onClick={() => setConfirmingDelete(true)}>
                      <IconTrash />
                      删除
                    </ActionButton>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {actionError && (
          <p role="alert" className="mt-1 text-meta text-foreground">
            {actionError}
          </p>
        )}

        {/* 回复顶层评论成功后展开回复列表，刚发的那条能看到 */}
        {replying && <ReplyBoxEnhanced comment={comment} onReplied={() => setExpanded(true)} />}

        {!isSub && comment.sub_comment_total > 0 && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-2 inline-flex items-center gap-1 text-meta font-medium text-foreground underline-offset-4 hover:underline"
            >
              {expanded ? '收起回复' : `查看 ${comment.sub_comment_total} 条回复`}
              {expanded ? <IconAltArrowUp className="size-3.5" /> : <IconAltArrowDown className="size-3.5" />}
            </button>
            {expanded && <SubComments parent={comment} />}
          </>
        )}
      </div>
    </article>
  )
}

/** 操作栏里的文字按钮：图标 + 文字，悬停变墨色 */
function ActionButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex min-h-6 items-center gap-1 transition-colors duration-micro hover:text-foreground disabled:opacity-50 [&_svg]:size-3.5',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/** 方形头像；没有头像或图片加载失败时显示昵称第一个字 */
function Avatar({ src, name, small }: { src: string; name: string; small: boolean }) {
  const [failed, setFailed] = useState(false)
  const size = small ? 'size-7' : 'size-9'

  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={cn('flex shrink-0 items-center justify-center border bg-muted font-title text-meta text-muted-foreground', size)}
      >
        {[...name][0]}
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('shrink-0 border bg-muted object-cover', size)}
    />
  )
}

/** 和评论同形的骨架：头像 + 昵称一行 + 两行内容 + 操作栏 */
export function CommentSkeleton({ small = false }: { small?: boolean }) {
  return (
    <div className={cn('flex gap-3 skeleton', small ? 'py-3' : 'py-4')}>
      <div className={cn('shrink-0 bg-skeleton', small ? 'size-7' : 'size-9')} />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 bg-skeleton" />
        <div className="h-4 w-full bg-skeleton" />
        <div className="h-4 w-2/3 bg-skeleton" />
        <div className="h-4 w-24 bg-skeleton" />
      </div>
    </div>
  )
}
