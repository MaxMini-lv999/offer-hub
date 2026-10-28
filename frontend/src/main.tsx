import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
// 只引入用到的字重：等宽 400 给代码，宋体 600 给标题和 VN 台词，都是 font-display: swap
import '@fontsource/jetbrains-mono/400.css'
import './index.css'

// 宋体的 @font-face 有 101 个分片、约 100KB，异步加载不阻塞首屏；标题先用系统宋体，字体到了再换
void import('@fontsource/noto-serif-sc/600.css')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
