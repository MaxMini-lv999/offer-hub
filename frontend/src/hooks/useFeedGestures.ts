import { useEffect, useRef, type RefObject } from 'react'

/** 切题的纵向过渡时长 */
export const SLIDE_MS = 300
/** 松手时拖动距离超过视口高度的这个比例就切题 */
const SWITCH_DISTANCE = 0.2
/** 或者松手时的速度超过它（px/ms） */
const SWITCH_VELOCITY = 0.5
/** 速度按松手前这段时间内的位移算；停住超过这么久再松手，速度当作 0 */
const VELOCITY_WINDOW = 100
/** 手指移动超过它才判断方向：横向交给代码块滚动，纵向再看卡片有没有滚到头 */
const TOUCH_SLOP = 10
/** 鼠标按住这么久不动才能拖动；不到时间就移动，是在选文字 */
const LONG_PRESS_MS = 200
/** 鼠标长按期间移动超过它，就当作选文字，不再拖动 */
const MOUSE_SLOP = 6
/** 滚轮切题后锁定这么久 */
const WHEEL_LOCK_MS = 600
/** 两次滚轮事件间隔不到它，算同一次滚动（触控板的惯性滚动是一串密集的事件） */
const WHEEL_STREAM_GAP = 150
/** 同一次滚动累计到这么多像素才切题，触控板轻轻碰一下不算 */
const WHEEL_MIN_DELTA = 30
/** 已经是第一题 / 队尾还往外拖时，卡片只跟手移动这个比例 */
const EDGE_RESISTANCE = 0.3
/** 往外拖到头的距离超过它才给回弹提示，手抖不算 */
const EDGE_HINT_DISTANCE = 32

/** 1 下一题，-1 上一题 */
export type FeedDirection = 1 | -1

export interface FeedGestureHandlers {
  /** 这个方向还有没有题 */
  canGo: (dir: FeedDirection) => boolean
  /** 切题，卡片从当前拖到的位置过渡到新位置 */
  go: (dir: FeedDirection) => void
  /** 已经到头还往外翻。fromDrag 为 true 时卡片已经被拖开、松手会弹回去，不用再播回弹动画 */
  edge: (dir: FeedDirection, fromDrag: boolean) => void
  /** 卡片跟着手指移动 offset 像素（0 是原位）；animate 为 true 时带过渡动画回到这个位置 */
  drag: (offset: number, animate: boolean) => void
}

/** 鼠标从这些元素上按住拖动不切题：长按按钮、链接时不会切走 */
const INTERACTIVE = [
  'button',
  'a[href]',
  'input',
  'textarea',
  'select',
  'label',
  'summary',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[data-swipe-ignore]',
].join(',')

function isInteractive(target: EventTarget | null) {
  return target instanceof Element && !!target.closest(INTERACTIVE)
}

/**
 * 手指从这些元素上开始滑不切题：输入框（拖选区手柄）、带弹出菜单的按钮（按下就展开菜单）。
 * 普通按钮和链接上可以滑：手指移动超过一小段距离浏览器就不再当成点击，滑动不会误点按钮；
 * 反过来点按按钮没有位移，也不会切题。手机上「查看答案」占了卡片中间一大块，从它上面起手也要能滑
 */
const TOUCH_BLOCKING = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[aria-haspopup]',
  '[data-swipe-ignore]',
].join(',')

function blocksTouch(target: EventTarget | null) {
  return target instanceof Element && !!target.closest(TOUCH_BLOCKING)
}

/** 页面上有选中的文字：正在选字或拖选区手柄，不切题 */
function hasSelection() {
  const selection = window.getSelection()
  return !!selection && !selection.isCollapsed && selection.toString().length > 0
}

/** 当前那张卡片的滚动容器，题目超过一屏时先在它里面滚 */
function activeScroller(stage: HTMLElement) {
  return stage.querySelector<HTMLElement>('[data-feed-active] [data-feed-scroller]')
}

