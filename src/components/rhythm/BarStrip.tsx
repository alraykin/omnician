import { Plus, Trash2 } from 'lucide-react'

import { usePlayhead, type PlayheadStore } from '@/hooks/useRhythmEngine'
import { meterLabel, type RhythmBar } from '@/lib/rhythm'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export type BarKind = 'crash' | 'fill' | 'groove'

export function barKind(index: number, length: number): BarKind {
  if (length > 1 && index === length - 1) return 'fill'
  if (index % 4 === 0) return 'crash'
  return 'groove'
}

export const BAR_KIND_LABEL: Record<BarKind, string> = {
  crash: 'Crash',
  fill: 'Fill',
  groove: 'Groove',
}

export function BarStrip({
  store,
  bars,
  barIndex,
  playing,
  canAdd,
  kinds = true,
  onSelect,
  onAdd,
  onRemove,
}: {
  store: PlayheadStore
  bars: readonly RhythmBar[]
  barIndex: number
  playing: boolean
  canAdd: boolean
  kinds?: boolean
  onSelect: (index: number) => void
  onAdd: () => void
  onRemove: () => void
}) {
  const playhead = usePlayhead(store)
  const active = playing && playhead.bar >= 0 ? playhead.bar : barIndex
  const kind = kinds ? barKind(active, bars.length) : 'groove'

  return (
    <div data-bar-strip className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {playing ? 'Now playing' : 'Selected bar'}
          </p>
          <p
            className="mt-0.5 text-lg font-bold tabular-nums tracking-tight text-white sm:text-xl"
            data-bar-now={active + 1}
            data-bar-total={bars.length}
          >
            Bar {active + 1} of {bars.length}
          </p>
          <p className="text-sm font-semibold text-[#C084FC]" data-bar-kind={kinds ? kind : 'bar'}>
            {kinds ? BAR_KIND_LABEL[kind] : 'Bar'}
            <span className="mx-1.5 font-medium text-slate-600">·</span>
            <span className="font-medium text-slate-400">
              {meterLabel(bars[active]?.beats ?? 4, bars[active]?.beatUnit ?? 4)}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={onAdd} disabled={!canAdd}>
            <Plus className="size-3.5" />
            Bar
          </Button>
          {bars.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={onRemove}
              aria-label="Remove this bar"
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {bars.map((_, index) => {
          const live = playing && playhead.bar === index
          const selected = index === active
          const itemKind = kinds ? barKind(index, bars.length) : null
          return (
            <button
              key={`bar-${index}`}
              type="button"
              data-bar-pill={index}
              data-bar-role={itemKind ?? 'bar'}
              aria-label={`Bar ${index + 1} of ${bars.length}${
                itemKind ? `, ${BAR_KIND_LABEL[itemKind]}` : ''
              }, ${playing ? 'show this bar' : 'preview this bar'}`}
              aria-pressed={selected}
              onClick={() => onSelect(index)}
              className={cn(
                'flex h-9 min-w-9 flex-col items-center justify-center rounded-lg px-2 text-sm font-semibold leading-none',
                selected ? 'bg-[#A855F7] text-white' : 'border border-white/10 bg-white/4 text-slate-200',
                live && 'omni-beat-pulse',
              )}
            >
              <span className="tabular-nums">{index + 1}</span>
              {itemKind ? (
                <span
                  className={cn(
                    'mt-0.5 text-[0.55rem] font-semibold uppercase tracking-wider',
                    selected ? 'text-white/75' : 'text-slate-500',
                  )}
                >
                  {BAR_KIND_LABEL[itemKind]}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <p className="text-[0.65rem] text-slate-500">
        {playing ? 'The grid slides to the bar that is playing.' : 'Tap a bar to hear it.'}
      </p>
    </div>
  )
}
