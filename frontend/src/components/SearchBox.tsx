import { useEffect, useState } from 'react'
import { Search } from 'reicon-react'
import { Input } from '@/components/ui/input'

/** 搜索框：停止输入 300ms 后自动搜索，回车立即搜索。value 是已生效的关键词（URL 或父组件里的） */
export function SearchBox({
  value,
  onSearch,
  placeholder,
}: {
  value: string
  onSearch: (keyword: string) => void
  placeholder: string
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
    if (keyword === value) return
    const timer = setTimeout(() => onSearch(keyword), 300)
    return () => clearTimeout(timer)
  }, [text, value, onSearch])

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch(text.trim())
      }}
    >
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        className="pl-9"
      />
    </form>
  )
}