/** 滚动容器是否在顶部 / 底部；没有滚动容器（加载中、结束页）时两头都算到头 */
function scrollEdges(el: HTMLElement | null) {
  if (!el) return { atTop: true, atBottom: true }
  return {
    atTop: el.scrollTop <= 1,
    atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 1,
  }
}

/** 按在滚动条上：拖滚动条是在滚内容，不是切题 */
function isOnScrollbar(e: PointerEvent) {
  const el = e.target
  if (!(el instanceof HTMLElement)) return false
  const scrollable = el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth
  return scrollable && (e.offsetX >= el.clientWidth || e.offsetY >= el.clientHeight)
}

/** 滚轮的 delta 统一换成像素：Firefox 按行（deltaMode 1）报，翻页（2）按一屏算 */
function wheelPixels(e: WheelEvent) {
  if (e.deltaMode === 1) return e.deltaY * 16
  if (e.deltaMode === 2) return e.deltaY * window.innerHeight
  return e.deltaY
}

interface Sample {
  t: number
  y: number
}

/** 松手前 VELOCITY_WINDOW 毫秒内的平均速度，px/ms，往下为正 */
function releaseVelocity(samples: Sample[], now: number) {
  const last = samples[samples.length - 1]
  if (!last || now - last.t > VELOCITY_WINDOW) return 0
  let first = last
  for (let i = samples.length - 1; i >= 0 && last.t - samples[i].t <= VELOCITY_WINDOW; i--) {
    first = samples[i]
  }
  const dt = last.t - first.t
  return dt > 0 ? (last.y - first.y) / dt : 0
}

interface DragState {
  input: 'touch' | 'mouse'
  touchId?: number
  startX: number
  startY: number
  /** pending：还没动够距离；dragging：在拖卡片；scrolling：鼠标拖的方向卡片还能滚，拖动改成滚内容 */
  phase: 'pending' | 'dragging' | 'scrolling'
  /** 开始时卡片已经在顶部才能往下拖（上一题），在底部才能往上拖（下一题） */
  allowPrev: boolean
  allowNext: boolean
  scroller: HTMLElement | null
  scrollTop: number
  /** 手指实际拖了多少（到头时卡片移动得比这个少） */
  raw: number
  samples: Sample[]
}

/**
 * 沉浸式刷题的切题手势，监听在舞台元素上：
 * - 触屏上下滑；鼠标按住左键 LONG_PRESS_MS 后拖动（不到时间就移动是在选文字）；
 *   拖动距离超过视口高度的 20%，或松手速度超过 0.5px/ms 才切题，否则弹回原位
 * - 滚轮：卡片还能滚就先滚卡片，到顶或到底后的下一次滚动才切题；切题后锁定 600ms，
 *   同一串惯性滚动里也只切一次
 * - 题目超过一屏时，只有起手时卡片已经在顶部（往下拖）或底部（往上拖）才切题，否则交给浏览器滚动卡片
 * - 横向滑动（代码块、表格横向滚动）、有选中文字时不切题；鼠标从按钮、链接上按住拖动不切题，
 *   手指从输入框、带菜单的按钮上开始滑不切题（普通按钮上可以滑，见 TOUCH_BLOCKING）
 * 键盘 ↑ / ↓ 在页面里单独处理。enabled 为 false（评论抽屉、弹窗打开）时全部不响应
 */
