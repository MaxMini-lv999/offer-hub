import { get } from '@/lib/request'
import type { HotQuestionListData, HotQuestionListParams } from '@/types/question'

/** GET /api/v1/question/hot/list 热门题目列表 */
export function getHotQuestionList(params?: HotQuestionListParams) {
  return get<HotQuestionListData>('/api/v1/question/hot/list', { params })
}
