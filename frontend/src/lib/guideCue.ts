import { useSyncExternalStore } from 'react'
import { MOTIONS } from '@/constants/art'

/** 提示条只用两个一次性动作：挥手（登录成功）和庆祝（标记已掌握、刷题里程碑） */
export type CueMotion = 'wave' | 'celebrate'

export interface GuideCue {
  /** 每条提示一个新 id，连续两条同样的提示也会重新挂载、重播动作 */
  id: number
  motion: CueMotion
  text: string
}

interface CueState {
  cue: GuideCue | null
  /** 提示条的动作还在播：这段时间里页面上别的澜汐停在封面，同一时刻只有一个在动 */
  playing: boolean
}

/** 动作播完后再留这么久给人读字 */
const READ_MS = 1600
/** 最短停留时间 */
const MIN_SHOW_MS = 3000
/** 序列图下载解码要一点时间，「正在播」多算一点 */
const DECODE_MS = 300

let state: CueState = { cue: null, playing: false }
let nextId = 1
let hideTimer: number | undefined
let playTimer: number | undefined
const listeners = new Set<() => void>()

function setState(next: CueState) {
  state = next
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * 弹出澜汐提示条（components/guide.tsx 的 GuideCue，挂在全站布局里）。全站只有一个位置，新的一条直接顶掉旧的。
 * 只在真实的操作成功后调用（登录成功、标记保存成功、确实刷满了题数），不要拿它代替保存结果的判断
 */
export function showGuideCue(motion: CueMotion, text: string) {
  window.clearTimeout(hideTimer)
  window.clearTimeout(playTimer)
  const duration = MOTIONS[motion].duration
  setState({ cue: { id: nextId++, motion, text }, playing: true })
  playTimer = window.setTimeout(() => setState({ ...state, playing: false }), duration + DECODE_MS)
  hideTimer = window.setTimeout(
    () => setState({ cue: null, playing: false }),
    Math.max(MIN_SHOW_MS, duration + READ_MS)
  )
}

export function useGuideCue() {
  return useSyncExternalStore(subscribe, () => state.cue)
}

/** 提示条的动作正在播放；CharacterSprite 据此让路 */
export function useGuideCuePlaying() {
  return useSyncExternalStore(subscribe, () => state.playing)
}