export function useFeedGestures(
  stageRef: RefObject<HTMLElement>,
  handlers: FeedGestureHandlers,
  enabled: boolean
) {
  // 处理函数每次渲染都是新的，放 ref 里，监听器只绑一次
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const el: HTMLElement = stage

    let drag: DragState | null = null
    let press: { pointerId: number; x: number; y: number; timer: number } | null = null

    function begin(input: DragState['input'], x: number, y: number, t: number): DragState {
      const scroller = activeScroller(el)
      const { atTop, atBottom } = scrollEdges(scroller)
      return {
        input,
        startX: x,
        startY: y,
        phase: 'pending',
        allowPrev: atTop,
        allowNext: atBottom,
        scroller,
        scrollTop: scroller?.scrollTop ?? 0,
        raw: 0,
        samples: [{ t, y }],
      }
    }

    /** 中途取消（多指、触摸被系统打断）：弹回原位 */
    function cancel() {
      if (drag?.phase === 'dragging') handlersRef.current.drag(0, true)
      drag = null
    }

    /** 移动了一次。返回 true 表示这个手势归我们，调用方要阻止默认行为（页面滚动） */
    function move(x: number, y: number, t: number) {
      const d = drag
      if (!d) return false
      const dx = x - d.startX
      const dy = y - d.startY

      if (d.phase === 'pending') {
        const slop = d.input === 'touch' ? TOUCH_SLOP : MOUSE_SLOP
        if (Math.hypot(dx, dy) < slop) return false
        // 横向为主：代码块、表格在横向滚动；有选中文字：在拖选区手柄。都交给浏览器
        if (Math.abs(dx) > Math.abs(dy) || hasSelection()) {
          drag = null
          return false
        }
        const allowed = dy < 0 ? d.allowNext : d.allowPrev
        if (allowed) {
          d.phase = 'dragging'
        } else if (d.input === 'mouse' && d.scroller) {
          // 鼠标往卡片还能滚的方向拖：像抓着页面一样滚动内容
          d.phase = 'scrolling'
        } else {
          // 手指往卡片还能滚的方向滑：交给浏览器原生滚动，这次不切题
          drag = null
          return false
        }
      }

      if (d.phase === 'scrolling') {
        if (d.scroller) d.scroller.scrollTop = d.scrollTop - dy
        return true
      }

      // 只能往起手时允许的方向拖：在顶部往下拖到一半又往上推，卡片回到原位就停住，不会露出下一题
      let raw = dy
      if (raw > 0 && !d.allowPrev) raw = 0
      if (raw < 0 && !d.allowNext) raw = 0
      d.raw = raw
      const dir: FeedDirection = raw < 0 ? 1 : -1
      const offset = raw !== 0 && !handlersRef.current.canGo(dir) ? raw * EDGE_RESISTANCE : raw
      d.samples.push({ t, y })
      if (d.samples.length > 20) d.samples.shift()
      handlersRef.current.drag(offset, false)
      return true
    }

    /** 松手：按距离和速度决定切题还是弹回 */
    function finish(t: number) {
      const d = drag
      drag = null
      if (!d || d.phase !== 'dragging') return
      const h = handlersRef.current
      const v = releaseVelocity(d.samples, t)
      const threshold = window.innerHeight * SWITCH_DISTANCE

      let dir: FeedDirection | 0 = 0
      if (d.raw < 0) {
        const speed = -v // 往上的速度
        if (speed > SWITCH_VELOCITY || (-d.raw > threshold && speed > -SWITCH_VELOCITY)) dir = 1
      } else if (d.raw > 0) {
        const speed = v
        if (speed > SWITCH_VELOCITY || (d.raw > threshold && speed > -SWITCH_VELOCITY)) dir = -1
      }

      if (dir !== 0 && h.canGo(dir)) {
        h.go(dir)
        return
      }
      const outward: FeedDirection = d.raw < 0 ? 1 : -1
      if (d.raw !== 0 && !h.canGo(outward) && Math.abs(d.raw) > EDGE_HINT_DISTANCE) {
        h.edge(outward, true)
      }
      h.drag(0, true)
    }

    // ---------- 触屏 ----------

    function onTouchStart(e: TouchEvent) {
      if (!enabledRef.current) return
      if (e.touches.length !== 1) {
        cancel()
        return
      }
      if (blocksTouch(e.target) || hasSelection()) return
      const touch = e.touches[0]
      drag = begin('touch', touch.clientX, touch.clientY, e.timeStamp)
      drag.touchId = touch.identifier
    }

    function onTouchMove(e: TouchEvent) {
      if (drag?.input !== 'touch') return
      if (e.touches.length !== 1) {
        cancel()
        return
      }
      const touch = [...e.touches].find(item => item.identifier === drag?.touchId)
      if (!touch) return
      // 卡片在顶部或底部时浏览器本来也滚不动（滚动容器设了 overscroll-behavior: none），
      // 阻止默认行为只是不让它把这串事件当成滚动；已经开始滚动时事件不可取消，跳过也没关系
      if (move(touch.clientX, touch.clientY, e.timeStamp) && e.cancelable) e.preventDefault()
    }

    function onTouchEnd(e: TouchEvent) {
      if (drag?.input !== 'touch') return
      if ([...e.changedTouches].some(item => item.identifier === drag?.touchId)) finish(e.timeStamp)
    }

    function onTouchCancel() {
      if (drag?.input === 'touch') cancel()
    }

    // ---------- 鼠标：按住 200ms 再拖 ----------

    function endPress() {
      if (press) window.clearTimeout(press.timer)
      press = null
      delete el.dataset.grabbing
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !enabledRef.current) return
      if (isInteractive(e.target) || isOnScrollbar(e)) return
      endPress()
      const x = e.clientX
      const y = e.clientY
      const pointerId = e.pointerId
      press = {
        pointerId,
        x,
        y,
        timer: window.setTimeout(() => {
          // 双击选词后按住拖动、或者已经选上了文字：是在选字
          if (!press || hasSelection()) {
            endPress()
            return
          }
          drag = begin('mouse', x, y, performance.now())
          el.dataset.grabbing = 'true'
          try {
            el.setPointerCapture(pointerId)
          } catch {
            // 指针已经松开时会抛错，pointerup 会收尾
          }
        }, LONG_PRESS_MS),
      }
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerCancel)
    }

    function onPointerMove(e: PointerEvent) {
      if (!press || e.pointerId !== press.pointerId) return
      if (drag?.input !== 'mouse') {
        // 还没到 200ms 就动了：在选文字，这次不拖
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOUSE_SLOP) endPress()
        return
      }
      if (move(e.clientX, e.clientY, e.timeStamp)) {
        // 按下时浏览器已经放了光标，拖动时不让它顺手选上一片文字
        window.getSelection()?.removeAllRanges()
        e.preventDefault()
      } else if (!drag) {
        endPress()
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (!press || e.pointerId !== press.pointerId) return
      const moved = drag?.input === 'mouse' && drag.phase !== 'pending'
      if (drag?.input === 'mouse') finish(e.timeStamp)
      endPress()
      if (moved) {
        // 拖完松手会在原地触发一次 click，吞掉它；没触发的话下一轮事件循环就撤掉，不影响之后的点击
        const swallow = (ev: MouseEvent) => {
          ev.stopPropagation()
          ev.preventDefault()
        }
        window.addEventListener('click', swallow, { capture: true, once: true })
        window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }))
      }
    }

    function onPointerCancel(e: PointerEvent) {
      if (!press || e.pointerId !== press.pointerId) return
      if (drag?.input === 'mouse') cancel()
      endPress()
    }

    // 按住图片拖动时浏览器会开始原生拖放、发 pointercancel，长按拖动期间不让它开始
    function onDragStart(e: DragEvent) {
      if (press) e.preventDefault()
    }

    // ---------- 滚轮 ----------

    const wheel = { lastAt: -Infinity, scrolled: false, switched: false, total: 0, lockUntil: 0 }

    function onWheel(e: WheelEvent) {
      if (!enabledRef.current || e.ctrlKey || drag) return
      // 横向滚动交给代码块、表格
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      const delta = wheelPixels(e)
      if (delta === 0) return

      const now = e.timeStamp
      if (now - wheel.lastAt > WHEEL_STREAM_GAP) {
        // 停顿过后的新一次滚动
        wheel.scrolled = false
        wheel.switched = false
        wheel.total = 0
      }
      wheel.lastAt = now

      // 切题后的锁定期：滚轮全部吞掉，新卡片的内容也不滚。切题时主线程忙着渲染新卡片，
      // 惯性事件可能隔一阵才到、被当成新的一串，所以锁定期间开始的这一串也整串算惯性，直到停顿
      if (now < wheel.lockUntil) {
        e.preventDefault()
        wheel.switched = true
        return
      }

      const dir: FeedDirection = delta > 0 ? 1 : -1
      const scroller = activeScroller(el)
      const { atTop, atBottom } = scrollEdges(scroller)
      const canScroll = dir === 1 ? !atBottom : !atTop
      if (canScroll && !wheel.switched) {
        wheel.scrolled = true
        // 鼠标在卡片外面（手机布局的底部操作栏上）时浏览器不会滚卡片，替它滚
        if (scroller && !scroller.contains(e.target as Node)) {
          e.preventDefault()
          scroller.scrollTop += delta
        }
        return
      }

      e.preventDefault()
      // 这次滚动刚滚完卡片内容、或已经切过一题：剩下的是惯性，不再切
      if (wheel.scrolled || wheel.switched) return
      wheel.total += delta
      if (Math.abs(wheel.total) < WHEEL_MIN_DELTA) return
      wheel.switched = true
      wheel.lockUntil = now + WHEEL_LOCK_MS
      const h = handlersRef.current
      if (h.canGo(dir)) h.go(dir)
      else h.edge(dir, false)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    // 要在拖动时阻止页面滚动，不能是 passive
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchCancel)
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('dragstart', onDragStart)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      endPress()
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('dragstart', onDragStart)
      el.removeEventListener('wheel', onWheel)
    }
  }, [stageRef])
}

