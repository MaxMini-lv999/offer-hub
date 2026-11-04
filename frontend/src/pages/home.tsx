import type { ComponentType, SVGProps } from 'react'
import { useNavigate } from 'react-router-dom'
import IconChecklist from '~icons/solar/checklist-minimalistic-linear'
import IconLibrary from '~icons/solar/library-linear'
import IconLightbulb from '~icons/solar/lightbulb-linear'
import IconAcademicCap from '~icons/solar/square-academic-cap-linear'
import { ArtImage } from '@/components/art'
import { BentoCard, PanelCaption } from '@/components/bento'
import { HotQuestions } from '@/components/HotQuestions'
import { Button } from '@/components/ui/button'
import { ART } from '@/constants/art'
import { useLogin } from '@/hooks/useLogin'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useQuestionBanks, useQuestionList } from '@/hooks/useQuestionQueries'
import { useTheme } from '@/lib/theme'

/**
 * 首页：落地页，从上到下是 Hero（标题、简介、题库概况数字）、热门榜单、平台特性、开始刷题引导。
 * 版权信息在全站布局的页脚里，这里不再重复一行。题库目录在 /collections
 */
export function HomePage() {
  return (
    <div className="space-y-12">
      <HeroSection />
      <HotContentSection />
      <FeaturesSection />
      <CTASection />
    </div>
  )
}

/**
 * Hero：墨线框左边是标题、简介和概况数字，右边是书房场景 + 澜汐的半身立绘（独立容器，文字不压在图上）。
 * 立绘从右边淡入、之后轻微呼吸；手机端只留文字，不加载插画。一屏最多一个角色，下面各区块都只用图标
 */
function HeroSection() {
  const theme = useTheme()
  const isDesktop = useIsDesktop()

  return (
    <BentoCard className="flex-row p-0 md:p-0">
      <div className="relative isolate flex min-w-0 flex-1 flex-col gap-6 p-4 md:w-[56%] md:flex-none md:p-6">
        <PanelCaption>Offer Hub · 面试题库</PanelCaption>
        <div className="space-y-2">
          <h1 className="font-title text-title font-semibold md:text-display">成为技术面试高手</h1>
          <p className="text-muted-foreground">
            按职位方向整理的面试真题，每道题配解析和讨论，还能来一场模拟面试。
          </p>
        </div>
        <StatsSection />
        {/* 左下角一小片网点，往右上渐隐，压在文字下面 */}
        <span
          aria-hidden
          className="absolute bottom-0 left-0 -z-10 h-20 w-48 bg-[radial-gradient(currentColor_1px,transparent_1.5px)] bg-[length:6px_6px] opacity-15 [mask-image:linear-gradient(to_top_right,black,transparent_75%)]"
        />
      </div>
      {isDesktop && (
        <div className="relative isolate min-w-0 flex-1 overflow-hidden border-l border-foreground">
          {/* 放大 3% 再模糊，免得边缘透出底色；和 VN 舞台同一种处理 */}
          <ArtImage
            art={theme === 'dark' ? ART.sceneNight : ART.sceneDay}
            priority
            className="absolute inset-0 -z-10 h-full w-full scale-[1.03] object-cover blur-[1.5px]"
          />
          {/* 立绘按 Hero 高度的 1.8 倍放，只露出头到腰，伸出的手朝向左边的标题 */}
          <div className="ohm-character-enter absolute right-[8%] top-3 h-[180%]">
            <div className="ohm-breathe h-full">
              <ArtImage art={ART.portraitWelcome} priority className="h-full w-auto max-w-none" />
            </div>
          </div>
        </div>
      )}
    </BentoCard>
  )
}

/**
 * 概况数字：题目总数取题目列表接口的 total（一页只要 1 条），题库数和职位方向数从题库全量列表里数，
 * 后者和热门榜单的页签共用同一份缓存。加载中放和数字同高的骨架，出错显示破折号
 */
