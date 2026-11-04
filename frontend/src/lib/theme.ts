import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

/** 和 index.html 里首屏前套主题的脚本用同一个 key */
const STORAGE_KEY = 'offer-hub-theme'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

/** 用户手动选过的主题；没选过是 null，跟随系统 */
function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

let stored = readStored()

function getTheme(): Theme {
  return stored ?? (darkQuery.matches ? 'dark' : 'light')
}

function apply() {
  document.documentElement.classList.toggle('dark', getTheme() === 'dark')
  listeners.forEach(listener => listener())
}

// 没手动选过时，系统切换深浅色跟着切
darkQuery.addEventListener('change', () => {
  if (!stored) apply()
})

export function setTheme(theme: Theme) {
  stored = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // 隐私模式等写不进去时只在本次打开期间生效
  }
  apply()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 当前生效的主题；插画按它选亮色或暗色版本 */
export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme)
}
