/** 模拟面试里的一句台词：text 显示在对话框里，panel 是同一步展开的全宽面板（代码块或表格） */
export interface Segment {
  text: string
  panel?: string
}

type Block = { kind: 'text' | 'heading' | 'code' | 'table'; source: string }

/** 按空行把 Markdown 切成块；代码块里的空行不算分隔 */
function splitBlocks(markdown: string): Block[] {
  const blocks: Block[] = []
  let lines: string[] = []
  let fence: string | null = null

  const flush = () => {
    const source = lines.join('\n').trim()
    lines = []
    if (!source) return
    if (/^(```|~~~)/.test(source)) blocks.push({ kind: 'code', source })
    else if (/^#{1,6}\s/.test(source) && !source.includes('\n')) blocks.push({ kind: 'heading', source })
    else if (/^\|.*\|\s*\n\|?\s*:?-{3,}/.test(source)) blocks.push({ kind: 'table', source })
    else blocks.push({ kind: 'text', source })
  }

  for (const line of markdown.split('\n')) {
    const marker = /^\s*(```|~~~)/.exec(line)?.[1]
    if (fence) {
      lines.push(line)
      if (marker === fence) {
        fence = null
        flush()
      }
    } else if (marker) {
      flush()
      fence = marker
      lines.push(line)
    } else if (line.trim() === '') {
      flush()
    } else {
      lines.push(line)
    }
  }
  flush()
  return blocks
}

/**
 * 把题目解析切成逐段推进的台词。
 * 标题并进它后面那段；代码块和表格不放进对话框，挂在前一句台词上展开成全宽面板，前面没有台词时补一句引导语
 */
export function toSegments(markdown: string): Segment[] {
  const segments: Segment[] = []
  let pendingHeading = ''

  for (const block of splitBlocks(markdown)) {
    if (block.kind === 'heading') {
      pendingHeading = pendingHeading ? `${pendingHeading}\n\n${block.source}` : block.source
      continue
    }
    if (block.kind === 'code' || block.kind === 'table') {
      const last = segments[segments.length - 1]
      if (last && !last.panel && !pendingHeading) {
        last.panel = block.source
      } else {
        const lead = block.kind === 'code' ? '来看这段代码。' : '整理成表格对比一下。'
        segments.push({ text: pendingHeading ? `${pendingHeading}\n\n${lead}` : lead, panel: block.source })
        pendingHeading = ''
      }
      continue
    }
    segments.push({ text: pendingHeading ? `${pendingHeading}\n\n${block.source}` : block.source })
    pendingHeading = ''
  }
  if (pendingHeading) segments.push({ text: pendingHeading })
  return segments
}
