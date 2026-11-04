import { CharacterSprite } from '@/components/art'
import { Button } from '@/components/ui/button'
import { useLogin } from '@/hooks/useLogin'

/**
 * 游客看到的正文被后端截断时，叠在正文底部的渐隐遮罩 + 登录入口，题目详情和沉浸刷题共用。
 * 遮罩高 200px、绝对定位：父元素要 relative 并留出 pb-[120px] 给按钮那一行，
 * 渐变在上面 80px 内从透明变到背景色，只盖住正文最后约 3 行，不然游客能看的 150 字会被淡掉一大半。
 * 按钮旁边是澜汐挥手的静态封面（垫纸白，暗色下才看得清），整层不接收点击，只有按钮能点
 */
export function GuestFade() {
  const { setShowLoginDialog } = useLogin()

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[200px] max-h-full items-end justify-center bg-gradient-to-b from-background/0 to-background to-40% pb-10">
      <div className="flex items-center gap-3">
        <span className="flex shrink-0 bg-dialogue-foreground">
          <CharacterSprite name="wave" size={56} still />
        </span>
        <Button className="pointer-events-auto" onClick={() => setShowLoginDialog(true)}>
          登录后查看完整内容
        </Button>
      </div>
    </div>
  )
}
