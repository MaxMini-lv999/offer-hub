/**
 * 浏览数缩写：≥ 1 万显示 x.xw，≥ 1000 显示 x.xk，否则原样。
 * 小数位向下取整，不把 9999 进位成 10.0k，也不会多报
 */
export function formatViewCount(count: number) {
  if (count >= 10000) return `${(Math.floor(count / 1000) / 10).toFixed(1)}w`
  if (count >= 1000) return `${(Math.floor(count / 100) / 10).toFixed(1)}k`
  return String(count)
}
