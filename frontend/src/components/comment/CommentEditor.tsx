import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { COMMENT_MAX_LENGTH } from '@/constants/comment'
import { cn } from '@/lib/utils'

/**
 * 评论输入框：发表评论、回复、编辑共用。提交的是去掉首尾空白的内容；
 * 提交成功后清空，失败时在下面显示后端的 msg，内容保留。Ctrl / ⌘ + Enter 提交，Esc 取消
 */
export function CommentEditor({
  label,
  placeholder,
  submitLabel,
  initialValue = '',
  autoFocus = false,
  onSubmit,
  onCancel,
  className,
}: {
  /** 给读屏用的输入框名称 */
  label: string
  placeholder?: string
  submitLabel: string
  /** 编辑时传原内容；内容没改时提交按钮不可点 */
  initialValue?: string
  autoFocus?: boolean
  /** 抛出错误表示提交失败 */
  onSubmit: (content: string) => Promise<unknown>
  /** 不传就不显示取消按钮 */
  onCancel?: () => void
  className?: string
}) {
  const [value, setValue] = useState(initialValue)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const countId = useId()

  const content = value.trim()
  const length = [...content].length
  const tooLong = length > COMMENT_MAX_LENGTH
  const canSubmit = content !== '' && !tooLong && !submitting && content !== initialValue.trim()

  // 打开回复框、进入编辑时聚焦，光标放到末尾，接着原内容往下写
  useEffect(() => {
    const el = textareaRef.current
    if (!autoFocus || !el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [autoFocus])

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(content)
      setValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className={cn('space-y-2', className)}
      onSubmit={e => {
        e.preventDefault()
        void submit()
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            void submit()
          } else if (e.key === 'Escape' && onCancel) {
            e.preventDefault()
            onCancel()
          }
        }}
        aria-label={label}
        aria-describedby={countId}
        aria-invalid={tooLong || undefined}
        placeholder={placeholder}
        rows={3}
        className="block min-h-[88px] w-full resize-y border border-input bg-transparent px-3 py-2 text-base transition-colors placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:outline-none aria-[invalid=true]:border-foreground md:text-body"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          id={countId}
          className={cn(
            'text-meta text-muted-foreground',
            tooLong && 'font-medium text-foreground'
          )}
        >
          {length} / {COMMENT_MAX_LENGTH}
          {tooLong && '，超出字数'}
          <span className="hidden sm:inline"> · Ctrl + Enter 发送</span>
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!canSubmit}>
            {submitting ? `${submitLabel}中…` : submitLabel}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-meta text-foreground">
          {error}
        </p>
      )}
    </form>
  )
}
