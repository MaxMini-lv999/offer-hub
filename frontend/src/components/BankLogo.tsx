import { Book, Database, Magicpen, MessageSearch, Wineglass2 } from 'reicon-react'
import { BRAND_ICONS, type BrandIcon, type BrandName } from '@/constants/brandIcons'
import { cn } from '@/lib/utils'

/**
 * 按题库名匹配图标，从上往下取第一条命中的，所以更具体的规则放前面（MySQL 要先于泛指的「数据库」）。
 * 有技术品牌 logo 的用 logo（brand），没有的用 reicon 里含义相近的图标（icon）
 */
const BANK_ICONS: ({ pattern: RegExp } & ({ brand: BrandName } | { icon: typeof Book }))[] = [
  { pattern: /mongo/i, brand: 'mongodb' },
  { pattern: /redis/i, brand: 'redis' },
  { pattern: /mysql/i, brand: 'mysql' },
  { pattern: /postgres|\bsql\b|数据库/i, icon: Database },
  { pattern: /\bgin\b/i, icon: Wineglass2 }, // Gin 即杜松子酒，用鸡尾酒杯；\b 避免误中 Nginx、Engine
  { pattern: /\bgo\b|golang/i, brand: 'go' },
  { pattern: /react/i, brand: 'react' },
  { pattern: /vue/i, brand: 'vue' },
  { pattern: /\brag\b|检索/i, icon: MessageSearch },
  { pattern: /prompt|提示词/i, icon: Magicpen },
]

/** 品牌 logo 渲染成单色：主体用前景色，soft 用次级灰，cut 用方框底色当镂空 */
function BrandSvg({ name }: { name: BrandName }) {
  const icon: BrandIcon = BRAND_ICONS[name]
  const size = `${icon.scale ?? 50}%`

  return (
    <svg viewBox={icon.viewBox} width={size} height={size} fill="currentColor" aria-hidden>
      {icon.paths.map((path, i) => (
        <path
          key={i}
          d={path.d}
          transform={path.transform}
          fillRule={path.evenOdd ? 'evenodd' : undefined}
          className={cn(path.tone === 'soft' && 'fill-muted-foreground', path.tone === 'cut' && 'fill-muted')}
        />
      ))}
    </svg>
  )
}

/** 题库图标：方形，默认 40px，按题库名显示对应的品牌 logo 或图标，匹配不上时用书本 */
export function BankLogo({ name, className }: { name: string; className?: string }) {
  const rule = BANK_ICONS.find((r) => r.pattern.test(name))
  const Icon = rule && 'icon' in rule ? rule.icon : Book

  return (
    <span aria-hidden className={cn('flex h-10 w-10 shrink-0 items-center justify-center border bg-muted', className)}>
      {/* 图标默认占方框边长的一半：卡片里 40px → 20px，题库页头部 56px → 28px */}
      {rule && 'brand' in rule ? <BrandSvg name={rule.brand} /> : <Icon size="50%" />}
    </span>
  )
}
