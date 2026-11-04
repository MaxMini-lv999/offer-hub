import type { ReactNode } from 'react'
import { CharacterSprite } from '@/components/art'
import { GUIDE, type MotionName } from '@/constants/art'
import { useGuideCue } from '@/lib/guideCue'
import { cn } from '@/lib/utils'

/**
 * 澜汐提示条：真实操作成功后（登录、标记已掌握、刷满题数，见 lib/guideCue.ts）在角落冒出来，
 * 96px Q 版播一次动作、说一句话，约 3 秒后自己消失。全站只有这一个位置，新的一条顶掉旧的。
 * 整条不接收点击，压在内容上也不挡操作。桌面端在右下角；手机端底部居中、左右各留 16px。
 * 沉浸式刷题页让开操作栏：手机端抬到底部操作栏（56px）上面，桌面端改到左下角（操作栏竖排在右边）。
 * status 区域常驻，读屏能念出每一条
 */
export function GuideCue({ immersive }: { immersive: boolean }) {
  const cue = useGuideCue()

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-none fixed inset-x-4 z-[60] flex justify-center md:inset-x-auto',
        immersive ? 'bottom-[72px] md:bottom-8 md:left-4' : 'bottom-4 md:right-4'
      )}
    >
      {cue && (
        <div
          key={cue.id}
          className="ohm-cue-enter flex w-full items-center gap-3 border border-foreground bg-background pr-4 md:w-auto md:max-w-sm"
        >
          <GuideFace>
            <CharacterSprite name={cue.motion} size={96} cue />
          </GuideFace>
          <GuideLine className="py-2">{cue.text}</GuideLine>
        </div>
      )}
    </div>
  )
}

/**
 * 澜汐的一句话引导：64px 静态 Q 版（只显示封面，不播动作）+ 名字 + 一句话 + 可选的一个操作。
 * 用在页面常态下的固定位置（列表底部、热门榜单下面、题库目录侧栏），一屏最多一处。
 * 手机端操作按钮排在文字下面，桌面端靠右
 */
export function GuideNote({
  pose,
  action,
  className,
  children,
}: {
  pose: MotionName
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex items-stretch gap-3 border pr-4', className)}>
      <GuideFace>
        <CharacterSprite name={pose} size={64} still />
      </GuideFace>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-2 md:flex-row md:items-center md:gap-4">
        <GuideLine>{children}</GuideLine>
        {action && <div className="shrink-0 md:ml-auto">{action}</div>}
      </div>
    </div>
  )
}

/** Q 版垫一块纸白（和登录弹窗的头像一样），暗色主题下深蓝头发才看得清；右边一条细线和文字隔开 */
function GuideFace({ children }: { children: ReactNode }) {
  return <span className="flex shrink-0 items-end border-r bg-dialogue-foreground">{children}</span>
}

/** 名字一行（只用中文名）+ 台词一行；Q 版是装饰，意思都在文字里 */
function GuideLine({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-meta text-muted-foreground">{GUIDE.name}</p>
      <p className="text-body">{children}</p>
    </div>
  )
}
