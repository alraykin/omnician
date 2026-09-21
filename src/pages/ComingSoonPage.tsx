import { useParams } from 'react-router-dom'

import { AppChrome } from '@/components/AppChrome'
import { ToolIcon } from '@/components/ToolIcons'
import { getTool } from '@/data/tools'

export function ComingSoonPage() {
  const { slug } = useParams()
  const tool = slug ? getTool(slug) : undefined

  if (!tool) {
    return (
      <AppChrome>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
          That page isn&apos;t here
        </h1>
        <p className="mt-3 max-w-md text-base leading-7 text-slate-400">
          Head back home and choose Tuner or Rhythm.
        </p>
      </AppChrome>
    )
  }

  return (
    <AppChrome>
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
    </AppChrome>
  )
}
