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
    <div className="flex flex-wrap justify-center gap-1.5">
      {strings.map((string) => {
        const active = string.id === activeId
        return (
          <div
            key={string.id}
            className={cn(
              'min-w-[3.4rem] flex-1 basis-[3.4rem] rounded-2xl border px-1.5 py-2.5 text-center transition sm:min-w-[3.8rem]',
              active &&
                inTune &&
                'border-emerald-400/70 bg-emerald-400/15 text-emerald-200',
              active &&
                !inTune &&
                'border-[#A855F7]/70 bg-[#A855F7]/15 text-white',
              !active && 'border-white/10 bg-white/4 text-slate-400',
            )}
          >
            <div className="text-base font-bold leading-none sm:text-lg">
              {string.label}
              <span className="ml-0.5 align-super text-[0.65rem] font-semibold text-slate-500">
                {string.octave}
              </span>
            </div>
            <div className="mt-1 text-[0.6rem] uppercase tracking-wider text-slate-500">
              {string.stringNo}
              {ordinal(string.stringNo)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ordinal(value: number): string {
  if (value === 1) return 'st'
  if (value === 2) return 'nd'
  if (value === 3) return 'rd'
  return 'th'
}
