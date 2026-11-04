import { useRef } from 'react'
import IconClose from '~icons/solar/close-linear'
import { FEED_COLUMN } from '@/components/feed/FeedCard'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DIFFICULTY_OPTIONS, USER_TAG_OPTIONS } from '@/constants/question'
import type { FeedCategory, FeedMode } from '@/hooks/useFeed'
import { useLogin } from '@/hooks/useLogin'
import { useBankInfo, useQuestionTags } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'
import type { Difficulty, UserTag } from '@/types/question'

/** 下拉的「不过滤」选项；Select 的选项值不能是空字符串 */
const ALL = 'all'

const MODES: { value: FeedMode; label: string }[] = [
  { value: 'recommend', label: '推荐' },
  { value: 'category', label: '分类' },
]

/**
 * 刷题页顶部：「推荐 / 分类」切换，分类模式下面多一行标签、难度、掌握状态（登录后）下拉；
 * 从题库页进来时最前面还有一个可以去掉的题库条件。和卡片正文同一列宽
 */
export function FeedTopBar({
  mode,
  category,
  onModeChange,
  onCategoryChange,
  onFocusFeed,
}: {
  mode: FeedMode
  category: FeedCategory
  onModeChange: (mode: FeedMode) => void
  onCategoryChange: (patch: Partial<FeedCategory>) => void
  /** 选完分类后把焦点交给刷题区域，紧接着按 ↑ / ↓ 就能切题 */
  onFocusFeed: () => void
}) {
  return (
    <div className="flex-none border-b">
      <div className={FEED_COLUMN}>
        <div className="flex h-11 items-stretch gap-6">
          <div role="group" aria-label="刷题模式" className="flex items-stretch gap-6">
            {MODES.map(opt => {
              const selected = opt.value === mode
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => !selected && onModeChange(opt.value)}
                  className={cn(
                    'relative font-medium transition-colors duration-micro',
                    selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.label}
                  {/* 2px 下划线压在底边线上 */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-x-0 -bottom-px h-0.5',
                      selected ? 'bg-foreground' : 'bg-transparent'
                    )}
                  />
                </button>
              )
            })}
          </div>
          <p className="ml-auto hidden self-center text-meta text-muted-foreground md:block">
            ↑ ↓ 键、滚轮或按住拖动切题
          </p>
        </div>

        {mode === 'category' && (
          <CategoryFilters
            category={category}
            onChange={onCategoryChange}
            onFocusFeed={onFocusFeed}
          />
        )}
      </div>
    </div>
  )
}

/**
 * 分类条件的下拉框。焦点在下拉框上时 ↑ / ↓ 是打开下拉框，所以选了新的值以后不把焦点还给下拉框，
 * 而是交给刷题区域；按 Esc 或点外面关掉（没改条件）时照常回到下拉框
 */
function CategoryFilters({
  category,
  onChange: onChangeProp,
  onFocusFeed,
}: {
  category: FeedCategory
  onChange: (patch: Partial<FeedCategory>) => void
  onFocusFeed: () => void
}) {
  const { isLoggedIn } = useLogin()
  const changed = useRef(false)
  const onChange = (patch: Partial<FeedCategory>) => {
    changed.current = true
    onChangeProp(patch)
  }
  const handleCloseAutoFocus = (e: Event) => {
    if (!changed.current) return
    changed.current = false
    e.preventDefault()
    onFocusFeed()
  }
  const tags = useQuestionTags(category.bankId)
  const { data: bankInfo } = useBankInfo(category.bankId ?? '')
  const tagOptions = tags.data?.list ?? []
  // URL 里的标签不在列表里（比如题目下线了）时也要能显示出来
  const showStaleTag = !!category.tag && !tagOptions.some(t => t.tag === category.tag)

  const triggerClass = 'h-8 w-auto max-w-[9.5rem] gap-1 px-2 text-meta'

  return (
    <div role="group" aria-label="分类条件" className="flex flex-wrap items-center gap-2 pb-3">
      {category.bankId && (
        <button
          type="button"
          onClick={() => onChangeProp({ bankId: undefined })}
          aria-label={`去掉题库条件：${bankInfo?.bank.bank_name ?? category.bankId}`}
          className="inline-flex h-8 max-w-[10rem] items-center gap-1 border border-foreground bg-foreground px-2 text-meta text-background transition-opacity hover:opacity-80"
        >
          <span className="truncate">{bankInfo?.bank.bank_name ?? '题库'}</span>
          <IconClose className="size-3 shrink-0" />
        </button>
      )}

      <Select
        value={category.tag ?? ALL}
        onValueChange={v => onChange({ tag: v === ALL ? undefined : v })}
      >
        <SelectTrigger aria-label="标签" className={triggerClass}>
          {/* 选项里带着题目数，按钮上只显示标签名 */}
          <SelectValue>{category.tag ?? '全部标签'}</SelectValue>
        </SelectTrigger>
        <SelectContent onCloseAutoFocus={handleCloseAutoFocus}>
          <SelectItem value={ALL}>全部标签</SelectItem>
          {showStaleTag && <SelectItem value={category.tag!}>{category.tag}</SelectItem>}
          {tagOptions.map(t => (
            <SelectItem key={t.tag} value={t.tag}>
              {t.tag}
              <span className="ml-2 text-muted-foreground tabular-nums">{t.count}</span>
            </SelectItem>
          ))}
          {tags.isPending && (
            <p className="px-2 py-1.5 text-meta text-muted-foreground">标签加载中…</p>
          )}
          {tags.isError && (
            <p className="px-2 py-1.5 text-meta text-muted-foreground">标签加载失败</p>
          )}
        </SelectContent>
      </Select>

      <Select
        value={category.difficulty ? String(category.difficulty) : ALL}
        onValueChange={v =>
          onChange({ difficulty: v === ALL ? undefined : (Number(v) as Difficulty) })
        }
      >
        <SelectTrigger aria-label="难度" className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent onCloseAutoFocus={handleCloseAutoFocus}>
          <SelectItem value={ALL}>全部难度</SelectItem>
          {DIFFICULTY_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={String(opt.value)}>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0', opt.dotClassName)} />
                {opt.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoggedIn && (
        <Select
          value={category.userTag ? String(category.userTag) : ALL}
          onValueChange={v =>
            onChange({
              userTag: v === ALL ? undefined : (Number(v) as Exclude<UserTag, 0>),
            })
          }
        >
          <SelectTrigger aria-label="掌握状态" className={triggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent onCloseAutoFocus={handleCloseAutoFocus}>
            <SelectItem value={ALL}>全部状态</SelectItem>
            {USER_TAG_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0', opt.dotClassName)} />
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
