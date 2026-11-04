import { cn } from '@/lib/utils'

/** 前三名的色块：金、银、铜 */
const MEDALS = ['bg-medal-gold', 'bg-medal-silver', 'bg-medal-bronze']

/**
 * 热门榜的排名序号：前三名是金银铜色块 + 墨色序号，之后是灰色序号。
 * 方块边长 1.5em，跟着所在行的字号走，不会把行撑高（正文行高 1.7、meta 行高 1.5）
 */
export function RankBadge({ rank, className }: { rank: number; className?: string }) {
  const medal = MEDALS[rank - 1]
  return (
    <span
      className={cn(
        'inline-flex size-[1.5em] shrink-0 items-center justify-center tabular-nums',
        medal ? cn(medal, 'font-semibold text-medal-foreground') : 'text-muted-foreground',
        className,
      )}
    >
      {rank}
    </span>
  )
}
