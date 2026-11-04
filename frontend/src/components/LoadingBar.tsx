/**
 * 不确定时长的加载条：盖在所在容器底边线上的 2px 轨道，一段墨色来回滑动（样式在 index.css 的 .loading-bar）。
 * 容器要有定位（relative / sticky）；挂载 150ms 后才显示，所以按需渲染：{loading && <LoadingBar … />}
 */
export function LoadingBar({ label }: { label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      className="loading-bar pointer-events-none absolute inset-x-0 -bottom-px h-0.5 overflow-hidden"
    />
  )
}
