import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { DocumentText, History } from 'reicon-react'
import { CharacterSprite } from '@/components/art'
import { PanelCaption } from '@/components/bento'
import { DifficultyLabel } from '@/components/DifficultyLabel'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Backlog } from '@/components/vn/Backlog'
import { ChoiceList, type Choice } from '@/components/vn/ChoiceList'
import { DialogueBox } from '@/components/vn/DialogueBox'
import { VNStage } from '@/components/vn/VNStage'
import { ART, GUIDE, preloadArt, type ArtAsset, type MotionName } from '@/constants/art'
import { useLogin } from '@/hooks/useLogin'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useNeighbors } from '@/hooks/useNeighbors'
import { useTypewriter } from '@/hooks/useTypewriter'
import { useVNKeys } from '@/hooks/useVNKeys'
import { setMastery, type Mastery } from '@/lib/progress'
import { useTheme } from '@/lib/theme'
import type { Question } from '@/types/question'
import { bankPath, questionPath } from '@/utils/route'
import { toSegments } from '@/utils/segments'

/** 模拟面试的流程：念题 →（想一想）→ 逐段讲解析 →（游客到此为止）→ 问掌握程度 → 面试官反馈 */
type Step =
  | { kind: 'question' }
  | { kind: 'think' }
  | { kind: 'answer'; index: number }
  | { kind: 'truncated' }
  | { kind: 'rate' }
  | { kind: 'reaction'; mastery: Mastery }

const SPEEDS = [
  { value: 20, label: '文字：慢' },
  { value: 40, label: '文字：标准' },
  { value: 80, label: '文字：快' },
  { value: 0, label: '文字：立即显示' },
]

const INTERVIEWER = { name: GUIDE.name, role: '面试官' }
const GREETING = `我是${GUIDE.name}。先把思路理清楚，再一起看看边界条件和复杂度。`

/**
 * 每一步澜汐的样子：桌面端舞台上的立绘，加上对话框头像的 Q 版动作。
 * 动作跟着步骤走：念题挥一次手、想一想时一直托腮、每段讲解翻一次书、标记「会了」庆祝一次，其余停在静态封面
 */
interface Pose {
  portrait: ArtAsset
  motion: MotionName
  /** 这一步播放动作；不播就是静态封面 */
  play?: boolean
  /** 不传按动作的默认值 */
  loop?: boolean
}

const RESTING: Pose = { portrait: ART.portraitWelcome, motion: 'wave' }

const REACTIONS: Record<Mastery, { line: string; pose: Pose }> = {
  1: { line: '很好！这道题可以放心了。', pose: { portrait: ART.portraitWelcome, motion: 'celebrate', play: true } },
  2: { line: '思路差不多了，过两天再来巩固一下就稳了。', pose: { portrait: ART.portraitThinking, motion: 'thinking' } },
  3: { line: '没关系，把解析再过一遍，明天再来试试。', pose: { portrait: ART.portraitExplain, motion: 'explain' } },
}

/** 文字速度记在本机，下次进来还是这个设置 */
const SETTINGS_KEY = 'offer-hub-vn'

interface VNSettings {
  speed: number
}

function readSettings(): VNSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '') as Partial<VNSettings>
    return { speed: SPEEDS.find((s) => s.value === saved.speed)?.value ?? 40 }
  } catch {
    return { speed: 40 }
  }
}

/**
 * 模拟面试模式（VN）：面试官念题、逐段讲解析，代码和表格展开成全宽面板，最后标记掌握程度。
 * 键盘：空格 / 回车推进，数字键选择，按住 Ctrl 快进，L 回看完整解析，Esc 回到阅读模式。
 * 换题时父组件用 key 重新挂载，流程从头开始
 */
