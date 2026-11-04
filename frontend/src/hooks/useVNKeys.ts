import { useEffect, useRef } from 'react'

export interface VNKeyHandlers {
  /** 空格或回车：显示整句 / 下一句 */
  onAdvance?: () => void
  /** 数字键 1–9，参数从 0 开始 */
  onChoose?: (index: number) => void
  /** 按住 Ctrl 快进，松开停 */
  onFastForward?: (active: boolean) => void
  /** L：回看日志 */
  onBacklog?: () => void
  /** Esc：退出 VN 模式 */
  onExit?: () => void
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

/**
 * VN 的键盘操作，监听在 window 上。enabled 为 false 时（比如回看日志打开着）整体停用，
 * 避免 Esc 关日志的同时把模式也退了
 */
export function useVNKeys(handlers: VNKeyHandlers, enabled = true) {
  // 处理函数每次渲染都是新的，放 ref 里，监听器不用反复解绑
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || isEditable(e.target)) return
      const h = handlersRef.current
      if (e.key === 'Control') {
        if (!e.repeat) h.onFastForward?.(true)
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return

      if ((e.key === ' ' || e.key === 'Enter') && !isInteractive(e.target) && h.onAdvance) {
        e.preventDefault()
        h.onAdvance()
      } else if (/^[1-9]$/.test(e.key) && h.onChoose) {
        h.onChoose(Number(e.key) - 1)
      } else if ((e.key === 'l' || e.key === 'L') && h.onBacklog) {
        h.onBacklog()
      } else if (e.key === 'Escape' && h.onExit) {
        h.onExit()
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Control') handlersRef.current.onFastForward?.(false)
    }
    // 按着 Ctrl 切走窗口时收不到 keyup，失焦时也停
    function onBlur() {
      handlersRef.current.onFastForward?.(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      handlersRef.current.onFastForward?.(false)
    }
  }, [enabled])
}
