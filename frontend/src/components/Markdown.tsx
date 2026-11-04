import { isValidElement, useEffect, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import IconCheck from '~icons/solar/check-linear'
import IconCopy from '~icons/solar/copy-linear'
import { cn } from '@/lib/utils'

/** 代码块：方角、muted 底色，右上角是语言名和复制按钮，长代码横向滚动 */
function CodeBlock({ children }: { children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  // rehype-highlight 会在 <code> 上加 language-xxx 的 class
  const codeClass = isValidElement<{ className?: string }>(children)
    ? (children.props.className ?? '')
    : ''
  const language = /language-([\w+#-]+)/.exec(codeClass)?.[1]

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  function copy() {
    navigator.clipboard
      .writeText(preRef.current?.textContent ?? '')
      .then(() => setCopied(true))
      .catch(() => {
        // 非安全上下文（如用局域网 IP 访问）没有剪贴板权限，静默失败
      })
  }

  return (
    <div className="not-prose my-6 border bg-muted">
      <div className="flex items-center justify-end gap-3 border-b px-4 py-1 text-meta text-muted-foreground">
        {language && <span>{language}</span>}
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 decoration-2 underline-offset-4 hover:text-foreground hover:underline"
        >
          {copied ? <IconCheck className="size-3.5" /> : <IconCopy className="size-3.5" />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      {/* highlight.js 主题给 code 加了白底、内边距和横向滚动，统一交给 pre：底色用容器的 muted，长代码由 pre 横向滚动 */}
      <pre
        ref={preRef}
        className="overflow-x-auto p-4 font-mono text-meta leading-[1.7] text-foreground [&_code.hljs]:overflow-visible [&_code.hljs]:bg-transparent [&_code.hljs]:p-0"
      >
        {children}
      </pre>
    </div>
  )
}

/** 外链在新标签页打开，站内链接保持原样 */
function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  const external = !!href && /^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)
  return (
    <a href={href} {...(external && { target: '_blank', rel: 'noopener noreferrer' })}>
      {children}
    </a>
  )
}

// 只取需要的 props：react-markdown 还会传一个 node，直接透传给 DOM 元素 React 会报警告
const components: Components = {
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  table: ({ children }) => (
    // 宽表格在容器内横向滚动，不撑破页面
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }) => <MarkdownLink href={href}>{children}</MarkdownLink>,
}

/**
 * 题目正文。react-markdown 默认不渲染原始 HTML，内容里的 <script> 等标签会被当成文本，没有 XSS 风险。
 * 正文最大宽度约 72 个字符；代码高亮配色在 index.css，跟随亮暗主题。
 * plain 时不套文章排版，字体颜色都继承外层，给 VN 对话框里的台词用
 */
export function Markdown({
  content,
  plain = false,
  className,
}: {
  content: string
  plain?: boolean
  className?: string
}) {
  if (plain) {
    return (
      <div className={className}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </ReactMarkdown>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'prose max-w-[72ch] text-body',
        'prose-headings:font-title prose-headings:font-semibold prose-a:underline-offset-4',
        'prose-code:bg-muted prose-code:px-1 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none',
        'prose-table:border prose-th:whitespace-nowrap prose-th:border prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-td:border prose-td:px-3 prose-td:py-2',
        'prose-img:rounded-none',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