/** 焦点在输入框里时不抢方向键 */
function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
  )
}

/**
 * 键盘 ↑ / ↓ 切题，监听在 window 的捕获阶段。题目超过一屏时先滚动卡片（每次大半屏），滚到头再按才切题；
 * 按住不放时只滚动不连续切题。焦点在输入框、展开的菜单和下拉列表、弹窗里时不处理；
 * 焦点在下拉框按钮（combobox）上时 ↑ / ↓ 照常打开下拉框，选完由筛选栏把焦点移走。
 * 焦点在「标记」这类菜单按钮上时 ↑ / ↓ 用来切题（捕获阶段先拿到，菜单组件收不到），菜单用回车、空格或点击打开
 */
export function useFeedKeys(
  stageRef: RefObject<HTMLElement>,
  handlers: Pick<FeedGestureHandlers, 'canGo' | 'go' | 'edge'>,
  enabled: boolean,
  reducedMotion: boolean
) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const optionsRef = useRef({ enabled, reducedMotion })
  optionsRef.current = { enabled, reducedMotion }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const { enabled, reducedMotion } = optionsRef.current
      if (!enabled || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const target = e.target
      if (
        isEditable(target) ||
        (target instanceof Element &&
          target.closest('[role="menu"], [role="listbox"], [role="dialog"], [role="combobox"]'))
      ) {
        return
      }
      const stage = stageRef.current
      if (!stage) return

      e.preventDefault()
      e.stopPropagation()
      const dir: FeedDirection = e.key === 'ArrowDown' ? 1 : -1
      const scroller = activeScroller(stage)
      const { atTop, atBottom } = scrollEdges(scroller)
      if (scroller && (dir === 1 ? !atBottom : !atTop)) {
        scroller.scrollBy({
          top: dir * scroller.clientHeight * 0.6,
          behavior: reducedMotion ? 'auto' : 'smooth',
        })
        return
      }
      if (e.repeat) return
      const h = handlersRef.current
      if (h.canGo(dir)) h.go(dir)
      else h.edge(dir, false)
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [stageRef])
}
