import { useEffect, useState } from 'react'
import IconMagnifier from '~icons/solar/magnifier-linear'
import { Input } from '@/components/ui/input'
import { KEYWORD_MAX_LENGTH } from '@/constants/question'

/**
 * 题目搜索框：停止输入 300ms 后自动搜索，回车立即搜索。value 是已生效的关键词（URL 或父组件里的）。
 * auto 为 false 时只在回车时搜索，用于搜索会跳页的地方（首页），免得输入到一半就被跳走
 */
export function SearchBox({
  value,
  onSearch,
  placeholder,
  auto = true,
}: {
  value: string
  onSearch: (keyword: string) => void
  placeholder: string
  auto?: boolean
}) {
  const [text, setText] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)

  // 关键词被外部改了（浏览器前进后退、清除筛选）时同步回输入框；
  // 只差首尾空格时不覆盖，否则正在输入的空格会被吞掉
  if (value !== syncedValue) {
    setSyncedValue(value)
    if (value !== text.trim()) setText(value)
  }

  useEffect(() => {
    const keyword = text.trim()
    if (!auto || keyword === value) return
    const timer = setTimeout(() => onSearch(keyword), 300)
    return () => clearTimeout(timer)
  }, [text, value, onSearch, auto])

  return (
    <form
      role="search"
      className="relative"
      onSubmit={e => {
        e.preventDefault()
        onSearch(text.trim())
      }}
    >
      <IconMagnifier className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={KEYWORD_MAX_LENGTH}
        enterKeyHint="search"
        className="pl-9"
      />
    </form>
  )
}
