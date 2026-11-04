import { CharacterSprite } from '@/components/art'
import { ChoiceList, type Choice } from '@/components/vn/ChoiceList'
import { DialogueBox } from '@/components/vn/DialogueBox'
import { VNStage } from '@/components/vn/VNStage'
import { ART, GUIDE, MOTIONS, type MotionName } from '@/constants/art'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useTypewriter } from '@/hooks/useTypewriter'
import { useVNKeys } from '@/hooks/useVNKeys'
import { useTheme } from '@/lib/theme'

/**
 * 404 和出错页的 VN 舞台：书房场景 + 澜汐的 Q 版（静态封面，出错页不放循环动画）+ 一句台词 + 选项。
 * 错误码、标题和按钮都是 HTML；选项一开始就能点，数字键也能选，不用等台词显示完
 */
export function StageNotice({
  code,
  title,
  pose,
  line,
  detail,
  choices,
}: {
  code: string
  title: string
  /** 澜汐的姿势：404 托腮想、出错页拿扳手修 */
  pose: MotionName
  line: string
  /** 台词下面的小字，比如具体的错误信息 */
  detail?: string
  choices: Choice[]
}) {
  const theme = useTheme()
  const isDesktop = useIsDesktop()
  const typer = useTypewriter<HTMLDivElement>(line, 40)

  useVNKeys({
    onAdvance: typer.done ? undefined : typer.finish,
    onChoose: index => choices[index]?.onSelect(),
  })

  return (
    <VNStage
      scene={theme === 'dark' ? ART.sceneNight : ART.sceneDay}
      dim={theme === 'dark'}
      className="min-h-[calc(100dvh-10rem)] md:h-[calc(100dvh-12rem)] md:min-h-[520px]"
    >
      <div className="flex min-h-0 flex-1 flex-col p-3 md:p-6">
        <div className="flex flex-col items-start gap-2">
          <p
            aria-hidden
            className="bg-background px-3 py-1 font-title text-title font-semibold md:text-display"
          >
            {code}
          </p>
          <h1 className="bg-dialogue/[0.88] px-3 py-1 text-heading font-semibold text-dialogue-foreground">
            {title}
          </h1>
        </div>

        <div className="flex min-h-0 flex-1 items-end justify-between gap-4 pt-3">
          {isDesktop && <ChoiceList choices={choices} className="w-full max-w-sm" />}
          <CharacterSprite
            name={pose}
            size={isDesktop ? 200 : 112}
            still
            label={`${MOTIONS[pose].label}的${GUIDE.name}`}
            className="ml-auto"
          />
        </div>

        <DialogueBox
          speaker={GUIDE}
          contentRef={typer.ref}
          done={typer.done}
          onAdvance={typer.done ? undefined : typer.finish}
        >
          <p>{line}</p>
          {detail && <p className="break-words font-sans text-meta font-normal">{detail}</p>}
        </DialogueBox>

        {!isDesktop && <ChoiceList choices={choices} drawer className="-mx-3 -mb-3 mt-3" />}
      </div>
    </VNStage>
  )
}
