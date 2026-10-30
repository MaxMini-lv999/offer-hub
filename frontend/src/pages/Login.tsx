import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { CharacterSprite } from '@/components/art'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { DialogueBox } from '@/components/vn/DialogueBox'
import { VNStage } from '@/components/vn/VNStage'
import { ART, GUIDE } from '@/constants/art'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useTypewriter } from '@/hooks/useTypewriter'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

type AuthMode = 'login' | 'register'

/** 规则和接口文档一致：用户名不能为空、最长 50 字符，密码至少 6 位；注册多一个确认密码 */
function createSchema(mode: AuthMode) {
  return z
    .object({
      username: z.string().trim().min(1, '请输入用户名').max(50, '用户名最长 50 个字符'),
      password: z.string().min(6, '密码至少 6 位'),
      confirm: z.string(),
    })
    .refine((values) => mode === 'login' || values.password === values.confirm, {
      message: '两次输入的密码不一致',
      path: ['confirm'],
    })
}

type AuthValues = z.infer<ReturnType<typeof createSchema>>

const LINES: Record<AuthMode, string> = {
  login: '欢迎回来！登录之后就能看完整解析，掌握进度也会同步到账号。',
  register: `初次见面，我是${GUIDE.name}，Offer Hub 的引导员。注册一个账号，我们开始吧。`,
}

/**
 * 登录 / 注册页，目前只有界面，认证接口接入后再提交。
 * VN 舞台：澜汐站在左边说一句欢迎，表单放在右侧独立的实色卡片里；手机端舞台只留对话框，头像挥一次手，表单在下面
 */
export function LoginPage({ mode }: { mode: AuthMode }) {
  const theme = useTheme()
  const isDesktop = useIsDesktop()
  const scene = theme === 'dark' ? ART.sceneNight : ART.sceneDay
  const typer = useTypewriter<HTMLDivElement>(mode, 40)

  const dialogue = (
    <DialogueBox
      speaker={GUIDE}
      avatar={isDesktop ? undefined : <CharacterSprite name="wave" size={56} />}
      contentRef={typer.ref}
      done={typer.done}
      onAdvance={typer.done ? undefined : typer.finish}
    >
      <p>{LINES[mode]}</p>
    </DialogueBox>
  )

  const card = (
    <div className="w-full space-y-6 border border-foreground bg-background p-6 md:w-[380px]">
      <header className="space-y-1">
        <h1 className="font-title text-title font-semibold">{mode === 'login' ? '登录 Offer Hub' : '注册 Offer Hub'}</h1>
        <p className="text-meta text-muted-foreground">登录后可查看完整题解、同步掌握情况</p>
      </header>

      <div className="grid grid-cols-2 border-b">
        {(['login', 'register'] as const).map((item) => (
          <Link
            key={item}
            to={`/${item}`}
            replace
            aria-current={item === mode ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 pb-3 text-center font-medium transition-colors',
              item === mode
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground',
            )}
          >
            {item === 'login' ? '登录' : '注册'}
          </Link>
        ))}
      </div>

      {/* 切换登录 / 注册时重置表单 */}
      <AuthForm key={mode} mode={mode} />
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

function AuthForm({ mode }: { mode: AuthMode }) {
  const form = useForm<AuthValues>({
    resolver: zodResolver(createSchema(mode)),
    defaultValues: { username: '', password: '', confirm: '' },
  })

  function onSubmit() {
    form.setError('root', { message: `${mode === 'login' ? '登录' : '注册'}接口还没接入，暂时只能浏览` })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>用户名</FormLabel>
              <FormControl>
                <Input autoComplete="username" placeholder="请输入用户名" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>密码</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="至少 6 位"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {mode === 'register' && (
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>确认密码</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" placeholder="再输入一次密码" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" className="w-full">
          {mode === 'login' ? '登录' : '注册'}
        </Button>

        {form.formState.errors.root && (
          <p role="status" className="text-center text-meta text-muted-foreground">
            {form.formState.errors.root.message}
          </p>
        )}
      </form>
    </Form>
  )
}
