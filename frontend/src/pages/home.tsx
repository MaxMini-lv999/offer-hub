import { createSearchParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Book, Eye, Teacher } from 'reicon-react'
import { ArtImage, CharacterSprite, MotionVector } from '@/components/art'
import { BankLogo } from '@/components/BankLogo'
import { BentoCard, PanelCaption } from '@/components/bento'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { HotContent } from '@/components/HotContent'
import { SearchBox } from '@/components/SearchBox'
import { Button } from '@/components/ui/button'
import { ART, GUIDE } from '@/constants/art'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useQuestionBanks } from '@/hooks/useQuestionQueries'
import { useTodayQuestion } from '@/hooks/useTodayQuestion'
import { countMastery, useProgress } from '@/lib/progress'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import type { JobQuestionGroup, QuestionBank } from '@/types/question'
import { bankPath, questionPath } from '@/utils/route'

/**
 * 首页：入口页，「封面 + 目录」。
 * 上面一个墨线框，从上到下是封面（标题、搜索、澜汐立绘）、今日一题头条、一行学习进度和继续上次；
 * 下面左边是题库目录（职位方向 + 按系列分组的题库索引），右边（手机端在下方）当前方向的热门题目。
 * 一屏最多一个角色：封面已经有立绘，所以目录的空状态和出错状态只用图标
 */
