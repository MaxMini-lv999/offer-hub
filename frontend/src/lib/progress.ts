import { useSyncExternalStore } from 'react'

export interface RecentQuestion {
  id: string
  title: string
  bankId?: string
}

interface Progress {
  /** 最近浏览，新的在前，最多 RECENT_LIMIT 条 */
  recent: RecentQuestion[]
}

/** 本机学习记录：最近浏览，存在 localStorage */
const STORAGE_KEY = 'offer-hub-progress'
const RECENT_LIMIT = 5
const listeners = new Set<() => void>()

function read(): Progress {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<Progress>
    return { recent: parsed.recent ?? [] }
  } catch {
    return { recent: [] }
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
  listeners.forEach(listener => listener())
}

// 另一个标签页改了记录时同步过来
window.addEventListener('storage', e => {
  if (e.key !== STORAGE_KEY) return
  progress = read()
  listeners.forEach(listener => listener())
})

/** 打开题目详情时记一笔；同一道题只留最新一条 */
export function recordVisit(question: RecentQuestion) {
  if (progress.recent[0]?.id === question.id && progress.recent[0]?.title === question.title) return
  const rest = progress.recent.filter(item => item.id !== question.id)
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
