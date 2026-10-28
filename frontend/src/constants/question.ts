import type { Difficulty, QuestionSortBy, SortOrder } from '@/types/question'

/** 难度的文字和颜色，题目列表的筛选按钮、列表项和详情页共用；dotClassName 是 6px 方形色块的底色。颜色是 index.css 里的 --easy / --medium / --hard，跟随亮暗主题 */
export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; className: string; dotClassName: string }[] = [
  { value: 1, label: '简单', className: 'text-easy', dotClassName: 'bg-easy' },
  { value: 2, label: '中等', className: 'text-medium', dotClassName: 'bg-medium' },
  { value: 3, label: '困难', className: 'text-hard', dotClassName: 'bg-hard' },
]

/** 题目列表的排序下拉，value 写进 URL 的 sort 参数；default 不传 sort_by，走后端默认的 order 升序 */
export const SORT_OPTIONS: { value: string; label: string; sortBy?: QuestionSortBy; sortOrder?: SortOrder }[] = [
  { value: 'default', label: '默认排序' },
  { value: 'latest', label: '最新', sortBy: 'create_time', sortOrder: 'desc' },
  { value: 'views', label: '最多浏览', sortBy: 'view_count', sortOrder: 'desc' },
  { value: 'likes', label: '最多点赞', sortBy: 'thumbs_up_count', sortOrder: 'desc' },
]

/** 游客看到的 content 会被后端截断到前 150 个字符 */
export const GUEST_CONTENT_LIMIT = 150