function StatsSection() {
  const banks = useQuestionBanks()
  const questions = useQuestionList({ page_size: 1 })
  const bankCount = banks.data?.reduce(
    (sum, group) => sum + group.series_list.reduce((n, series) => n + series.bank_list.length, 0),
    0
  )

  return (
    <ul aria-label="题库概况" className="grid grid-cols-3 border-t">
      <StatItem unit="道题目" value={questions.data?.total} isError={questions.isError} />
      <StatItem unit="个题库" value={bankCount} isError={banks.isError} />
      <StatItem unit="个职位方向" value={banks.data?.length} isError={banks.isError} />
    </ul>
  )
}

/** 数字在上、单位在下，读屏按顺序念成「30 道题目」 */
function StatItem({ unit, value, isError }: { unit: string; value?: number; isError: boolean }) {
  return (
    <li className="border-l pl-4 pt-4 first:border-l-0 first:pl-0">
      <span className="block font-title text-title font-semibold tabular-nums">
        {value !== undefined ? (
          value
        ) : isError ? (
          '—'
        ) : (
          <span aria-hidden className="skeleton block h-[1.3em] w-12 bg-skeleton" />
        )}
      </span>
      <span className="block text-meta text-muted-foreground">{unit}</span>
    </li>
  )
}

/**
 * 热门榜单：和热门页同一个组件、同一份数据，这里只显示前 10 名，页签行右边进完整榜单。
 * 排名按后端的热度而不是浏览数，标题旁注明，免得浏览数少的排在前面让人困惑
 */
function HotContentSection() {
  return (
    <section aria-labelledby="hot-ranking-title" className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h2 id="hot-ranking-title" className="shrink-0 font-title text-heading font-semibold">
          热门榜单
        </h2>
        <p className="truncate text-meta text-muted-foreground">按热度排名</p>
      </div>
      <HotQuestions max={10} showMore />
    </section>
  )
}

const FEATURES: { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; desc: string }[] = [
  {
    icon: IconLibrary,
    title: '海量真题',
    desc: '按职位方向、技术系列、题库三级整理的面试真题，按方向找题不迷路。',
  },
  {
    icon: IconLightbulb,
    title: '精选解析',
    desc: '每道题配图文解析和代码示例，评论区还能看到其他人的思路。',
  },
  {
    icon: IconChecklist,
    title: '掌握状态追踪',
    desc: '登录后把题目标成已掌握、晚点再刷或未掌握，复习时心里有数。',
  },
  {
    icon: IconAcademicCap,
    title: '模拟面试',
    desc: '澜汐当面试官逐题提问，你先想再看讲解，最后自评掌握程度。',
  },
]

/** 平台特性：四格共用 1px 分隔线（外框画左边和上边，每格画右边和下边），平板两列、桌面四列 */
function FeaturesSection() {
  return (
    <section aria-labelledby="features-title" className="space-y-4">
      <h2 id="features-title" className="font-title text-heading font-semibold">
        平台特性
      </h2>
      <ul className="grid border-l border-t sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <li key={title} className="space-y-2 border-b border-r p-4 md:p-6">
            <Icon className="size-6" />
            <h3 className="font-title font-semibold">{title}</h3>
            <p className="text-meta text-muted-foreground">{desc}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * 开始刷题引导：游客点按钮去全部题目页并弹出登录弹窗（弹窗挂在全站布局里，换页后还在），
 * 已登录直接去全部题目页，文案也不再是注册引导
 */
function CTASection() {
  const navigate = useNavigate()
  const { isLoggedIn, setShowLoginDialog } = useLogin()

  function start() {
    navigate('/questions')
    if (!isLoggedIn) setShowLoginDialog(true)
  }

  return (
    <BentoCard
      aria-labelledby="cta-title"
      className="gap-4 md:flex-row md:items-center md:justify-between"
    >
      <div className="space-y-1">
        <h2 id="cta-title" className="font-title text-heading font-semibold">
          {isLoggedIn ? '继续今天的练习' : '注册账号，开始系统刷题'}
        </h2>
        <p className="text-muted-foreground">
          {isLoggedIn ? '去全部题目里挑一道，接着刷。' : '登录后可以点赞、评论和标记掌握状态。'}
        </p>
      </div>
      <Button size="lg" onClick={start} className="shrink-0 self-start md:self-auto">
        立即开始刷题
      </Button>
    </BentoCard>
  )
}
