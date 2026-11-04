import { cn } from '@/lib/utils'

export interface Choice {
  label: string
  onSelect: () => void
}

/**
 * VN 选项：真实按钮，前面标出数字键；悬停和键盘聚焦时用天青高亮。
 * drawer 为 true 时（手机端）从底部滑入，触控区不小于 44px
 */
export function ChoiceList({
  choices,
  drawer = false,
  className,
}: {
  choices: Choice[]
  drawer?: boolean
  className?: string
}) {
  return (
    <ol
      aria-label="选项"
      className={cn(
        'flex flex-col gap-2',
        drawer &&
          'border-t border-dialogue-foreground/30 bg-dialogue/[0.88] p-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-panel',
        !drawer && 'animate-in fade-in slide-in-from-bottom-2 duration-panel',
        className
      )}
    >
      {choices.map((choice, index) => (
        <li key={choice.label}>
          <button
            type="button"
            onClick={choice.onSelect}
            className="flex min-h-11 w-full items-center gap-3 border border-dialogue-foreground/40 bg-dialogue/[0.88] px-4 py-2 text-left text-dialogue-foreground backdrop-blur-md transition-colors duration-micro ease-standard hover:border-system hover:bg-system hover:text-background focus-visible:border-system focus-visible:bg-system focus-visible:text-background"
          >
            {index < 9 && (
              <kbd aria-hidden className="w-4 shrink-0 font-mono text-meta">
                {index + 1}
              </kbd>
            )}
            <span className="font-title">{choice.label}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}
