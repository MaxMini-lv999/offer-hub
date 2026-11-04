import { useRef, useState, type PointerEvent } from 'react'
import IconChevronDown from '~icons/solar/alt-arrow-down-linear'
import IconChecklist from '~icons/solar/checklist-minimalistic-linear'
import IconClock from '~icons/solar/clock-circle-linear'
import IconEye from '~icons/solar/eye-linear'
import { DifficultyLabel } from '@/components/DifficultyLabel'
import { LikeContent } from '@/components/LikeContent'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { USER_TAG_OPTIONS } from '@/constants/question'
import { useLikeEffect } from '@/hooks/useLikeEffect'
import { useLogin } from '@/hooks/useLogin'
import { useLikeQuestion, useTagQuestion } from '@/hooks/useQuestionQueries'
import { cn } from '@/lib/utils'
import type { Question, UserTag } from '@/types/question'

/** 鼠标移出按钮或菜单后多久收起，留时间把指针从按钮挪到菜单上 */
const HOVER_CLOSE_DELAY = 150

/**
 * 题目详情的页头：标题和掌握状态徽章；下面一行难度、标签、浏览量、时间，再下面一行点赞和标记掌握状态。
 * 操作单独一行而不是跟在元信息后面，标签多少不一样时按钮的位置也不变。
 * 点赞是乐观更新，点下去马上变，失败再改回去；标记是悲观更新，接口成功后才改缓存。
 * 游客点赞先打开登录弹窗，标记菜单只有登录后才显示。
 * 换题时由父组件用 key 重新挂载，上一题的操作报错不带过来
 */
export function DetailHeader({ question }: { question: Question }) {
  const { isLoggedIn, setShowLoginDialog } = useLogin()
  const like = useLikeQuestion()
  const [likeEffect, playLikeEffect] = useLikeEffect()
  const tag = useTagQuestion()
  // 退出登录后、详情重新拉回来之前，缓存里还是登录时的状态，先按游客显示
  const userTag = isLoggedIn ? question.user_tag : 0
  const liked = isLoggedIn && question.user_liked

  function handleLike() {
    if (!isLoggedIn) {
      setShowLoginDialog(true)
      return
    }
    // 不用 disabled：按钮变灰会打断动效，请求进行中的点击直接忽略
    if (like.isPending) return
    // 乐观更新，按钮马上变，动效跟着点击播；失败时 useLikeQuestion 把缓存改回去，下面显示报错
    playLikeEffect(!question.user_liked)
    like.mutate(question)
  }

  const actionError = like.isError
    ? `点赞失败：${like.error.message}`
    : tag.isError
      ? `标记失败：${tag.error.message}`
      : null

  return (
    <header className="border-b pb-4">
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="min-w-0 font-title text-title font-semibold">{question.title}</h1>
        {userTag !== 0 && <UserTagBadge tag={userTag} />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-muted-foreground">
        <DifficultyLabel difficulty={question.difficulty} />
        {question.tags.length > 0 && (
          <span className="flex flex-wrap gap-2">
            {question.tags.map(t => (
              <span key={t} className="border px-2">
                {t}
              </span>
            ))}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <IconEye className="size-3.5" />
          {question.view_count} 浏览
        </span>
        <span className="inline-flex items-center gap-1">
          <IconClock className="size-3.5" />
          {question.create_time}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleLike}
          aria-pressed={liked}
          aria-busy={like.isPending}
          aria-label={`给题目点赞，当前 ${question.thumbs_up_count} 个赞`}
          className={cn('group', liked && 'border-foreground')}
        >
          {/* h-8 按钮里图标离上边框 8px，±1 再往上留 4px，从边框外面冒出来 */}
          <LikeContent liked={liked} effect={likeEffect} floatGap={12}>
            {question.thumbs_up_count}
          </LikeContent>
        </Button>
        {isLoggedIn && (
          <TagMenu
            current={userTag}
            pending={tag.isPending}
            onChange={next => tag.mutate({ question_id: question.question_id, tag: next })}
          />
        )}
      </div>

      {actionError && (
        <p role="alert" className="mt-2 text-meta text-foreground">
          {actionError}
        </p>
      )}
    </header>
  )
}

/** 标题右侧的掌握状态徽章：已掌握绿 / 晚点再刷橙 / 未掌握红，未标记不显示 */
function UserTagBadge({ tag }: { tag: Exclude<UserTag, 0> }) {
  const option = USER_TAG_OPTIONS.find(opt => opt.value === tag)
  if (!option) return null
  return (
    <span className={cn('shrink-0 border px-2 text-meta', option.className)}>{option.label}</span>
  )
}

/**
 * 标记掌握状态的下拉菜单。鼠标悬停展开、移开收起（按钮和菜单之间留 HOVER_CLOSE_DELAY 的过渡时间）；
 * 触屏点按、键盘 Enter / 空格 / ↓ 照常打开。菜单打开时会把焦点移进去，悬停打开的在收起时把焦点还给原来的元素
 * （比如正在写的评论框），而不是交给按钮，鼠标路过不会抢走焦点
 */
function TagMenu({
  current,
  pending,
  onChange,
}: {
  current: UserTag
  pending: boolean
  onChange: (tag: UserTag) => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const openedByHover = useRef(false)
  // 悬停打开前的焦点，收起时还回去
  const focusBeforeHover = useRef<Element | null>(null)
  const closeTimer = useRef<number>()
  const currentLabel = USER_TAG_OPTIONS.find(opt => opt.value === current)?.label ?? '未标记'

  function cancelClose() {
    window.clearTimeout(closeTimer.current)
  }

  function handlePointerEnter(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return
    cancelClose()
    if (!open) {
      openedByHover.current = true
      focusBeforeHover.current = document.activeElement
      setOpen(true)
    }
  }

  function handlePointerLeave(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || !openedByHover.current) return
    cancelClose()
    closeTimer.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY)
  }

  // 点按、键盘打开，或 Esc、点外面、选了一项收起
  function handleOpenChange(next: boolean) {
    cancelClose()
    if (next) openedByHover.current = false
    setOpen(next)
  }

  function select(value: string) {
    const next = Number(value) as UserTag
    if (next !== current) onChange(next)
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          size="sm"
          disabled={pending}
          aria-label={`标记掌握状态，当前：${currentLabel}`}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          // 悬停已经展开了，再点一下不要收起：阻止默认行为后菜单组件就不切换开关（还要配合下面的 onPointerDownOutside）
          onPointerDown={e => {
            if (e.pointerType === 'mouse' && open) e.preventDefault()
          }}
          className="data-[state=open]:border-foreground"
        >
          <IconChecklist />
          {pending ? '保存中…' : '标记'}
          <IconChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-40"
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        // 按钮在菜单外面，非模态菜单默认会把按下按钮当成「点外面」收起；按钮的开关交给上面的 onPointerDown
        onPointerDownOutside={e => {
          if (triggerRef.current?.contains(e.detail.originalEvent.target as Node))
            e.preventDefault()
        }}
        onCloseAutoFocus={e => {
          if (!openedByHover.current) return
          e.preventDefault()
          if (focusBeforeHover.current instanceof HTMLElement)
            focusBeforeHover.current.focus({ preventScroll: true })
        }}
      >
        <DropdownMenuRadioGroup value={String(current)} onValueChange={select}>
          {USER_TAG_OPTIONS.map(opt => (
            <DropdownMenuRadioItem key={opt.value} value={String(opt.value)} className="gap-2">
              <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0', opt.dotClassName)} />
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {current !== 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(0)} className="pl-8">
              取消标记
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