export function HomePage() {
  const { data, isPending, isError, error, refetch } = useQuestionBanks()
  const [searchParams, setSearchParams] = useSearchParams()

  // 当前方向放在 URL 的 job 参数里，从题库页返回时还停在原来的方向；缺失或不认识时回退到第一个
  const jobParam = searchParams.get('job')
  const activeGroup = data?.find((group) => group.job_name === jobParam) ?? data?.[0]

  function switchJob(jobName: string) {
    setSearchParams({ job: jobName }, { replace: true, preventScrollReset: true })
  }

  return (
    <div className="space-y-8">
      <BentoCard className="p-0 md:p-0">
        <Cover groups={data} />
        <TodayHeadline />
        <StudyStatus />
      </BentoCard>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-4">
        <section aria-labelledby="banks-title" className="min-w-0">
          <h2 id="banks-title" className="mb-4 font-title text-heading font-semibold">
            题库目录
          </h2>

          {isPending && <IndexSkeleton />}

          {isError && <ErrorState message={error.message} onRetry={() => refetch()} />}

          {data && data.length === 0 && (
            <EmptyState
              icon={<Book size={32} />}
              title="还没有任何题库"
              action={
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  刷新
                </Button>
              }
            />
          )}

          {data && activeGroup && <BankIndex groups={data} active={activeGroup} onSelect={switchJob} />}
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
 * 封面：左边标题、搜索框和题库概况，右边是书房场景 + 澜汐的半身立绘（独立容器，文字不压在图上）。
 * 立绘从右边淡入、之后轻微呼吸；手机端只留文字，不加载插画
 */
function Cover({ groups }: { groups?: JobQuestionGroup[] }) {
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
    <div className="flex">
      <div className="relative isolate flex min-w-0 flex-1 flex-col gap-4 p-4 md:w-[56%] md:flex-none md:p-6">
        <PanelCaption>Offer Hub · 面试题库</PanelCaption>
        <div className="space-y-2">
          <h1 className="font-title text-title font-semibold md:text-display">今天，也来刷一题</h1>
          <p className="text-muted-foreground">按职位方向挑选题库，系统地准备面试。</p>
        </div>
        <div className="space-y-2">
          <SearchBox value="" onSearch={searchQuestions} placeholder="搜索题目标题或内容" auto={false} />
          <p className="h-[1.5em] text-meta tabular-nums text-muted-foreground">
            {groups && groups.length > 0 && `${groups.length} 个职位方向 · ${bankCount} 个题库 · 回车搜索全部题目`}
          </p>
        </div>
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
          {/* 立绘按封面高度的 1.8 倍放，只露出头到腰，伸出的手朝向左边的标题 */}
          <div className="ohm-character-enter absolute right-[8%] top-3 h-[180%]">
            <div className="ohm-breathe h-full">
              <ArtImage art={ART.portraitWelcome} priority className="h-full w-auto max-w-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 今日一题头条：全站热门按日期轮换，标题本身就是阅读入口，旁边是用模拟面试作答。
 * 手机上标题固定占两行高度，加载前后不跳；平板以上一行放得下
 */
function TodayHeadline() {
  const { today, isPending } = useTodayQuestion()
  const now = new Date()

  return (
    <section aria-label="今日一题" className="space-y-2 border-t border-foreground p-4 md:px-6">
      <div className="flex items-center gap-3">
        <PanelCaption>今日一题</PanelCaption>
        <span className="text-meta tabular-nums text-muted-foreground">
          {now.getMonth() + 1} 月 {now.getDate()} 日
        </span>
      </div>

      {today ? (
        <div className="lg:flex lg:items-baseline lg:justify-between lg:gap-6">
          <h2 className="line-clamp-2 min-h-[2.8em] font-title text-heading font-semibold md:min-h-0 lg:min-w-0">
            <Link
              to={questionPath(today.question_id, today.bank_list[0])}
              className="decoration-2 underline-offset-4 hover:underline"
            >
              {today.title}
            </Link>
          </h2>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-meta lg:mt-0 lg:shrink-0 lg:justify-end">
            <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground">
              <Eye size={14} />
              {today.view_count} 次浏览
            </span>
            <Link
              to={questionPath(today.question_id, today.bank_list[0], 'interview')}
              className="inline-flex items-center gap-1 font-medium decoration-2 underline-offset-4 hover:underline"
            >
              <Teacher size={14} />
              用模拟面试作答 →
            </Link>
          </div>
        </div>
      ) : isPending ? (
        <div aria-hidden className="skeleton lg:flex lg:items-center lg:justify-between lg:gap-6">
          <div className="text-heading lg:min-w-0 lg:flex-1">
            <div className="h-[2.8em] w-4/5 bg-skeleton md:h-[1.4em] lg:w-2/3" />
          </div>
          <div className="mt-2 text-meta lg:mt-0">
            <div className="h-[1.5em] w-56 max-w-full bg-skeleton" />
          </div>
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
    </section>
  )
}

/** 掌握题数的里程碑，进度条按下一个里程碑算 */
const MILESTONES = [1, 10, 30, 50, 100, 200, 500]

/**
 * 一行次要信息：本机记录的掌握进度 + 继续上次（手机端分两行）。
 * 第一次来（没看过题也没掌握过）时整行换成澜汐的新手引导，手机端封面没有立绘，这里配一次挥手；
 * 掌握过题目时进度前面是完成勾，满 10 题换成樱红的里程碑星
 */
function StudyStatus() {
  const isDesktop = useIsDesktop()
  const { mastery, recent } = useProgress()
  const counts = countMastery(mastery)
  const mastered = counts[1]
  const last = recent[0]

  if (!last && mastered === 0) {
    return (
      <div className="flex items-center gap-3 border-t px-4 py-2 text-meta text-muted-foreground md:px-6">
        {!isDesktop && <CharacterSprite name="wave" size={44} />}
        <p>第一次来？我是{GUIDE.name}。从上面的「今日一题」开始，或者在题目页右上角切到模拟面试。</p>
      </div>
    )
  }

  const nextMilestone = MILESTONES.find((m) => m > mastered)
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= mastered) ?? 0
  const percent = nextMilestone ? ((mastered - prevMilestone) / (nextMilestone - prevMilestone)) * 100 : 100

  return (
    <div className="flex flex-col gap-2 border-t px-4 py-3 text-meta text-muted-foreground md:flex-row md:items-center md:justify-between md:gap-6 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {mastered >= 10 ? (
          <MotionVector name="milestone" size={24} alt="掌握里程碑" />
        ) : (
          mastered > 0 && <MotionVector name="check" size={20} />
        )}
        <span className="shrink-0">
          <span className="font-medium tabular-nums text-foreground">{mastered}</span> 题已掌握 · 本机
        </span>
        <div
          role="progressbar"
          aria-label="距下一个里程碑"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1 w-16 shrink-0 bg-brand-soft md:w-24"
        >
          <div className="h-full bg-brand transition-[width] duration-panel ease-standard" style={{ width: `${percent}%` }} />
        </div>
        <span className="truncate">
          {mastered === 0 ? (
            '模拟面试最后可以标记掌握程度'
          ) : (
            <>
              {nextMilestone ? `下一站 ${nextMilestone} 题` : '里程碑全部达成'}
              <span className="hidden sm:inline">
                {' '}
                · 模糊 {counts[2]} · 不会 {counts[3]}
              </span>
            </>
          )}
        </span>
      </div>

      {last ? (
        <Link
          to={questionPath(last.id, last.bankId)}
          data-continue
          className="group flex min-w-0 items-center gap-1 hover:text-foreground md:max-w-[50%]"
        >
          <span className="shrink-0">继续上次：</span>
          <span className="truncate font-medium text-foreground decoration-2 underline-offset-4 group-hover:underline">
            {last.title}
          </span>
          <span aria-hidden className="shrink-0 text-foreground">
            →
          </span>
        </Link>
      ) : (
        <span>还没看过题目，从今日一题开始吧</span>
      )}
    </div>
  )
}

/** 一个职位方向下的题库总数，显示在方向名后面 */
function countBanks(group: JobQuestionGroup) {
  return group.series_list.reduce((sum, series) => sum + series.bank_list.length, 0)
}

/**
 * 题库目录：职位方向在桌面端竖排在左边（左侧 1px 线，选中项 2px 竖线压在上面），
 * 手机端横排成一行可左右滚动（底部 1px 线，选中项 2px 下划线压在上面）；右边或下面是当前方向的索引
 */
function BankIndex({
  groups,
  active,
  onSelect,
}: {
  groups: JobQuestionGroup[]
  active: JobQuestionGroup
  onSelect: (jobName: string) => void
}) {
  return (
    <div className="lg:grid lg:grid-cols-[160px_minmax(0,1fr)] lg:gap-8">
      <div className="border-b lg:self-start lg:border-b-0 lg:border-l">
        <div
          role="tablist"
          aria-label="职位方向"
          className="scrollbar-none -mb-px flex gap-6 overflow-x-auto lg:-ml-px lg:mb-0 lg:flex-col lg:gap-0 lg:overflow-visible"
        >
          {groups.map((group) => {
            const selected = group === active
            return (
              <button
                key={group.job_name}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="bank-index"
                onClick={() => onSelect(group.job_name)}
                className={cn(
                  // 横向滚动的容器会裁掉外扩的焦点框，这里改成内描边
                  'flex shrink-0 items-baseline justify-between gap-2 border-b-2 pb-3 font-medium transition-colors focus-visible:outline-offset-[-2px] lg:border-b-0 lg:border-l-2 lg:py-2 lg:pl-4 lg:text-left',
                  selected
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                )}
              >
                {group.job_name}
                <span className="text-meta tabular-nums">{countBanks(group)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <SeriesIndex group={active} />
    </div>
  )
}

/** 当前方向下的系列，每个系列一段：宋体小标题压一条墨线，下面是题库索引行（平板以上两列） */
function SeriesIndex({ group }: { group: JobQuestionGroup }) {
  if (group.series_list.length === 0) {
    return (
      <EmptyState
        icon={<Book size={32} />}
        title="这个方向还没有题库"
        className="mt-6 lg:mt-0"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/questions">浏览全部题目</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div id="bank-index" role="tabpanel" aria-label={group.job_name} className="mt-6 space-y-6 lg:mt-0">
      {group.series_list.map((series) => (
        <section key={series.series_id} aria-label={series.series_name}>
          <h3 className="border-b border-foreground pb-2 font-title font-semibold">{series.series_name}</h3>
          {series.bank_list.length === 0 ? (
            <p className="py-3 text-meta text-muted-foreground">
              这个系列还没有题库，先去
              <Link to="/questions" className="mx-1 underline underline-offset-4 hover:text-foreground">
                全部题目
              </Link>
              看看。
            </p>
          ) : (
            <ul className="grid md:grid-cols-2 md:gap-x-8">
              {series.bank_list.map((bank) => (
                <BankIndexRow key={bank.bank_id} bank={bank} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

/** 目录行：图标 + 题库名，点线引到右边的题数，下面一行简介 */
function BankIndexRow({ bank }: { bank: QuestionBank }) {
  return (
    <li className="border-b">
      <Link to={bankPath(bank.bank_id)} className="flex items-center gap-3 px-2 py-3 transition-colors hover:bg-muted">
        <BankLogo name={bank.bank_name} className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-medium">{bank.bank_name}</span>
            <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-muted-foreground" />
            <span className="shrink-0 text-meta tabular-nums text-muted-foreground">{bank.count} 题</span>
          </div>
          <p className="truncate text-meta text-muted-foreground">{bank.desc || '暂无描述'}</p>
        </div>
      </Link>
    </li>
  )
}

/** 目录骨架，和真实内容同形同高：方向列表三项 + 两个系列，每个系列三行索引；侧栏骨架由 HotContent 自己出 */
function IndexSkeleton() {
  return (
    <div aria-hidden className="skeleton lg:grid lg:grid-cols-[160px_minmax(0,1fr)] lg:gap-8">
      <div className="border-b lg:self-start lg:border-b-0 lg:border-l">
        <div className="-mb-px flex gap-6 lg:-ml-px lg:mb-0 lg:flex-col lg:gap-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-b-2 border-transparent pb-3 lg:border-b-0 lg:border-l-2 lg:py-2 lg:pl-4">
              <div className="h-[1.7em] w-20 bg-skeleton" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 space-y-6 lg:mt-0">
        {[0, 1].map((i) => (
          <div key={i}>
            <div className="border-b border-foreground pb-2">
              <div className="h-[1.7em] w-20 bg-skeleton" />
            </div>
            <div className="grid md:grid-cols-2 md:gap-x-8">
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex items-center gap-3 border-b px-2 py-3">
                  <div className="h-8 w-8 shrink-0 bg-skeleton" />
                  <div className="min-w-0 flex-1">
                    <div className="h-[1.7em] w-1/2 bg-skeleton" />
                    <div className="text-meta">
                      <div className="h-[1.5em] w-3/4 bg-skeleton" />
                    </div>
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
