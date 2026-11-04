import { DIFFICULTY_OPTIONS } from '@/constants/question'
import { cn } from '@/lib/utils'
import type { Difficulty } from '@/types/question'

/** 难度：6px 方形色块 + 文字，颜色只用在这里 */
export function DifficultyLabel({ difficulty }: { difficulty: Difficulty }) {
  const level = DIFFICULTY_OPTIONS.find(opt => opt.value === difficulty)
  if (!level) return null

  return (
    <span className={cn('inline-flex shrink-0 items-center gap-2', level.className)}>
      <span aria-hidden className={cn('h-1.5 w-1.5', level.dotClassName)} />
      {level.label}
    </span>
  )
}
