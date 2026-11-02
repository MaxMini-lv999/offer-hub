import { createContext, useContext } from 'react'
import type { CommentTargetType } from '@/types/comment'

export interface CommentsContextValue {
  targetType: CommentTargetType
  targetId: string
  /** 当前展开回复框的评论 ID，同一时间只展开一个 */
  replyingTo: string | null
  /** 当前正在编辑的评论 ID，和回复框互斥：打开一个会关掉另一个 */
  editingComment: string | null
  /** 传 null 关闭回复框 */
  setReplyingTo: (commentId: string | null) => void
  /** 传 null 退出编辑 */
  setEditingComment: (commentId: string | null) => void
}

// 和 useLogin 一样，Context 不放在组件文件里：组件文件只导出组件，热更新才能保留状态
export const CommentsContext = createContext<CommentsContextValue | null>(null)

/** 读取评论区的共享状态，必须在 Comments 内使用 */
export function useCommentsContext() {
  const ctx = useContext(CommentsContext)
  if (!ctx) {
    throw new Error('useCommentsContext 必须在 Comments 内使用')
  }
  return ctx
}
