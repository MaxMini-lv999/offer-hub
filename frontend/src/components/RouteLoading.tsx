import { MotionVector } from '@/components/art'

/** 按需加载的页面下载代码时的占位：翻书动画，300ms 后才淡入，网速快时不会一闪而过 */
export function RouteLoading() {
  return (
    <div
      role="status"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 animate-in fade-in fill-mode-both delay-300 duration-panel"
    >
      <MotionVector name="book" size={64} />
      <p className="text-meta text-muted-foreground">正在整理知识……</p>
    </div>
  )
}
