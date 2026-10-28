import { useHotQuestions } from '@/hooks/useQuestionQueries'

/** 和 HotContent 的全站热门共用一份查询（参数相同，query key 一样） */
const HOT_LIMIT = 10

/** 本地日期换算成天数，北京时间零点换题，不是 UTC 零点 */
function localDayNumber(date: Date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
}

/** 今日一题：全站热门前 10 题按日期轮换，同一天内所有人看到的是同一题 */
export function useTodayQuestion() {
  const query = useHotQuestions({ limit: HOT_LIMIT })
  const list = query.data?.list ?? []
  const today = list.length > 0 ? list[localDayNumber(new Date()) % list.length] : undefined
  return { ...query, today }
}
