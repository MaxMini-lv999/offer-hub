import { useCallback, useSyncExternalStore } from 'react'

/** 订阅一条媒体查询，窗口尺寸或系统设置变了会重新渲染 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/** 系统开了「减少动态效果」：关掉逐字显示和转场 */
export function usePrefersReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/** 桌面和平板（≥768px）；手机端 VN 不放立绘、选项改成底部抽屉 */
export function useIsDesktop() {
  return useMediaQuery('(min-width: 768px)')
}
