import type { ComponentType, SVGProps } from 'react'
import IconMysql from '~icons/devicon-plain/mysql'
import IconRedis from '~icons/devicon-plain/redis'
import IconGo from '~icons/simple-icons/go'
import IconMongodb from '~icons/simple-icons/mongodb'
import IconReact from '~icons/simple-icons/react'
import IconVue from '~icons/simple-icons/vuedotjs'
import IconBook from '~icons/solar/book-linear'
import IconDatabase from '~icons/solar/database-linear'
import IconFileSearch from '~icons/solar/file-search-linear'
import IconMagicWand from '~icons/solar/magic-wand-3-linear'
import IconCocktail from '~icons/solar/wineglass-triangle-linear'
import { cn } from '@/lib/utils'

/**
 * 按题库名匹配图标，从上往下取第一条命中的，所以更具体的规则放前面（MySQL 要先于泛指的「数据库」）。
 * 有技术品牌 logo 的用单色 logo 配品牌色（color），没有的用 Solar 里含义相近的图标，保持前景色。
 * 品牌色取官方色；原色在浅灰方框里太淡的，换成官方给浅色背景用的版本（如 React）。
 * Simple Icons 的 MySQL 带字标、Redis 是 2024 年的新标，太小看不清或和旧印象对不上，这两个用 Devicon 的单色版
 */
const BANK_ICONS: {
  pattern: RegExp
  icon: ComponentType<SVGProps<SVGSVGElement>>
  color?: string
  /** 扁长的 logo 放大到方框边长的 3/4 才看得清 */
  wide?: boolean
}[] = [
  { pattern: /mongo/i, icon: IconMongodb, color: '#47A248' },
  { pattern: /redis/i, icon: IconRedis, color: '#A41E11' },
  { pattern: /mysql/i, icon: IconMysql, color: '#00758F' },
  { pattern: /postgres|\bsql\b|数据库/i, icon: IconDatabase },
  { pattern: /\bgin\b/i, icon: IconCocktail }, // Gin 即杜松子酒，用鸡尾酒杯；\b 避免误中 Nginx、Engine
  { pattern: /\bgo\b|golang/i, icon: IconGo, color: '#00ADD8', wide: true },
  // 原色 #61DAFB 在浅灰底上几乎看不见，用 react.dev 浅色模式的蓝
  { pattern: /react/i, icon: IconReact, color: '#087EA4' },
  { pattern: /vue/i, icon: IconVue, color: '#41B883' },
  { pattern: /\brag\b|检索/i, icon: IconFileSearch },
  { pattern: /prompt|提示词/i, icon: IconMagicWand },
]

/** 题库图标：方形，默认 40px，按题库名显示对应的品牌 logo 或图标，匹配不上时用书本 */
export function BankLogo({ name, className }: { name: string; className?: string }) {
  const rule = BANK_ICONS.find(r => r.pattern.test(name))
  const Icon = rule?.icon ?? IconBook

  return (
    <span
      aria-hidden
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center border bg-muted',
        className
      )}
    >
      {/* 图标默认占方框边长的一半：卡片里 40px → 20px，题库页头部 56px → 28px */}
      <Icon className={rule?.wide ? 'size-3/4' : 'size-1/2'} style={{ color: rule?.color }} />
    </span>
  )
}
