import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { OmnicianWordmark } from '@/components/OmnicianMark'
import { ToolIcon } from '@/components/ToolIcons'
import { Button } from '@/components/ui/button'
import { getTool } from '@/data/tools'

export function ComingSoonPage() {
  const { slug } = useParams()
  const tool = slug ? getTool(slug) : undefined

  if (!tool) {
    return (
      <PlaceholderShell>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
          That page isn&apos;t here
        </h1>
        <p className="mt-3 max-w-md text-base leading-7 text-slate-400">
          Head back home and choose Tuner, Metronome, or Drum Machine.
        </p>
      </PlaceholderShell>
    )
  }

  return (
    <PlaceholderShell>
      <span className="flex size-16 items-center justify-center rounded-2xl bg-[#A855F7]/12 text-[#C084FC] ring-1 ring-[#A855F7]/30">
        <ToolIcon slug={tool.slug} className="size-8" />
      </span>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-[#C084FC]">
        Coming in V1
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
        {tool.name}
      </h1>
      <p className="mt-4 max-w-md text-base leading-7 text-slate-400">
        {tool.coming}
      </p>
    </PlaceholderShell>
  )
}

function PlaceholderShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
      <div className="stage-glow" aria-hidden />
      <header className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/">
            <ArrowLeft className="size-4" />
            Home
          </Link>
        </Button>
        <OmnicianWordmark className="text-xl sm:text-2xl" />
        <span className="w-[4.5rem]" aria-hidden />
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-2 pb-16 text-center">
        {children}
      </main>
    </div>
  )
}
