import type { ReactNode, Ref } from 'react'
import { cn } from '@/lib/utils'

/** 姓名牌：樱红底白字，压在对话框上沿；名字是真实文字 */
export function NameTag({ name, role }: { name: string; role?: string }) {
  return (
    <div className="inline-flex items-baseline gap-2 bg-brand px-3 py-1 text-brand-foreground">
      <span className="font-title text-heading leading-none">{name}</span>
      {role && <span className="text-meta">{role}</span>}
    </div>
  )
}

/**
 * VN 对话框：88% 不透明墨色 + 12px 背景模糊，台词用宋体，最高 35dvh，超出滚动。
 * 点对话框或右下角的推进按钮：还在逐字显示就先显示整句，显示完了推进下一句（拖选文字时不推进）。
 * 不传 onAdvance 表示这一句要等玩家做选择，不显示推进提示
 */
export function DialogueBox({
  speaker,
  avatar,
  contentRef,
  done,
  onAdvance,
  children,
  className,
}: {
  speaker: { name: string; role?: string }
  /** 头像（澜汐的 Q 版动作），放在台词左边 */
  avatar?: ReactNode
  /** 交给 useTypewriter 的容器 */
  contentRef?: Ref<HTMLDivElement>
  /** 整句已经显示完 */
  done: boolean
  onAdvance?: () => void
  children: ReactNode
  className?: string
}) {
  function handleClick() {
    if (!onAdvance || window.getSelection()?.toString()) return
    onAdvance()
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'relative mt-5 shrink-0 border border-dialogue-foreground/30 bg-dialogue/[0.88] text-dialogue-foreground backdrop-blur-md',
        onAdvance && 'cursor-pointer',
        className,
      )}
    >
      <div className="absolute left-3 top-0 -translate-y-1/2 md:left-6">
        <NameTag {...speaker} />
      </div>
      <div className="flex gap-3 px-4 pb-4 pt-7 md:gap-5 md:px-6 md:pb-6 md:pt-8">
        {/* 头像垫一块纸白，深蓝头发在墨色对话框上才看得清 */}
        {avatar && <div className="flex shrink-0 self-start bg-dialogue-foreground">{avatar}</div>}
        <div
          ref={contentRef}
          aria-live="polite"
          aria-busy={!done}
          className={cn(
            'max-h-[calc(35dvh-4rem)] min-h-[3.3em] min-w-0 flex-1 overflow-y-auto pr-6 font-title text-body leading-[1.65] md:text-heading md:leading-[1.65]',
            // 台词里可能有 Markdown：段落间距、列表、行内代码；台词本身已经是 600 字重，加粗改用下划线区分
            '[&_code]:bg-dialogue-foreground/15 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p+*]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1',
            '[&_strong]:underline [&_strong]:decoration-dialogue-foreground/50 [&_strong]:underline-offset-4',
            // 解析里的小标题像章节说明，用小字
            '[&_:is(h1,h2,h3,h4)]:font-sans [&_:is(h1,h2,h3,h4)]:text-meta [&_:is(h1,h2,h3,h4)]:tracking-widest [&_:is(h1,h2,h3,h4)]:opacity-80',
          )}
        >
          {children}
        </div>
      </div>
      {onAdvance && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAdvance()
          }}
          aria-label={done ? '继续' : '显示整句'}
          className="absolute bottom-1 right-1 flex h-11 w-11 items-center justify-center text-brand"
        >
          <span aria-hidden className={cn('text-meta', done ? 'ohm-continue' : 'opacity-40')}>
            ▶
          </span>
        </button>
      )}
    </div>
  )
}
