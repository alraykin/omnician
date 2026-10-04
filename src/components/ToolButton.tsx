import { Link } from 'react-router-dom'

import { ToolIcon } from '@/components/ToolIcons'
import { TunerLink } from '@/components/TunerLink'
import { primeRhythmKit } from '@/lib/rhythm-audio'

export type HomeToolId = 'tuner' | 'click' | 'drums'

export type HomeTool = {
  id: HomeToolId
  name: string
  blurb: string
  to: string
}

export const HOME_TOOLS: readonly HomeTool[] = [
  {
    id: 'tuner',
    name: 'Tuner',
    blurb: 'Match your pitch before you play.',
    to: '/tuner',
  },
  {
    id: 'click',
    name: 'Click',
    blurb: 'A metronome you can lock into.',
    to: '/rhythm?mode=click',
  },
  {
    id: 'drums',
    name: 'Drums',
    blurb: 'Play a groove at your tempo.',
    to: '/rhythm?mode=drums',
  },
]

const cardClass =
  'group relative flex min-h-[5.75rem] w-full items-center gap-4 overflow-hidden rounded-3xl border border-white/10 bg-[#141A28]/90 px-5 py-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)] transition duration-200 hover:-translate-y-0.5 hover:border-[#A855F7]/55 hover:bg-[#1A2033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F1A] sm:min-h-[10rem] sm:flex-col sm:items-start sm:justify-between sm:px-6 sm:py-6'

export function ToolButton({ tool }: { tool: HomeTool }) {
  const body = (
    <>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#A855F7]/50 to-transparent opacity-0 transition group-hover:opacity-100" />
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#A855F7]/12 text-[#C084FC] ring-1 ring-[#A855F7]/25 transition group-hover:bg-[#A855F7]/20 group-hover:text-white">
        <ToolIcon slug={tool.id} className="size-7" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-xl font-bold tracking-tight text-white sm:text-2xl">
          {tool.name}
        </span>
        <span className="mt-1 block text-sm leading-6 text-slate-400 sm:text-[0.95rem]">
          {tool.blurb}
        </span>
      </span>
    </>
  )

  if (tool.id === 'tuner') {
    return (
      <TunerLink className={cardClass} data-home-tool={tool.id}>
        {body}
      </TunerLink>
    )
  }

  return (
    <Link
      to={tool.to}
      data-home-tool={tool.id}
      onPointerDown={() => primeRhythmKit()}
      className={cardClass}
    >
      {body}
    </Link>
  )
}
