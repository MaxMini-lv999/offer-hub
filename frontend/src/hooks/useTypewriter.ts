import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'

/** index.css 里 ::highlight(typewriter-pending) 把这些范围的文字设成透明 */
const HIGHLIGHT_NAME = 'typewriter-pending'
const supported = typeof CSS !== 'undefined' && 'highlights' in CSS

/** 所有逐字显示的实例共用一个 Highlight，各自往里加减自己的范围 */
function pendingHighlight() {
  let highlight = CSS.highlights.get(HIGHLIGHT_NAME)
  if (!highlight) {
    highlight = new Highlight()
    CSS.highlights.set(HIGHLIGHT_NAME, highlight)
  }
  return highlight
}

/**
 * 逐字显示：整段内容（可以是渲染好的 Markdown）照常渲染，DOM 里的文字始终完整，
 * 只用 CSS Custom Highlight 把还没「打」出来的部分设成透明，所以不会和 React 的更新打架，
 * 对话框从第一个字起就是整句的高度，不会边打边长高。
 * key 变了从头再显示一遍；finish() 立即显示整段；charsPerSecond 为 0、系统开了「减少动态效果」、
 * 或浏览器不支持 Highlight API 时直接显示整段。容器同时是滚动容器：超出 max-height 时跟着光标往下滚
 */
export function useTypewriter<T extends HTMLElement>(key: unknown, charsPerSecond: number) {
  const ref = useRef<T>(null)
  const [done, setDone] = useState(true)
  const finishRef = useRef<() => void>(() => {})
  const reducedMotion = usePrefersReducedMotion()
  const instant = !supported || reducedMotion || charsPerSecond <= 0

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return

    const nodes: Text[] = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) nodes.push(walker.currentNode as Text)
    const total = nodes.reduce((sum, node) => sum + node.length, 0)

    if (instant || total === 0) {
      setDone(true)
      finishRef.current = () => {}
      return
    }

    const highlight = pendingHighlight()
    const pending = new Range()
    pending.selectNodeContents(root)
    highlight.add(pending)

    let shown = 0
    let frame = 0
    let last = performance.now()

    // 透明范围从第 shown 个字开始，一直到容器末尾
    const render = () => {
      let left = Math.floor(shown)
      for (const node of nodes) {
        if (left <= node.length) {
          pending.setStart(node, left)
          break
        }
        left -= node.length
      }
      // 光标跑到容器可视区域下面时往下滚
      const caret = pending.getClientRects()[0]
      const box = root.getBoundingClientRect()
      if (caret && caret.bottom > box.bottom) root.scrollTop += caret.bottom - box.bottom + 8
    }
    const cleanup = () => {
      cancelAnimationFrame(frame)
      highlight.delete(pending)
    }
    const finish = () => {
      cleanup()
      setDone(true)
    }
    const tick = (now: number) => {
      // rAF 给的是这一帧开始的时间，可能早于上面记下的 performance.now()，时间差不能为负
      shown += (Math.max(0, now - last) / 1000) * charsPerSecond
      last = Math.max(last, now)
      if (shown >= total) {
        finish()
        return
      }
      render()
      frame = requestAnimationFrame(tick)
    }

    finishRef.current = finish
    setDone(false)
    root.scrollTop = 0
    render()
    frame = requestAnimationFrame(tick)
    return cleanup
  }, [key, charsPerSecond, instant])

  const finish = useCallback(() => finishRef.current(), [])
  return { ref, done, finish }
}
