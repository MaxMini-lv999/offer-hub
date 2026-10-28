import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
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

/** 登录 / 注册页，目前只有界面，认证接口接入后再提交 */
export function LoginPage({ mode }: { mode: AuthMode }) {
  return (
    <div className="flex justify-center py-12">
      <div className="w-[360px] max-w-full space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-title font-semibold">{mode === 'login' ? '登录 Offer Hub' : '注册 Offer Hub'}</h1>
          <p className="text-meta text-muted-foreground">登录后可查看完整题解、标记掌握情况</p>
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
    </div>
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
