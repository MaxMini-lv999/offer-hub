import type { Difficulty } from '@/types/question'

/** 难度的文字和颜色，题目列表的筛选按钮、列表项和详情页共用 */
export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; className: string }[] = [
  { value: 1, label: '简单', className: 'text-green-600' },
  { value: 2, label: '中等', className: 'text-amber-600' },
  { value: 3, label: '困难', className: 'text-red-600' },
]
