/** GET /api/v1/question/hot/list 请求参数 */
export interface HotQuestionListParams {
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
