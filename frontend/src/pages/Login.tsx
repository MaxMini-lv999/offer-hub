import { Navigate, useNavigate } from 'react-router-dom'
import { CharacterSprite } from '@/components/art'
import { AuthForm } from '@/components/auth/AuthForm'
import { DialogueBox } from '@/components/vn/DialogueBox'
import { VNStage } from '@/components/vn/VNStage'
import { ART, GUIDE } from '@/constants/art'
import { AUTH_LINES, AUTH_TITLES, type AuthMode } from '@/constants/auth'
import { useLogin } from '@/hooks/useLogin'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useTypewriter } from '@/hooks/useTypewriter'
import { useTheme } from '@/lib/theme'

/**
 * 登录 / 注册直达页（站内入口都改成了登录弹窗，这里给直接打开链接的人用），表单和弹窗共用 AuthForm，登录后回首页。
 * VN 舞台：澜汐站在左边说一句欢迎，表单放在右侧独立的实色卡片里；手机端舞台只留对话框，头像挥一次手，表单在下面
 */
export function LoginPage({ mode }: { mode: AuthMode }) {
  const theme = useTheme()
  const isDesktop = useIsDesktop()
  const scene = theme === 'dark' ? ART.sceneNight : ART.sceneDay
  const typer = useTypewriter<HTMLDivElement>(mode, 40)
  const navigate = useNavigate()
  const { isLoggedIn } = useLogin()

  // 已经登录（包括刚在这里登录成功）就回首页
  if (isLoggedIn) return <Navigate to="/" replace />

  const dialogue = (
    <DialogueBox
      speaker={GUIDE}
      avatar={isDesktop ? undefined : <CharacterSprite name="wave" size={56} />}
      contentRef={typer.ref}
      done={typer.done}
      onAdvance={typer.done ? undefined : typer.finish}
    >
      <p>{AUTH_LINES[mode]}</p>
    </DialogueBox>
  )

  const card = (
    <div className="w-full space-y-6 border border-foreground bg-background p-6 md:w-[380px]">
      <header className="space-y-1">
        <h1 className="font-title text-title font-semibold">{AUTH_TITLES[mode]}</h1>
        <p className="text-meta text-muted-foreground">登录后可查看完整题解、同步掌握情况</p>
      </header>

      <AuthForm mode={mode} onModeChange={next => navigate(`/${next}`, { replace: true })} />
    </div>
  )

  if (!isDesktop) {
    return (
      <div className="space-y-4">
        <VNStage scene={scene} dim>
          <div className="flex-1 p-3 pt-6">{dialogue}</div>
        </VNStage>
        {card}
      </div>
    )
  }

  return (
    <VNStage
      scene={scene}
      character={ART.portraitWelcome}
      characterSide="left"
      className="h-[calc(100dvh-12rem)] min-h-[600px]"
    >
      <div className="relative flex-1">
        <div className="absolute right-6 top-1/2 -translate-y-1/2">{card}</div>
        <div className="absolute bottom-6 left-6 right-[calc(380px+3rem)]">{dialogue}</div>
      </div>
    </VNStage>
  )
}
