import { inputShortLabel, PREVIEW_GROUPS, previewDotsForGroup } from '@/lib/pattern-preview'
import { type InputDivision } from '@/lib/beat-boxes'
import { type RhythmBar } from '@/lib/rhythm'
import { cn } from '@/lib/utils'

export function PatternPreview({
  bars,
  input,
}: {
  bars: readonly RhythmBar[]
  input: InputDivision
}) {
  const beatUnit = bars[0]?.beatUnit ?? 4
  const label = inputShortLabel(input, beatUnit)
  const empty = bars.every((bar) =>
    PREVIEW_GROUPS.every((group) => !previewDotsForGroup([bar], group.voices, input).some((dot) => dot.filled)),
  )

  return (
    <section
      data-pattern-preview
      data-pattern-bars={bars.length}
      data-pattern-input={label}
      className="rounded-xl border border-white/10 bg-[#141A28]/80 px-2.5 py-2"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Pattern · {bars.length} bar{bars.length === 1 ? '' : 's'} · {label}
        </p>
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Overview</p>
      </div>
      {empty ? (
        <p data-pattern-empty className="py-3 text-center text-[0.75rem] text-slate-500">
          Empty pattern — tap Edit beat to write hits.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {PREVIEW_GROUPS.map((group) => {
            const dots = previewDotsForGroup(bars, group.voices, input)
            return (
              <div key={group.id} data-preview-row={group.id} className="grid grid-cols-[2.4rem_minmax(0,1fr)] items-center gap-1.5">
                <span className="truncate text-[0.62rem] font-semibold text-slate-400">{group.label}</span>
                <div className="flex min-w-0 items-center overflow-hidden">
                  {dots.map((dot) => (
                    <span
                      key={dot.key}
                      data-preview-dot={dot.filled ? '1' : '0'}
                      className={cn(
                        'mx-px h-1.5 min-w-0 flex-1 rounded-full',
                        dot.filled
                          ? dot.soft
                            ? 'bg-[#6D28D9]/55'
                            : 'bg-[#A855F7]'
                          : 'bg-white/12',
                      )}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
