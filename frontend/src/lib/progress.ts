import { useSyncExternalStore } from 'react'
import type { UserTag } from '@/types/question'

/** 掌握程度，取值和后端的 user_tag 一致：1 已掌握 / 2 晚点再刷（模糊）/ 3 未掌握 */
export type Mastery = Exclude<UserTag, 0>

export interface RecentQuestion {
  id: string
  title: string
  bankId?: string
}

interface Progress {
  mastery: Record<string, Mastery>
  /** 最近浏览，新的在前，最多 RECENT_LIMIT 条 */
  recent: RecentQuestion[]
}

/**
 * 本机学习记录：掌握程度和最近浏览，存在 localStorage。
 * 登录接口还没接入，先记在本机；接入后改成同步到账号的 user_tag
 */
const STORAGE_KEY = 'offer-hub-progress'
const RECENT_LIMIT = 5
const listeners = new Set<() => void>()

function read(): Progress {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<Progress>
    return { mastery: parsed.mastery ?? {}, recent: parsed.recent ?? [] }
  } catch {
    return { mastery: {}, recent: [] }
  }
}

// useSyncExternalStore 要求快照在没变化时是同一个对象，所以整份记录放模块变量里，改的时候整体替换
let progress = read()

function save(next: Progress) {
  progress = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 写不进去（隐私模式、空间满）时只在本次打开期间生效
  }
  listeners.forEach((listener) => listener())
}

// 另一个标签页改了记录时同步过来
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return
  progress = read()
  listeners.forEach((listener) => listener())
})

export function setMastery(questionId: string, mastery: Mastery) {
  save({ ...progress, mastery: { ...progress.mastery, [questionId]: mastery } })
}

/** 打开题目详情时记一笔；同一道题只留最新一条 */
export function recordVisit(question: RecentQuestion) {
  if (progress.recent[0]?.id === question.id && progress.recent[0]?.title === question.title) return
  const rest = progress.recent.filter((item) => item.id !== question.id)
  save({ ...progress, recent: [question, ...rest].slice(0, RECENT_LIMIT) })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useProgress() {
  return useSyncExternalStore(subscribe, () => progress)
}

/** 三种掌握程度各有多少题 */
export function countMastery(mastery: Record<string, Mastery>) {
  const counts: Record<Mastery, number> = { 1: 0, 2: 0, 3: 0 }
  Object.values(mastery).forEach((value) => {
    counts[value] += 1
  })
  return counts
}

export const MASTERY_LABELS: Record<Mastery, string> = { 1: '会了', 2: '有点模糊', 3: '还不会' }
