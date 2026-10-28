import { createSearchParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Book, Eye, Teacher } from 'reicon-react'
import { ArtImage, AtlasSprite, InkDecor } from '@/components/art'
import { BankLogo } from '@/components/BankLogo'
import { BentoCard, BentoGrid, PanelCaption } from '@/components/bento'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { HotContent } from '@/components/HotContent'
import { SearchBox } from '@/components/SearchBox'
import { Button } from '@/components/ui/button'
import { ART, CHIBI_STATES, HOST } from '@/constants/art'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useQuestionBanks } from '@/hooks/useQuestionQueries'
import { useTodayQuestion } from '@/hooks/useTodayQuestion'
import { countMastery, useProgress } from '@/lib/progress'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import type { JobQuestionGroup, QuestionBank } from '@/types/question'
import { bankPath, questionPath } from '@/utils/route'

/**
 * 首页：上面是 Bento 概览（主卡放搜索、今日一题、本机学习进度、继续上次或新手引导），
 * 下面左边职位方向 tab，每个方向下按系列分组展示题库卡片，右边（手机端在下方）当前方向的热门题目
 */
export function HomePage() {
  const { data, isPending, isError, error, refetch } = useQuestionBanks()
  const [searchParams, setSearchParams] = useSearchParams()

  // 当前 tab 放在 URL 的 job 参数里，从题库页返回时还停在原来的方向；缺失或不认识时回退到第一个
  const jobParam = searchParams.get('job')
  const activeGroup = data?.find((group) => group.job_name === jobParam) ?? data?.[0]

  function switchTab(jobName: string) {
    setSearchParams({ job: jobName }, { replace: true, preventScrollReset: true })
  }

  return (
    <div className="space-y-8">
      <BentoGrid>
        <HeroCard groups={data} />
        <TodayCard />
        <ProgressCard />
        <RecentCard />
      </BentoGrid>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-4">
        <section aria-labelledby="banks-title" className="min-w-0">
          <h2 id="banks-title" className="sr-only">
            题库
          </h2>
          {isPending && <HomeSkeleton />}

          {isError && <ErrorState message={error.message} onRetry={() => refetch()} withArt />}

          {data && data.length === 0 && (
            <EmptyState
              art={ART.stateEmptyBookmarks}
              title="还没有任何题库"
              action={
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  刷新
                </Button>
              }
            />
          )}

          {data && activeGroup && (
            <>
              {/* 外层画底线，内层 -mb-px 让选中项的 2px 下划线压在底线上；方向多时内层横向滚动，页面本身不滚 */}
              <div className="border-b">
                <div role="tablist" aria-label="职位方向" className="scrollbar-none -mb-px flex gap-6 overflow-x-auto">
                  {data.map((group) => {
                    const active = group === activeGroup
                    return (
                      <button
                        key={group.job_name}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => switchTab(group.job_name)}
                        className={cn(
                          'shrink-0 border-b-2 pb-3 font-medium transition-colors',
                          active
                            ? 'border-foreground text-foreground'
                            : 'border-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                        )}
                      >
                        {group.job_name}
                        <span className="ml-2 text-meta tabular-nums">{countBanks(group)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <SeriesSections group={activeGroup} />
            </>
          )}
        </section>

        {/* 题库列表出错或为空时 activeGroup 是 undefined，退回全站热门 */}
        <aside>
          <HotContent jobName={activeGroup?.job_name} enabled={!isPending} />
        </aside>
      </div>
    </div>
  )
}

/**
 * 主卡（2×2）：左边标题、搜索框和题库概况，右边是首页封面插画（独立容器，文字不压在图上）。
 * 手机端只留纯底搜索卡，不加载插画
 */
function HeroCard({ groups }: { groups?: JobQuestionGroup[] }) {
  const navigate = useNavigate()
  const theme = useTheme()
  const isDesktop = useIsDesktop()
  const bankCount = groups?.reduce((sum, group) => sum + countBanks(group), 0)

  // 首页不展示搜索结果，回车后带着关键词去全部题目页
  function searchQuestions(keyword: string) {
    if (!keyword) return
    navigate({ pathname: '/questions', search: `?${createSearchParams({ keyword })}` })
  }

  return (
    <BentoCard size="2x2" className="p-0 md:flex-row md:p-0">
      <div className="relative isolate flex flex-col justify-between gap-6 p-4 md:w-[56%] md:p-6">
        <PanelCaption>Offer Hub · 面试题库</PanelCaption>
        <div className="space-y-2">
          <h1 className="font-title text-title font-semibold md:text-display">
            今天，
            <br className="hidden md:block" />
            也来刷一题
          </h1>
          <p className="text-muted-foreground">按职位方向挑选题库，系统地准备面试。</p>
        </div>
        <div className="space-y-2">
          <SearchBox value="" onSearch={searchQuestions} placeholder="搜索题目标题或内容" auto={false} />
          <p className="h-[1.5em] text-meta tabular-nums text-muted-foreground">
            {groups && groups.length > 0 && `${groups.length} 个职位方向 · ${bankCount} 个题库`}
          </p>
        </div>
        {/* 左下角一小片网点，压在文字下面 */}
        <InkDecor name="ink-halftone" tile className="absolute bottom-0 left-0 -z-10 h-20 w-48 text-foreground opacity-10" />
      </div>
      {isDesktop && (
        <div className="relative min-w-0 flex-1 border-l border-foreground">
          <ArtImage
            art={theme === 'dark' ? ART.heroCoverDark : ART.heroCover}
            priority
            className="absolute inset-0 h-full w-full object-cover object-[78%_30%]"
          />
        </div>
      )}
    </BentoCard>
  )
}

/** 今日一题（2×1）：全站热门按日期轮换，可以直接阅读，也可以用模拟面试作答 */
function TodayCard() {
  const { today, isPending } = useTodayQuestion()
  const now = new Date()

  return (
    <BentoCard size="2x1" className="justify-between gap-3">
      <div className="flex items-center justify-between gap-2">
        <PanelCaption>今日一题</PanelCaption>
        <span className="text-meta tabular-nums text-muted-foreground">
          {now.getMonth() + 1} 月 {now.getDate()} 日
        </span>
      </div>

      {today ? (
        <>
          <Link
            to={questionPath(today.question_id, today.bank_list[0])}
            className="line-clamp-2 font-title text-heading font-semibold decoration-2 underline-offset-4 hover:underline"
          >
            {today.title}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-meta">
            <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground">
              <Eye size={14} />
              {today.view_count} 次浏览
            </span>
            <Link
              to={questionPath(today.question_id, today.bank_list[0], 'interview')}
              className="inline-flex items-center gap-1 font-medium decoration-2 underline-offset-4 hover:underline"
            >
              <Teacher size={14} />
              用模拟面试作答
            </Link>
          </div>
        </>
      ) : isPending ? (
        <div aria-hidden className="animate-pulse space-y-2">
          <div className="h-6 w-4/5 bg-muted" />
          <div className="h-5 w-1/3 bg-muted" />
        </div>
      ) : (
        <p className="text-muted-foreground">
          今天还没有推荐，去
          <Link to="/questions" className="mx-1 underline underline-offset-4">
            全部题目
          </Link>
          看看。
        </p>
      )}
    </BentoCard>
  )
}

/** 掌握题数的里程碑，进度条按下一个里程碑算 */
const MILESTONES = [1, 10, 30, 50, 100, 200, 500]

/** 学习进度（1×1）：本机记录的掌握题数和下一个里程碑；掌握满 10 题换成奖杯插画 */
function ProgressCard() {
  const { mastery } = useProgress()
  const counts = countMastery(mastery)
  const mastered = counts[1]
  const nextMilestone = MILESTONES.find((m) => m > mastered)
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= mastered) ?? 0
  const percent = nextMilestone ? ((mastered - prevMilestone) / (nextMilestone - prevMilestone)) * 100 : 100

  return (
    <BentoCard size="1x1" className="justify-between gap-2">
      <PanelCaption>学习进度 · 本机</PanelCaption>
      <div className="flex items-end justify-between gap-2">
        <p className="font-title text-title font-semibold tabular-nums">
          {mastered}
          <span className="ml-1 font-sans text-meta font-normal text-muted-foreground">题已掌握</span>
        </p>
        {mastered >= 10 ? (
          <ArtImage art={ART.stateMastery} alt="掌握里程碑奖杯" variant="mobile" className="h-14 w-14 object-contain" />
        ) : (
          mastered > 0 && <InkDecor name="progress-seal" className="h-10 w-10 text-brand" />
        )}
      </div>
      <div className="space-y-1">
        <div
          role="progressbar"
          aria-label="距下一个里程碑"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1 bg-brand-soft"
        >
          <div className="h-full bg-brand transition-[width] duration-panel ease-standard" style={{ width: `${percent}%` }} />
        </div>
        <p className="truncate text-meta text-muted-foreground">
          {mastered === 0
            ? '模拟面试最后可以标记掌握程度'
            : `${nextMilestone ? `下一站 ${nextMilestone} 题` : '里程碑全部达成'} · 模糊 ${counts[2]} · 不会 ${counts[3]}`}
        </p>
      </div>
    </BentoCard>
  )
}

/** 继续上次（1×1）：最近浏览的题目；第一次来时换成墨樱的新手引导 */
function RecentCard() {
  const { recent } = useProgress()
  const last = recent[0]

  if (!last) {
    return (
      <BentoCard size="1x1" className="justify-between gap-2">
        <PanelCaption>第一次来？</PanelCaption>
        <div className="flex items-center gap-3">
          <AtlasSprite art={HOST.chibi} index={CHIBI_STATES.indexOf('welcome')} size={64} />
          <p className="text-meta text-muted-foreground">
            我是墨樱。从「今日一题」开始，或者在题目页右上角切到模拟面试。
          </p>
        </div>
      </BentoCard>
    )
  }

  return (
    <BentoCard size="1x1" asChild className="justify-between gap-2">
      <Link to={questionPath(last.id, last.bankId)}>
        <PanelCaption>继续上次</PanelCaption>
        <p className="line-clamp-2 font-title font-semibold">{last.title}</p>
        <p className="text-meta text-muted-foreground">接着看 →</p>
      </Link>
    </BentoCard>
  )
}

/** 一个职位方向下的题库总数，显示在 tab 名后面 */
function countBanks(group: JobQuestionGroup) {
  return group.series_list.reduce((sum, series) => sum + series.bank_list.length, 0)
}

/** 一个职位方向下的所有系列，系列之间用细线分隔 */
function SeriesSections({ group }: { group: JobQuestionGroup }) {
  if (group.series_list.length === 0) {
    return (
      <EmptyState
        art={ART.stateEmptyBookmarks}
        title="这个方向还没有题库"
        className="mt-8"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/questions">浏览全部题目</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div role="tabpanel" aria-label={group.job_name} className="divide-y">
      {group.series_list.map((series) => (
        <section key={series.series_id} className="space-y-4 py-8">
          <h3 className="font-title text-heading font-semibold">{series.series_name}</h3>

          {series.bank_list.length === 0 ? (
            <EmptyState
              icon={<Book size={32} />}
              title="这个系列还没有题库"
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/questions">浏览全部题目</Link>
                </Button>
              }
            />
          ) : (
            // 主栏右边有热门侧栏，lg 下只剩约 680px，到 xl 才排三列
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {series.bank_list.map((bank) => (
                <BankCard key={bank.bank_id} bank={bank} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

function BankCard({ bank }: { bank: QuestionBank }) {
  return (
    <Link to={bankPath(bank.bank_id)} className="flex h-full gap-4 border p-4 transition-colors hover:border-foreground">
      <BankLogo name={bank.bank_name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <h4 className="truncate font-semibold">{bank.bank_name}</h4>
        {/* 描述固定占两行高度，卡片之间对齐 */}
        <p className="mt-1 line-clamp-2 min-h-[3em] text-meta text-muted-foreground">{bank.desc || '暂无描述'}</p>
        <p className="mt-2 text-meta text-muted-foreground">{bank.count} 题</p>
      </div>
    </Link>
  )
}

/** 主栏骨架，和真实内容同形：tab 行 + 两个系列，每个系列一组卡片；侧栏骨架由 HotContent 自己出 */
function HomeSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="flex gap-6 border-b pb-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-6 w-20 bg-muted" />
        ))}
      </div>
      <div className="divide-y">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-4 py-8">
            <div className="h-7 w-24 bg-muted" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex gap-4 border p-4">
                  <div className="h-10 w-10 shrink-0 bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-6 w-1/2 bg-muted" />
                    <div className="h-4 w-full bg-muted" />
                    <div className="h-4 w-2/3 bg-muted" />
                    <div className="h-4 w-10 bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
