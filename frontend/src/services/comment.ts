import { get, post } from '@/lib/request'
import type {
  AddCommentData,
  AddCommentParams,
  CommentListData,
  CommentListParams,
  DeleteCommentParams,
  UpdateCommentData,
  UpdateCommentParams,
} from '@/types/comment'

// code 非 0 时 get / post 会抛出 ApiError（继承 Error，message 是后端的 msg），这里不用再判断

/** GET /api/v1/open/list_comments 评论列表，软鉴权，登录后 user_liked 才有值 */
export function getCommentList(params: CommentListParams) {
  return get<CommentListData>('/api/v1/open/list_comments', { params })
}

/** POST /api/v1/comment/add 发表评论或回复，需要登录 */
export function postAddComment(data: AddCommentParams) {
  return post<AddCommentData>('/api/v1/comment/add', data)
}

/** POST /api/v1/comment/delete 删除评论（软删除），需要登录；响应没有 data 字段 */
export function postDeleteComment(data: DeleteCommentParams) {
  return post<void>('/api/v1/comment/delete', data)
}

/** POST /api/v1/comment/update 修改评论内容，需要登录 */
export function postUpdateComment(data: UpdateCommentParams) {
  return post<UpdateCommentData>('/api/v1/comment/update', data)
}
