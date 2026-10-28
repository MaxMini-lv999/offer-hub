import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Fire } from 'reicon-react'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useHotQuestions } from '@/hooks/useQuestionQueries'
import { useScrollDirection } from '@/hooks/useScrollDirection'
import { cn } from '@/lib/utils'
import { questionPath } from '@/utils/route'

const HOT_LIMIT = 10

/**
 * 热门题目前 10 条，首页、题库页和全部题目页的侧栏共用，点击进入详情。
 * jobName 为空时取全站热门；enabled 为 false 时（职位方向还没查出来）先显示骨架。
 * bankId 是当前题库：热门题目也属于它时，链接带上它，详情页左侧就停在这个题库。
 * sticky 给列表页用：桌面端（≥1024px）吸顶在筛选栏旁边、行距收紧，往下滚列表时收起成标题栏，往上滚或回到顶部时展开，
 * 点标题栏也能手动展开收起；手机端排在列表下面，一直展开
 */
export function HotContent({
  jobName,
  bankId,
  enabled = true,
  sticky = false,
}: {
  jobName?: string
  bankId?: string
  enabled?: boolean
  sticky?: boolean
}) {
  const { data, isPending, isError, error, refetch } = useHotQuestions({ limit: HOT_LIMIT, job_name: jobName }, enabled)
  const isWide = useMediaQuery('(min-width: 1024px)')
  const collapsible = sticky && isWide
  const [collapsed, setCollapsed] = useState(false)
  const open = !collapsible || !collapsed
  const sectionRef = useRef<HTMLElement>(null)
  const listId = useId()

  useScrollDirection((direction) => {
    // 鼠标停在侧栏上或焦点在侧栏里，说明正在看热门，往下滚也不收起
    if (direction === 'down' && sectionRef.current?.matches(':hover, :focus-within')) return
    setCollapsed(direction === 'down')
  }, collapsible)

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hot-title"
      className={cn(
        'border border-foreground bg-background',
        // 下移 12px 和筛选栏里的搜索框顶边对齐（筛选栏吸顶在 55px，上内边距 12px）；最高占满视口，超出时列表内部滚动
        sticky && 'lg:sticky lg:top-[67px] lg:mt-3 lg:flex lg:max-h-[calc(100dvh-84px)] lg:flex-col',
      )}
    >
      <h2 id="hot-title" className="shrink-0 font-title text-heading font-semibold">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setCollapsed(open)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors duration-micro ease-standard hover:bg-muted focus-visible:outline-offset-[-2px]"
          >
            <Fire size={20} />
            热门题目
            <ChevronDown
              size={16}
              aria-hidden
              className={cn('ml-auto transition-transform duration-panel ease-standard', open && 'rotate-180')}
            />
          </button>
        ) : (
          <span className="flex items-center gap-2 px-4 py-3">
            <Fire size={20} />
            热门题目
          </span>
        )}
      </h2>

      {/* 收起时高度从 1fr 过渡到 0fr，动画结束后 invisible，链接退出 Tab 顺序 */}
      <div
        id={listId}
        className={cn(
          'grid min-h-0 transition-[grid-template-rows,visibility] duration-panel ease-standard motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'invisible grid-rows-[0fr]',
        )}
      >
        <div className={cn('min-h-0 border-t', sticky && 'lg:overflow-y-auto')}>
          {isPending && <HotSkeleton compact={sticky} />}

          {isError && <ErrorState message={error.message} onRetry={() => refetch()} className="border-0" />}

          {data && data.list.length === 0 && (
            <EmptyState
              icon={<Fire size={32} />}
              title="暂无热门题目"
              className="border-0"
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/questions">浏览全部题目</Link>
                </Button>
              }
            />
          )}

          {data && data.list.length > 0 && (
            <ol className="divide-y">
              {data.list.map((q, index) => (
                <li key={q.question_id}>
                  <Link
                    to={questionPath(q.question_id, bankId && q.bank_list.includes(bankId) ? bankId : q.bank_list[0])}
                    className={cn(
                      'flex gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-offset-[-2px]',
                      sticky && 'lg:py-2 lg:text-meta',
                    )}
                  >
                    {/* 前三名加粗 */}
                    <span
                      className={cn(
                        'w-5 shrink-0 text-right tabular-nums',
                        index < 3 ? 'font-bold text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="line-clamp-2 min-w-0 flex-1">{q.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * 骨架和真实列表同形：桌面端在 280px 侧栏里大多数标题折成两行，窄屏排在内容下面、整行宽，标题一行放得下；
 * 行高跟着正文或 meta 字号走
 */
function HotSkeleton({ compact }: { compact: boolean }) {
  const line = cn('h-[1.7em] bg-skeleton', compact && 'lg:h-[1.5em]')
  return (
    <div className="skeleton divide-y" aria-hidden>
      {Array.from({ length: HOT_LIMIT }, (_, i) => (
        <div key={i} className={cn('flex gap-3 px-4 py-3', compact && 'lg:py-2 lg:text-meta')}>
          <div className={cn(line, 'w-5 shrink-0')} />
          <div className="flex-1">
            <div className={cn(line, i % 3 === 0 ? 'w-full' : 'w-4/5')} />
            <div className={cn(line, 'hidden w-1/2 lg:block')} />
          </div>
        </div>
      ))}
    </div>
  )
}