export function InterviewMode({
  question,
  bankId,
  truncated,
  onExit,
}: {
  question: Question
  bankId: string
  /** 游客拿到的解析被截断了 */
  truncated: boolean
  onExit: () => void
}) {
  const navigate = useNavigate()
  const { showLoginDialog, setShowLoginDialog } = useLogin()
  const theme = useTheme()
  const isDesktop = useIsDesktop()
  const { next } = useNeighbors(bankId, question.question_id)
  const segments = useMemo(() => toSegments(question.content), [question.content])

  const [settings, setSettings] = useState(readSettings)
  const [step, setStep] = useState<Step>({ kind: 'question' })
  const [backlogOpen, setBacklogOpen] = useState(false)
  const [fastForward, setFastForward] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      // 写不进去就只在本次打开期间生效
    }
  }, [settings])

  // 讲解和想一想时会换立绘，先在后台下好，换姿势时不闪空白；手机端不放立绘
  useEffect(() => {
    if (isDesktop) preloadArt(ART.portraitExplain, ART.portraitThinking)
  }, [isDesktop])

  const stepKey = step.kind === 'answer' ? `answer-${step.index}` : step.kind === 'reaction' ? `reaction-${step.mastery}` : step.kind
  const typer = useTypewriter<HTMLDivElement>(stepKey, settings.speed)

  const afterAnswers = (): Step => (truncated ? { kind: 'truncated' } : { kind: 'rate' })

  // 停在「先讲到这里」时在弹窗里登录了：详情接口目前对游客也返回完整解析，前面已经讲完，直接进入自评
  useEffect(() => {
    if (!truncated && step.kind === 'truncated') setStep({ kind: 'rate' })
  }, [truncated, step.kind])
  const firstAnswer = (): Step => (segments.length > 0 ? { kind: 'answer', index: 0 } : afterAnswers())
  const nextLabel = next ? '下一题' : '回到题库'

  function goNext() {
    if (next) navigate(questionPath(next.question_id, bankId, 'interview'))
    else navigate(bankId ? bankPath(bankId) : '/questions')
  }

  function rate(mastery: Mastery) {
    setMastery(question.question_id, mastery)
    setStep({ kind: 'reaction', mastery })
  }

  // 当前这一步的台词、姿势、展开面板、选项，以及能不能推进到下一句
  let line: ReactNode
  let pose = RESTING
  let panel: string | undefined
  let choices: Choice[] = []
  let advance: (() => void) | undefined

  switch (step.kind) {
    case 'question':
      pose = { portrait: ART.portraitWelcome, motion: 'wave', play: true }
      line = (
        <>
          <p>{GREETING}</p>
          <p>今天的题目是：「{question.title}」</p>
        </>
      )
      choices = [
        { label: '显示参考答案', onSelect: () => setStep(firstAnswer()) },
        { label: '我先想想', onSelect: () => setStep({ kind: 'think' }) },
        { label: next ? '跳过，下一题' : '回到题库', onSelect: goNext },
      ]
      break
    case 'think':
      pose = { portrait: ART.portraitThinking, motion: 'thinking', play: true }
      line = <p>不着急，慢慢想。想好了就继续，我们对一下参考答案。</p>
      advance = () => setStep(firstAnswer())
      break
    case 'answer': {
      const segment = segments[step.index]
      pose = { portrait: ART.portraitExplain, motion: 'explain', play: true, loop: false }
      line = <Markdown content={segment.text} plain />
      panel = segment.panel
      advance = () =>
        setStep(step.index + 1 < segments.length ? { kind: 'answer', index: step.index + 1 } : afterAnswers())
      break
    }
    case 'truncated':
      line = <p>参考答案先讲到这里。登录之后能看完整解析，掌握进度也会同步到账号。</p>
      choices = [
        { label: '去登录', onSelect: () => setShowLoginDialog(true) },
        { label: nextLabel, onSelect: goNext },
        { label: '回到阅读模式', onSelect: onExit },
      ]
      break
    case 'rate':
      line = <p>讲完了。这道题你掌握得怎么样？</p>
      choices = [
        { label: '会了', onSelect: () => rate(1) },
        { label: '有点模糊', onSelect: () => rate(2) },
        { label: '还不会', onSelect: () => rate(3) },
      ]
      break
    case 'reaction':
      pose = REACTIONS[step.mastery].pose
      line = (
        <>
          <p>{REACTIONS[step.mastery].line}</p>
          <p className="font-sans text-meta font-normal">掌握程度已经记在本机，登录后会同步到账号。</p>
        </>
      )
      choices = [
        { label: nextLabel, onSelect: goNext },
        { label: '再看一遍解析', onSelect: () => setStep(firstAnswer()) },
        { label: '回到阅读模式', onSelect: onExit },
      ]
      break
  }

  // 选项等整句显示完再出现
  const showChoices = typer.done && choices.length > 0
  const handleAdvance = !typer.done ? typer.finish : advance

  // 按住 Ctrl 快进：每 90ms 推进一次，遇到选项自然停下
  const advanceRef = useRef(handleAdvance)
  advanceRef.current = handleAdvance
  useEffect(() => {
    if (!fastForward) return
    const timer = setInterval(() => advanceRef.current?.(), 90)
    return () => clearInterval(timer)
  }, [fastForward])

  useVNKeys(
    {
      onAdvance: () => handleAdvance?.(),
      onChoose: (index) => showChoices && choices[index]?.onSelect(),
      onFastForward: setFastForward,
      onBacklog: () => setBacklogOpen(true),
      onExit,
    },
    // 回看日志或登录弹窗打开时停用，Esc 只关它们，数字键不会点到背后的选项
    !backlogOpen && !showLoginDialog,
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <PanelCaption>模拟面试</PanelCaption>
          <h1 className="truncate font-title text-heading font-semibold">{question.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Select
            value={String(settings.speed)}
            onValueChange={(value) => setSettings({ speed: Number(value) })}
          >
            <SelectTrigger aria-label="文字速度" className="w-auto px-2 sm:min-w-32 sm:px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEEDS.map((speed) => (
                <SelectItem key={speed.value} value={String(speed.value)}>
                  {speed.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* 手机上只留图标，工具栏保持一行 */}
          <Button variant="outline" onClick={() => setBacklogOpen(true)} aria-label="回看" className="px-2.5 sm:px-4">
            <History />
            <span className="hidden sm:inline">回看</span>
          </Button>
          <Button variant="outline" onClick={onExit} aria-label="阅读模式" className="px-2.5 sm:px-4">
            <DocumentText />
            <span className="hidden sm:inline">阅读模式</span>
          </Button>
        </div>
      </div>

      <VNStage
        scene={theme === 'dark' ? ART.sceneNight : ART.sceneDay}
        character={pose.portrait}
        className="h-[calc(100dvh-12.5rem)] min-h-[460px] md:h-[calc(100dvh-14.5rem)] md:min-h-[520px]"
      >
        <div className="flex min-h-0 flex-1 flex-col p-3 md:p-6">
          <div className="flex flex-wrap items-center gap-2 text-meta">
            <span className="bg-background px-2">
              <DifficultyLabel difficulty={question.difficulty} />
            </span>
            {question.tags.map((tag) => (
              <span key={tag} className="bg-dialogue/[0.88] px-2 text-dialogue-foreground">
                {tag}
              </span>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 pt-3">
            {panel && (
              <div
                key={stepKey}
                className="min-h-0 overflow-y-auto border border-foreground bg-background/95 px-4 backdrop-blur-md animate-in fade-in duration-panel md:px-6"
              >
                <Markdown content={panel} />
              </div>
            )}
            {showChoices && isDesktop && <ChoiceList choices={choices} className="w-full max-w-md md:ml-[6%]" />}
          </div>

          <DialogueBox
            speaker={INTERVIEWER}
            avatar={
              <CharacterSprite
                name={pose.motion}
                size={isDesktop ? 96 : 56}
                playKey={stepKey}
                loop={pose.loop}
                still={!pose.play}
              />
            }
            contentRef={typer.ref}
            done={typer.done}
            onAdvance={handleAdvance}
          >
            {line}
          </DialogueBox>

          {showChoices && !isDesktop && <ChoiceList choices={choices} drawer className="-mx-3 -mb-3 mt-3" />}
        </div>
      </VNStage>

      <p className="hidden text-meta text-muted-foreground md:block">
        空格 / 回车 继续 · 数字键选择 · 按住 Ctrl 快进 · L 回看 · Esc 回到阅读模式
      </p>

      <Backlog
        open={backlogOpen}
        onOpenChange={setBacklogOpen}
        subtitle={truncated ? '游客只能看到前 150 字，登录后查看完整解析' : '完整解析 · Esc 关闭'}
      >
        <h2 className="mb-4 font-title text-heading font-semibold">{question.title}</h2>
        <Markdown content={question.content} />
      </Backlog>
    </div>
  )
}
