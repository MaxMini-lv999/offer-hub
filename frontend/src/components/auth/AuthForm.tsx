import { zodResolver } from '@hookform/resolvers/zod'
import { forwardRef, useId, useRef, useState, type ComponentProps, type FormEvent, type KeyboardEvent } from 'react'
import { useForm } from 'react-hook-form'
import IconEye from '~icons/solar/eye-linear'
import IconEyeClosed from '~icons/solar/eye-closed-linear'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import type { AuthMode } from '@/constants/auth'
import { useLogin } from '@/hooks/useLogin'
import { ApiError } from '@/lib/request'
import { cn } from '@/lib/utils'
import { postAuthLogin, postAuthRegister } from '@/services/auth'

const MODES: AuthMode[] = ['login', 'register']
const MODE_LABELS: Record<AuthMode, string> = { login: '登录', register: '注册' }

/** bcrypt 只接受最多 72 字节的密码，后端超过就拒绝；汉字一个占 3 字节 */
const PASSWORD_MAX_BYTES = 72
const encoder = new TextEncoder()

/** 规则和接口文档一致：用户名不能为空、最长 50 字符，密码 6 位到 72 字节；注册多一个确认密码 */
function createSchema(mode: AuthMode) {
  return z
    .object({
      username: z.string().trim().min(1, '请输入用户名').max(50, '用户名最长 50 个字符'),
      password: z
        .string()
        .min(6, '密码至少 6 位')
        .refine((value) => encoder.encode(value).length <= PASSWORD_MAX_BYTES, '密码太长了，最多 72 个英文字符'),
      confirm: z.string(),
    })
    .refine((values) => mode === 'login' || values.password === values.confirm, {
      message: '两次输入的密码不一致',
      path: ['confirm'],
    })
}

type AuthValues = z.infer<ReturnType<typeof createSchema>>

/**
 * 登录 / 注册表单，上面是两个页签，登录页和登录弹窗共用。
 * 页签是受控的：页面切换时改 URL，弹窗切换时改自己的 state。成功后已经调过 useLogin().login，onSuccess 只管关弹窗或跳页面
 */
export function AuthForm({
  mode,
  onModeChange,
  onSuccess,
  autoFocus = false,
}: {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onSuccess?: () => void
  /** 挂载时聚焦用户名（弹窗用）；切过页签后不再聚焦，键盘切页签时焦点留在页签上 */
  autoFocus?: boolean
}) {
  const baseId = useId()
  const tabRefs = useRef<Partial<Record<AuthMode, HTMLButtonElement | null>>>({})
  const [switched, setSwitched] = useState(false)

  function select(next: AuthMode) {
    if (next === mode) return
    setSwitched(true)
    onModeChange(next)
  }

  // 方向键在两个页签间切换，Home / End 跳到第一个 / 最后一个，切过去就选中
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const index = MODES.indexOf(mode)
    let next: number
    if (e.key === 'ArrowLeft') next = (index - 1 + MODES.length) % MODES.length
    else if (e.key === 'ArrowRight') next = (index + 1) % MODES.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = MODES.length - 1
    else return
    e.preventDefault()
    select(MODES[next])
    tabRefs.current[MODES[next]]?.focus()
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="登录或注册" className="grid grid-cols-2 border-b">
        {MODES.map((item) => {
          const selected = item === mode
          return (
            <button
              key={item}
              ref={(el) => {
                tabRefs.current[item] = el
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item)}
              onKeyDown={onTabKeyDown}
              className={cn(
                '-mb-px border-b-2 pb-3 pt-2 text-center font-medium transition-colors duration-micro ease-standard',
                selected
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground',
              )}
            >
              {MODE_LABELS[item]}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${mode}`}>
        {/* 切换登录 / 注册时重置表单 */}
        <ModeForm key={mode} mode={mode} autoFocus={autoFocus && !switched} onSuccess={onSuccess} />
      </div>
    </div>
  )
}

function ModeForm({ mode, autoFocus, onSuccess }: { mode: AuthMode; autoFocus: boolean; onSuccess?: () => void }) {
  const { login } = useLogin()
  const form = useForm<AuthValues>({
    resolver: zodResolver(createSchema(mode)),
    defaultValues: { username: '', password: '', confirm: '' },
  })
  const { isSubmitting, submitCount, errors } = form.formState

  async function submit({ username, password }: AuthValues) {
    let registered = false
    try {
      if (mode === 'register') {
        await postAuthRegister(username, password)
        registered = true
      }
      // 注册成功后直接用同一组账号密码登录，不用再输一遍
      const { token, userInfo } = await postAuthLogin(username, password)
      login(userInfo, token)
      onSuccess?.()
    } catch (err) {
      const reason = err instanceof ApiError ? err.message : '出了点问题，请稍后再试'
      if (registered) {
        form.setError('root', { message: `注册成功，但自动登录失败：${reason}。请切到「登录」再试一次` })
        return
      }
      form.setError('root', { message: reason })
      // 用户名或密码错误：清空密码让用户重输
      if (mode === 'login' && err instanceof ApiError && err.code === 400) {
        form.resetField('password')
        form.setFocus('password')
      }
    }
  }

  // 请求中按钮只是 aria-disabled：真禁用会让按下回车时的焦点丢到 body 上；重复提交在这里拦掉
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (isSubmitting) {
      e.preventDefault()
      return
    }
    void form.handleSubmit(submit)(e)
  }

  const action = MODE_LABELS[mode]

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate aria-busy={isSubmitting}>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>用户名</FormLabel>
              <FormControl>
                <Input
                  autoFocus={autoFocus}
                  autoComplete="username"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="请输入用户名"
                  {...field}
                />
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
                <PasswordInput
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
                  <PasswordInput autoComplete="new-password" placeholder="再输入一次密码" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button
          type="submit"
          aria-disabled={isSubmitting}
          className="w-full aria-disabled:cursor-progress aria-disabled:opacity-70"
        >
          {isSubmitting ? `${action}中…` : mode === 'register' ? '注册并登录' : action}
        </Button>

        {/* 接口报错不用红色，墨色竖线 + 抖一下；每次提交失败换 key 重播 */}
        {errors.root && (
          <p key={submitCount} role="alert" className="ohm-retry border-l-2 border-foreground pl-3 text-meta">
            {errors.root.message}
          </p>
        )}
      </form>
    </Form>
  )
}

/** 密码框，右侧按钮切换明文显示；FormControl 传进来的 id、aria-* 都落在 input 上 */
const PasswordInput = forwardRef<HTMLInputElement, Omit<ComponentProps<'input'>, 'type'>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label="显示密码"
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors duration-micro ease-standard hover:text-foreground"
        >
          {visible ? <IconEyeClosed className="size-4" /> : <IconEye className="size-4" />}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'
