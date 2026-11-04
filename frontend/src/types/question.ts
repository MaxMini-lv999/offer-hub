/** 难度：1简单 / 2中等 / 3困难 */
export type Difficulty = 1 | 2 | 3

/** 题目状态：1正常 / 2隐藏 / 3删除 */
export type QuestionStatus = 1 | 2 | 3

/** 掌握状态：0未标记 / 1已掌握 / 2晚点再刷 / 3未掌握 */
export type UserTag = 0 | 1 | 2 | 3

/** 题目列表排序字段，order 是后端默认排序，文档未列出 */
export type QuestionSortBy =
  'order' | 'create_time' | 'view_count' | 'thumbs_up_count' | 'dislike_count'

export type SortOrder = 'asc' | 'desc'

/** GET /api/v1/question/all/list 请求参数 */
export interface AllQuestionListParams {
  job_name?: string
}

/** 题库 */
export interface QuestionBank {
  bank_id: string
  bank_name: string
  bank_logo: string
  desc: string
  /** 该题库下的题目数量 */
  count: number
  order: number
}

/** 题库系列，包含若干题库 */
export interface QuestionSeries {
  series_id: string
  series_name: string
  order: number
  bank_list: QuestionBank[]
}

/** 题库全量列表按职位方向分组，响应 data 为 JobQuestionGroup[] */
export interface JobQuestionGroup {
  job_name: string
  series_list: QuestionSeries[]
}

/** GET /api/v1/question/list 请求参数 */
export interface QuestionListParams {
  bank_id?: string
  /** 匹配标题和内容 */
  keyword?: string
  difficulty?: Difficulty
  tags?: string[]
  job_name?: string
  /** 仅登录用户有效，游客传入会被忽略 */
  user_tag?: Exclude<UserTag, 0>
  sort_by?: QuestionSortBy
  sort_order?: SortOrder
  /** 默认 1 */
  page?: number
  /** 默认 20，最大 100 */
  page_size?: number
}

/** 题目列表的过滤条件（含分页和排序），即 useQuestionList 的参数 */
export type QuestionFilters = QuestionListParams

/** 题目，列表和详情共用。游客访问时 content 截断至前 150 字，user_tag / user_liked 为零值 */
export interface Question {
  question_id: string
  bank_list: string[]
  title: string
  content: string
  difficulty: Difficulty
  tags: string[]
  status: QuestionStatus
  vip: boolean
  hot_degree: number
  view_count: number
  thumbs_up_count: number
  dislike_count: number
  order: number
  user_tag: UserTag
  user_liked: boolean
  /** 格式 2024-01-01 12:00:00 */
  create_time: string
  update_time: string
}

/** 题目详情，比列表多一个题目解析 */
export interface QuestionDetail extends Question {
  /** 题目解析（答案），游客为空字符串 */
  analysis_content: string
}

export interface QuestionListData {
  total: number
  list: Question[]
}

/** GET /api/v1/question/meta/list 请求参数，与题目列表相同 */
export type QuestionMetaListParams = QuestionListParams

/** 题目元数据，只有 ID 和标题，用于题目导航侧边栏 */
export interface QuestionMeta {
  question_id: string
  title: string
}

export interface QuestionMetaListData {
  total: number
  list: QuestionMeta[]
}

/** GET /api/v1/question/random/list 请求参数 */
export interface RandomQuestionListParams {
  /** 随机种子，同一个种子顺序固定；不传时后端生成，随响应返回 */
  seed?: number
  /** 默认 1 */
  page?: number
  /** 默认 20，最大 50 */
  page_size?: number
}

/** 按种子打乱后的一页题目，只有 ID 和标题 */
export interface RandomQuestionListData {
  /** 这次用的种子，翻下一页时带上 */
  seed: number
  total: number
  list: QuestionMeta[]
}

/** GET /api/v1/question/tag/list 请求参数 */
export interface QuestionTagListParams {
  /** 只统计这个题库的题，不传统计全部 */
  bank_id?: string
}

/** 标签和带这个标签的题目数 */
export interface QuestionTagCount {
  tag: string
  count: number
}

export interface QuestionTagListData {
  /** 按题目数从多到少排 */
  list: QuestionTagCount[]
}

/** GET /api/v1/question/detail 请求参数 */
export interface QuestionDetailParams {
  question_id: string
}

/** POST /api/v1/safe/tag_question 请求体，标记者取自 token */
export interface TagQuestionParams {
  question_id: string
  /** 传 0 取消标记 */
  tag: UserTag
}

/** GET /api/v1/question/hot/list 请求参数 */
export interface HotQuestionListParams {
  /** 默认 10，最大 50 */
  limit?: number
  job_name?: string
}

/** 热门题目 */
export interface HotQuestion {
  question_id: string
  bank_list: string[]
  title: string
  view_count: number
}

export interface HotQuestionListData {
  list: HotQuestion[]
}
