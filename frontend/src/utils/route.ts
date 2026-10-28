import { createSearchParams } from 'react-router-dom'

/** 题库页地址 */
export function bankPath(bankId: string) {
  return `/bank/${encodeURIComponent(bankId)}`
}

/** 题目详情页地址；带上 bankId，详情页左侧题目栏才能停在用户来的那个题库（一道题可能属于多个题库） */
export function questionPath(questionId: string, bankId?: string) {
  const path = `/question/${encodeURIComponent(questionId)}`
  return bankId ? `${path}?${createSearchParams({ bankId })}` : path
}
