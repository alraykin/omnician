import { Link } from 'react-router-dom'

import { ToolIcon } from '@/components/ToolIcons'
import type { PracticeTool } from '@/data/tools'
import { primeTuner } from '@/lib/tuner-session'

function primeIfNeeded(slug: PracticeTool['slug']) {
  if (slug === 'tuner') primeTuner()
}

export function ToolButton({ tool }: { tool: PracticeTool }) {
  return (
    <Link
      to={`/${tool.slug}`}
      onPointerDown={() => primeIfNeeded(tool.slug)}
      onClick={() => primeIfNeeded(tool.slug)}
      className="group relative flex min-h-[7.5rem] items-center gap-4 overflow-hidden rounded-3xl border border-white/10 bg-[#141A28]/90 px-5 py-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)] transition duration-200 hover:-translate-y-0.5 hover:border-[#A855F7]/55 hover:bg-[#1A2033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F1A] sm:min-h-[10.5rem] sm:flex-col sm:items-start sm:justify-between sm:px-6 sm:py-6"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#A855F7]/50 to-transparent opacity-0 transition group-hover:opacity-100" />
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#A855F7]/12 text-[#C084FC] ring-1 ring-[#A855F7]/25 transition group-hover:bg-[#A855F7]/20 group-hover:text-white">
        <ToolIcon slug={tool.slug} className="size-7" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-xl font-bold tracking-tight text-white sm:text-2xl">
          {tool.name}
        </span>
        <span className="mt-1 block text-sm leading-6 text-slate-400 sm:text-[0.95rem]">
          {tool.blurb}
        </span>
      </span>
    </Link>
  )
}
