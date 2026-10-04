import { useLayoutEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import {
  classifyLegalHref,
  groupLegalCards,
  parseLegalMarkdown,
  type BlockNode,
  type InlineNode,
} from '@/lib/legal-markdown'
import { cn } from '@/lib/utils'

function renderInline(nodes: InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`
    if (node.type === 'text') return <span key={key}>{node.value}</span>
    if (node.type === 'strong') {
      return (
        <strong key={key} className="font-semibold text-white">
          {renderInline(node.children, key)}
        </strong>
      )
    }
    const kind = classifyLegalHref(node.href)
    const children = renderInline(node.children, key)
    const className = 'break-words text-[#A855F7] underline-offset-2 hover:underline'
    if (kind === 'internal') {
      return (
        <Link key={key} to={node.href} className={className}>
          {children}
        </Link>
      )
    }
    return (
      <a
        key={key}
        href={node.href}
        className={className}
        {...(kind === 'external' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    )
  })
}

function renderLines(lines: InlineNode[][], keyPrefix: string): ReactNode {
  return lines.map((line, index) => (
    <span key={`${keyPrefix}-line-${index}`}>
      {index > 0 ? <br /> : null}
      {renderInline(line, `${keyPrefix}-${index}`)}
    </span>
  ))
}

function BlockView({ block, index }: { block: BlockNode; index: number }) {
  if (block.type === 'h1') {
    return (
      <h1 id={block.id} className="scroll-mt-4 text-[1.65rem] font-bold leading-tight tracking-tight text-white">
        {renderInline(block.children, `h1-${index}`)}
      </h1>
    )
  }
  if (block.type === 'h2') {
    return (
      <h2 id={block.id} className="scroll-mt-4 text-lg font-bold leading-snug tracking-tight text-white">
        {renderInline(block.children, `h2-${index}`)}
      </h2>
    )
  }
  if (block.type === 'h3') {
    return (
      <h3 id={block.id} className="scroll-mt-4 text-base font-semibold leading-snug text-white">
        {renderInline(block.children, `h3-${index}`)}
      </h3>
    )
  }
  if (block.type === 'p') {
    return <p className="text-[15px] leading-7 text-slate-300">{renderLines(block.lines, `p-${index}`)}</p>
  }
  if (block.type === 'ul' || block.type === 'ol') {
    const Tag = block.type
    return (
      <Tag
        className={cn(
          'space-y-2.5 text-[15px] leading-7 text-slate-300',
          block.type === 'ul' ? 'list-disc pl-5' : 'list-decimal pl-5',
        )}
      >
        {block.items.map((item, itemIndex) => (
          <li key={`${block.type}-${index}-${itemIndex}`} className="pl-0.5">
            {renderInline(item, `${block.type}-${index}-${itemIndex}`)}
          </li>
        ))}
      </Tag>
    )
  }
  if (block.type === 'hr') {
    return <hr className="border-white/10" />
  }
  if (block.type !== 'table') return null
  return (
    <div className="-mx-1 overflow-x-auto pb-1" data-legal-table>
      <table className="w-max min-w-full border-collapse text-left text-[13px] leading-5 text-slate-300">
        <thead>
          <tr>
            {block.headers.map((cell, cellIndex) => (
              <th
                key={`th-${index}-${cellIndex}`}
                className="border border-white/10 bg-white/5 px-2.5 py-2 font-semibold text-white"
              >
                {renderInline(cell, `th-${index}-${cellIndex}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={`tr-${index}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`td-${index}-${rowIndex}-${cellIndex}`} className="border border-white/10 px-2.5 py-2 align-top">
                  {renderInline(cell, `td-${index}-${rowIndex}-${cellIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LegalDoc({ markdown }: { markdown: string }) {
  const location = useLocation()
  const blocks = parseLegalMarkdown(markdown)
  const cards = groupLegalCards(blocks)

  useLayoutEffect(() => {
    const id = decodeURIComponent(location.hash.replace(/^#/, ''))
    if (!id) return
    const scroll = () => document.getElementById(id)?.scrollIntoView({ block: 'start' })
    scroll()
    const frame = requestAnimationFrame(scroll)
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, location.hash, markdown])

  return (
    <article className="space-y-4 break-words" data-legal-doc>
      {cards.map((card, cardIndex) => (
        <section
          key={`card-${cardIndex}`}
          className="space-y-3.5 rounded-2xl border border-white/10 bg-[#141A28]/80 px-4 py-5"
        >
          {card.map((block, blockIndex) => (
            <BlockView key={`${cardIndex}-${blockIndex}`} block={block} index={blockIndex} />
          ))}
        </section>
      ))}
    </article>
  )
}
