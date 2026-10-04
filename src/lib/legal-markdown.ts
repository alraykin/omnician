export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] }

export type BlockNode =
  | { type: 'h1' | 'h2' | 'h3'; text: string; id: string; children: InlineNode[] }
  | { type: 'p'; lines: InlineNode[][] }
  | { type: 'ul' | 'ol'; items: InlineNode[][] }
  | { type: 'hr' }
  | { type: 'table'; headers: InlineNode[][]; rows: InlineNode[][][] }

const SUPPORT_EMAIL = 'support@omnician.app'
const AUTO_LINK_RE = /(https?:\/\/[^\s<]+|support@omnician\.app)/gi
const TRAILING_URL_PUNCT_RE = /[),.;:!?]+$/

export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[-\s]+/g, '-')
}

export function uniqueHeadingId(text: string, used: Map<string, number>): string {
  const base = headingSlug(text)
  const count = used.get(base) ?? 0
  used.set(base, count + 1)
  return count === 0 ? base : `${base}-${count}`
}

export function classifyLegalHref(href: string): 'internal' | 'hash' | 'mailto' | 'external' {
  if (href.startsWith('mailto:')) return 'mailto'
  if (href.startsWith('#')) return 'hash'
  if (href.startsWith('/') && !href.startsWith('//')) return 'internal'
  return 'external'
}

export function parseInline(input: string): InlineNode[] {
  const out: InlineNode[] = []
  let i = 0
  let buf = ''

  const flush = () => {
    if (buf) {
      out.push(...autoLinkText(buf))
      buf = ''
    }
  }

  while (i < input.length) {
    if (input[i] === '[') {
      const link = matchMarkdownLink(input, i)
      if (link) {
        flush()
        out.push({ type: 'link', href: link.href, children: parseInline(link.text) })
        i = link.end
        continue
      }
    }
    if (input.startsWith('**', i)) {
      const end = input.indexOf('**', i + 2)
      if (end !== -1) {
        flush()
        out.push({ type: 'strong', children: parseInline(input.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }
    buf += input[i]
    i += 1
  }
  flush()
  return out
}

function matchMarkdownLink(input: string, start: number): { text: string; href: string; end: number } | null {
  if (input[start] !== '[') return null
  const closeText = input.indexOf(']', start + 1)
  if (closeText === -1 || input[closeText + 1] !== '(') return null
  const closeHref = input.indexOf(')', closeText + 2)
  if (closeHref === -1) return null
  return {
    text: input.slice(start + 1, closeText),
    href: input.slice(closeText + 2, closeHref),
    end: closeHref + 1,
  }
}

function autoLinkText(text: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let last = 0
  const re = new RegExp(AUTO_LINK_RE.source, AUTO_LINK_RE.flags)
  for (const match of text.matchAll(re)) {
    const raw = match[0]
    const index = match.index ?? 0
    if (index > last) nodes.push({ type: 'text', value: text.slice(last, index) })
    const trimmed = raw.replace(TRAILING_URL_PUNCT_RE, '')
    const trailing = raw.slice(trimmed.length)
    const href = trimmed.toLowerCase() === SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}` : trimmed
    nodes.push({ type: 'link', href, children: [{ type: 'text', value: trimmed }] })
    if (trailing) nodes.push({ type: 'text', value: trailing })
    last = index + raw.length
  }
  if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) })
  return nodes
}

function isBlank(line: string): boolean {
  return line.trim() === ''
}

function isHr(line: string): boolean {
  return /^---+$/.test(line.trim())
}

function headingMatch(line: string): { level: 1 | 2 | 3; text: string } | null {
  const match = /^(#{1,3})\s+(.+)$/.exec(line)
  if (!match) return null
  return { level: match[1].length as 1 | 2 | 3, text: match[2].trim() }
}

function isUl(line: string): boolean {
  return /^[-*]\s+/.test(line)
}

function isOl(line: string): boolean {
  return /^\d+\.\s+/.test(line)
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('|') && trimmed.includes('|', 1)
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim())
}

function isTableStart(lines: string[], index: number): boolean {
  return isTableRow(lines[index] ?? '') && isTableSeparator(lines[index + 1] ?? '')
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? ''
  return (
    isHr(line) ||
    headingMatch(line) !== null ||
    isUl(line) ||
    isOl(line) ||
    isTableStart(lines, index)
  )
}

function splitTableCells(line: string): string[] {
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1)
  return trimmed.split('|').map((cell) => cell.trim())
}

export function parseLegalMarkdown(markdown: string): BlockNode[] {
  const lines = markdown.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n')
  const blocks: BlockNode[] = []
  const usedIds = new Map<string, number>()
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (isBlank(line)) {
      i += 1
      continue
    }
    if (isHr(line)) {
      blocks.push({ type: 'hr' })
      i += 1
      continue
    }
    const heading = headingMatch(line)
    if (heading) {
      const type = heading.level === 1 ? 'h1' : heading.level === 2 ? 'h2' : 'h3'
      blocks.push({
        type,
        text: heading.text,
        id: uniqueHeadingId(heading.text, usedIds),
        children: parseInline(heading.text),
      })
      i += 1
      continue
    }
    if (isUl(line)) {
      const items: InlineNode[][] = []
      while (i < lines.length && isUl(lines[i] ?? '')) {
        items.push(parseInline((lines[i] ?? '').replace(/^[-*]\s+/, '')))
        i += 1
      }
      blocks.push({ type: 'ul', items })
      continue
    }
    if (isOl(line)) {
      const items: InlineNode[][] = []
      while (i < lines.length && isOl(lines[i] ?? '')) {
        items.push(parseInline((lines[i] ?? '').replace(/^\d+\.\s+/, '')))
        i += 1
      }
      blocks.push({ type: 'ol', items })
      continue
    }
    if (isTableStart(lines, i)) {
      const headers = splitTableCells(lines[i] ?? '').map(parseInline)
      i += 2
      const rows: InlineNode[][][] = []
      while (i < lines.length && isTableRow(lines[i] ?? '') && !isTableSeparator(lines[i] ?? '')) {
        rows.push(splitTableCells(lines[i] ?? '').map(parseInline))
        i += 1
      }
      blocks.push({ type: 'table', headers, rows })
      continue
    }
    const para: string[] = []
    while (i < lines.length && !isBlank(lines[i] ?? '') && !isBlockStart(lines, i)) {
      para.push(lines[i] ?? '')
      i += 1
    }
    if (para.length) blocks.push({ type: 'p', lines: para.map(parseInline) })
  }

  return blocks
}

export function groupLegalCards(blocks: BlockNode[]): BlockNode[][] {
  const cards: BlockNode[][] = []
  let current: BlockNode[] = []
  for (const block of blocks) {
    if (block.type === 'h2' && current.length) {
      cards.push(current)
      current = [block]
    } else {
      current.push(block)
    }
  }
  if (current.length) cards.push(current)
  return cards
}

export function headingIds(blocks: BlockNode[]): string[] {
  return blocks.filter((block): block is Extract<BlockNode, { id: string }> => 'id' in block).map((block) => block.id)
}

const HIDDEN_NOTE_RE = /\b(DRAFT|TODO|lawyer-review|internal notes?)\b|\{\{[^}]+\}\}/i

export function hasHiddenLegalNotes(markdown: string): boolean {
  return HIDDEN_NOTE_RE.test(markdown)
}
