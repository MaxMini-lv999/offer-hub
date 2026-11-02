import type { CommentTargetType } from '@/types/comment'

/** 评论对象类型：题目 */
export const COMMENT_TARGET_QUESTION: CommentTargetType = 1

/** 评论最长字数，和后端的 max=1000 一致，按字符算（emoji 算一个） */
export const COMMENT_MAX_LENGTH = 1000

/** 顶层评论每次加载的条数 */
export const COMMENT_PAGE_SIZE = 10

/** 子评论每次加载的条数。顶层评论里附带的第一页也按这个数要，展开后接着往下翻 */
export const SUB_COMMENT_PAGE_SIZE = 5
