import type { ReactNode } from 'react'
import { ArtImage } from '@/components/art'
import type { ArtAsset } from '@/constants/art'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

/**
 * VN 舞台，从下往上分层：场景背景（轻微模糊）→ 可选的压暗遮罩 → 一位角色立绘 → 前景内容（对话框、选项）。
 * 文字和按钮都在前景层用 HTML 渲染，不画在图里。手机端不放立绘，角色改成对话框里的头像。
 * 立绘入场从右边淡入，之后轻微呼吸；换姿势时新立绘淡入。立绘都是朝画面左边伸手，放在左边时水平翻转，让手势朝向内容。
 * 舞台高度由 className 决定（固定高度或最小高度都行），子元素用 flex-1 撑满后自己排版
 */
export function VNStage({
  scene,
  character,
  characterSide = 'right',
  dim = false,
  className,
  children,
}: {
  scene: ArtAsset
  character?: ArtAsset
  characterSide?: 'left' | 'right'
  /** 场景偏亮、前景文字压不住时加一层半透明墨色 */
  dim?: boolean
  className?: string
  children: ReactNode
}) {
  const isDesktop = useIsDesktop()

  return (
    <section
      className={cn(
        'relative isolate flex flex-col overflow-hidden border border-foreground bg-dialogue',
        className
      )}
    >
      {/* 放大 3% 再模糊，免得边缘透出底色 */}
      <ArtImage
        art={scene}
        priority
        className="absolute inset-0 -z-20 h-full w-full scale-[1.03] object-cover blur-[1.5px]"
      />
      {dim && <div aria-hidden className="absolute inset-0 -z-20 bg-dialogue/50" />}
      {character && isDesktop && (
        // 入场、呼吸、换姿势淡入都用 transform 或 opacity，分三层免得互相覆盖；翻转用独立的 scale 属性
        <div
          className={cn(
            'ohm-character-enter pointer-events-none absolute bottom-0 -z-10 h-[96%]',
            characterSide === 'right' ? 'right-[4%]' : 'left-[4%]'
          )}
        >
          <div className="ohm-breathe h-full">
            <ArtImage
              key={character.file}
              art={character}
              priority
              className={cn(
                'h-full w-auto max-w-none animate-in fade-in duration-panel',
                characterSide === 'left' && '[scale:-1_1]'
              )}
            />
          </div>
        </div>
      )}
      {children}
    </section>
  )
}
