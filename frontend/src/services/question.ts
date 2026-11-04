import { get, post } from '@/lib/request'
import type {
  AllQuestionListParams,
  HotQuestionListData,
  HotQuestionListParams,
  JobQuestionGroup,
  QuestionDetail,
  QuestionDetailParams,
  QuestionListData,
  QuestionListParams,
  QuestionMetaListData,
  QuestionMetaListParams,
  QuestionTagListData,
  QuestionTagListParams,
  RandomQuestionListData,
  RandomQuestionListParams,
  TagQuestionParams,
  UserTag,
} from '@/types/question'

/** GET /api/v1/question/all/list 题库全量列表，按职位方向 → 系列 → 题库分组 */
export function getAllQuestionList(params?: AllQuestionListParams) {
  return get<JobQuestionGroup[]>('/api/v1/question/all/list', { params })
}

/** GET /api/v1/question/list 题目列表，支持分页、过滤和排序 */
export function getQuestionList(params?: QuestionListParams) {
  return get<QuestionListData>('/api/v1/question/list', { params })
}

/** GET /api/v1/question/meta/list 题目元数据列表，只有 ID 和标题 */
export function getQuestionMetaList(params?: QuestionMetaListParams) {
  return get<QuestionMetaListData>('/api/v1/question/meta/list', { params })
}

/** GET /api/v1/question/detail 题目详情 */
export function getQuestionDetail(params: QuestionDetailParams) {
  return get<QuestionDetail>('/api/v1/question/detail', { params })
}

/** GET /api/v1/question/hot/list 热门题目列表 */
export function getHotQuestionList(params?: HotQuestionListParams) {
  return get<HotQuestionListData>('/api/v1/question/hot/list', { params })
}

/** GET /api/v1/question/random/list 随机题目列表：按种子打乱全部题目后分页，只有 ID 和标题 */
export function getRandomQuestionList(params: RandomQuestionListParams) {
  return get<RandomQuestionListData>('/api/v1/question/random/list', { params })
}

/** GET /api/v1/question/tag/list 标签列表，带每个标签的题目数 */
export function getQuestionTagList(params?: QuestionTagListParams) {
  return get<QuestionTagListData>('/api/v1/question/tag/list', { params })
}

/** POST /api/v1/safe/tag_question 标记掌握状态，需要登录；tag 传 0 取消标记。成功时 data 为 null */
export function tagQuestion(questionId: string, tag: UserTag) {
  const data: TagQuestionParams = { question_id: questionId, tag }
  return post<null>('/api/v1/safe/tag_question', data)
}
