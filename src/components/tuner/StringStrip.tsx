import type { InstrumentString } from '@/lib/notes'
import { cn } from '@/lib/utils'

type StringStripProps = {
  strings: readonly InstrumentString[]
  activeId: string | null
  inTune: boolean
}

export function StringStrip({ strings, activeId, inTune }: StringStripProps) {
  if (strings.length === 0) return null

  return (
    <div
      className="grid w-full gap-2"
      style={{ gridTemplateColumns: `repeat(${strings.length}, minmax(0, 1fr))` }}
    >
      {strings.map((string) => {
        const active = string.id === activeId
        return (
          <div
            key={string.id}
            className={cn(
              'rounded-2xl border px-2 py-3 text-center transition',
              active && inTune &&
                'border-emerald-400/70 bg-emerald-400/15 text-emerald-200',
              active && !inTune &&
                'border-[#A855F7]/70 bg-[#A855F7]/15 text-white',
              !active && 'border-white/10 bg-white/4 text-slate-400',
            )}
          >
            <div className="text-lg font-bold leading-none">{string.label}</div>
            <div className="mt-1 text-[0.65rem] uppercase tracking-wider text-slate-500">
              {string.stringNo}
              {string.stringNo === 1 ? 'st' : string.stringNo === 2 ? 'nd' : string.stringNo === 3 ? 'rd' : 'th'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
