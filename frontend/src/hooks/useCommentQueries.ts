import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { SUB_COMMENT_PAGE_SIZE } from '@/constants/comment'
import { LIKE_TARGET_COMMENT } from '@/constants/interaction'
import {
  getCommentList,
  postAddComment,
  postDeleteComment,
  postUpdateComment,
} from '@/services/comment'
import { toggleLike } from '@/services/interaction'
import type {
  AddCommentParams,
  CommentItem,
  CommentListData,
  CommentListParams,
  CommentTargetType,
  DeleteCommentParams,
  UpdateCommentParams,
} from '@/types/comment'

/** 评论列表的参数，不含 page：页码由 useInfiniteQuery 管 */
export type CommentListQuery = Omit<CommentListParams, 'page'>

/**
 * 评论模块的 query key，按层级组织，invalidateQueries 传前缀即可批量失效。
 * target() 只带对象类型和 ID，React Query 按对象子集匹配，能失效这道题下所有排序和子评论列表
 */
export const queryKeys = {
  all: ['comment'] as const,
  lists: () => [...queryKeys.all, 'list'] as const,
  target: (targetType: CommentTargetType, targetId: string) =>
    [...queryKeys.lists(), { target_type: targetType, target_id: targetId }] as const,
  list: (params: CommentListQuery) => [...queryKeys.lists(), params] as const,
}

/** 已加载的条数还不到 total 就取下一页；某一页是空的说明数据在翻页期间变少了，不再往下取 */
function getNextPage(lastPage: CommentListData, allPages: CommentListData[]) {
  const loaded = allPages.reduce((sum, page) => sum + page.list.length, 0)
  return loaded < lastPage.total && lastPage.list.length > 0 ? allPages.length + 1 : undefined
}

/**
 * 评论列表，点「加载更多」调 fetchNextPage 取下一页；parent_id 为空查顶层评论，不为空查该评论的子评论。
 * target_id 为空时不发请求
 */
export function useComments(params: CommentListQuery, enabled: boolean = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.list(params),
    queryFn: ({ pageParam }) => getCommentList({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: getNextPage,
    enabled: enabled && !!params.target_id,
  })
}

/**
 * 某条顶层评论下的子评论，按时间正序，每页 SUB_COMMENT_PAGE_SIZE 条。
 * 顶层评论列表里已经附带了第一页（请求时 sub_comment_size 用的同一个数），直接当作第一页，展开时不用再请求
 */
export function useSubComments(
  targetType: CommentTargetType,
  targetId: string,
  parent: CommentItem
) {
  const firstPage: CommentListData = { total: parent.sub_comment_total, list: parent.sub_comments }
  return useInfiniteQuery({
    queryKey: queryKeys.list({
      target_type: targetType,
      target_id: targetId,
      parent_id: parent.comment_id,
      page_size: SUB_COMMENT_PAGE_SIZE,
    }),
    queryFn: ({ pageParam }) =>
      getCommentList({
        target_type: targetType,
        target_id: targetId,
        parent_id: parent.comment_id,
        page: pageParam,
        page_size: SUB_COMMENT_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: getNextPage,
    // 附带的子评论是空的就不用它，正常请求
    initialData:
      parent.sub_comments.length > 0 ? { pages: [firstPage], pageParams: [1] } : undefined,
  })
}

/** 发表评论或回复，成功后失效该对象下的评论列表，顶层评论和父评论的 sub_comment_total 都会刷新 */
export function useAddComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AddCommentParams) => postAddComment(data),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.target(variables.target_type, variables.target_id),
      }),
  })
}

/**
 * 修改评论。后端会过滤敏感词，响应只有 comment_id，拿不到实际存下的内容，所以重新拉列表而不是直接改缓存；
 * 请求体里没有对象 ID，失效全部评论列表，只有正在显示的会立即重新请求
 */
export function useUpdateComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateCommentParams) => postUpdateComment(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.lists() }),
  })
}

/** 删除评论，同修改评论，失效全部评论列表；删除回复时父评论的 sub_comment_total 也跟着刷新 */
export function useDeleteComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: DeleteCommentParams) => postDeleteComment(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.lists() }),
  })
}

/** 在列表里找到 commentId（顶层或嵌在 sub_comments 里的子评论）并合并 patch，其余评论保持原引用 */
function patchComment(
  list: CommentItem[],
  commentId: string,
  patch: Partial<CommentItem>
): CommentItem[] {
  return list.map(comment => {
    if (comment.comment_id === commentId) return { ...comment, ...patch }
    if (comment.sub_comments.length === 0) return comment
    return { ...comment, sub_comments: patchComment(comment.sub_comments, commentId, patch) }
  })
}

/**
 * 给评论点赞或取消点赞，按 user_liked 决定调哪个接口。悲观更新：接口成功后才用返回的总数改缓存里的
 * thumbs_up 和 user_liked，不重新拉列表；同一条评论可能同时出现在顶层列表附带的子评论和子评论列表里，都改
 */
export function useThumbsUpComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (comment: CommentItem) =>
      toggleLike(LIKE_TARGET_COMMENT, comment.comment_id, !comment.user_liked),
    onSuccess: ({ liked, count }, comment) => {
      queryClient.setQueriesData<InfiniteData<CommentListData>>(
        { queryKey: queryKeys.lists() },
        old =>
          old
            ? {
                ...old,
                pages: old.pages.map(page => ({
                  ...page,
                  list: patchComment(page.list, comment.comment_id, {
                    user_liked: liked,
                    thumbs_up: count,
                  }),
                })),
              }
            : old
      )
    },
  })
}
