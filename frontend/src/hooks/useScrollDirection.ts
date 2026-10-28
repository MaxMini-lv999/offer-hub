import { useEffect, useRef } from 'react'

export type ScrollDirection = 'up' | 'down'

/**
 * 监听整页的滚动方向，每累计滚动超过 threshold 像素回调一次，触控板的细小抖动不会来回切换；
 * 回到页面顶部时算作向上。enabled 为 false 时不监听
 */
export function useScrollDirection(onChange: (direction: ScrollDirection) => void, enabled = true, threshold = 8) {
  // 回调放 ref 里，父组件每次渲染传新函数也不用重新订阅
  const callbackRef = useRef(onChange)
  useEffect(() => {
    callbackRef.current = onChange
  })

  useEffect(() => {
    if (!enabled) return
    let lastY = window.scrollY
    let frame = 0

    function update() {
      frame = 0
      const y = window.scrollY
      if (y <= 0) {
        lastY = 0
        callbackRef.current('up')
        return
      }
      if (Math.abs(y - lastY) < threshold) return
      callbackRef.current(y > lastY ? 'down' : 'up')
      lastY = y
    }

    // 一帧只算一次
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [enabled, threshold])
}
