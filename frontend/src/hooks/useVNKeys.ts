import { useEffect, useRef } from 'react'

export interface VNKeyHandlers {
  /** 空格或回车：显示整句 / 下一句 */
  onAdvance?: () => void
  /** 数字键 1–9，参数从 0 开始 */
  onChoose?: (index: number) => void
}

/** 焦点在输入框里时不抢按键 */
function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    !!target.closest('input, textarea, select, [contenteditable="true"]')
  )
}

/** 焦点在按钮、链接上时空格和回车交给它们自己处理 */
function isInteractive(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest('button, a, [role="button"]')
}

/** VN 的键盘操作，监听在 window 上 */
export function useVNKeys(handlers: VNKeyHandlers) {
  // 处理函数每次渲染都是新的，放 ref 里，监听器不用反复解绑
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || isEditable(e.target)) return
      const h = handlersRef.current
      if (e.ctrlKey || e.metaKey || e.altKey) return

      if ((e.key === ' ' || e.key === 'Enter') && !isInteractive(e.target) && h.onAdvance) {
        e.preventDefault()
        h.onAdvance()
      } else if (/^[1-9]$/.test(e.key) && h.onChoose) {
        h.onChoose(Number(e.key) - 1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
