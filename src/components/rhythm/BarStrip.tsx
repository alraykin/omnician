import { Plus, Trash2 } from 'lucide-react'

import { usePlayhead, type PlayheadStore } from '@/hooks/useRhythmEngine'
import { meterLabel, type RhythmBar } from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function BarStrip({
  store,
  bars,
  barIndex,
  playing,
  canAdd,
  onSelect,
  onAdd,
  onRemove,
}: {
  store: PlayheadStore
  bars: readonly RhythmBar[]
  barIndex: number
  playing: boolean
  canAdd: boolean
  onSelect: (index: number) => void
  onAdd: () => void
  onRemove: () => void
}) {
  const playhead = usePlayhead(store)
  const active = playing && playhead.bar >= 0 ? playhead.bar : barIndex
  const current = bars[active] ?? bars[0]

  return (
    <div data-bar-strip className="space-y-1.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {playing ? 'Now playing' : 'Selected bar'}
          </p>
          <p
            className="mt-0.5 text-base font-bold tabular-nums tracking-tight text-white sm:text-xl"
            data-bar-now={active + 1}
            data-bar-total={bars.length}
          >
            Bar {active + 1} of {bars.length}
          </p>
          {current ? (
            <p className="text-sm font-medium text-slate-400">
              {meterLabel(current.beats, current.beatUnit)}
            </p>
          ) : null}
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
          return (
            <button
              key={`bar-${index}`}
              type="button"
              data-bar-pill={index}
              aria-label={`Bar ${index + 1} of ${bars.length}, ${
                playing ? 'show this bar' : 'preview this bar'
              }`}
              aria-pressed={selected}
              {...activateOnPointer(() => onSelect(index))}
              className={cn(
                'flex size-9 touch-manipulation items-center justify-center rounded-lg text-sm font-semibold tabular-nums',
                selected ? 'bg-[#A855F7] text-white' : 'border border-white/10 bg-white/4 text-slate-200',
                live && 'omni-beat-pulse',
              )}
            >
              {index + 1}
            </button>
          )
        })}
      </div>
      <p className="text-[0.65rem] text-slate-500">
        {playing ? 'The grid shows the bar that is playing.' : 'Tap a bar to hear it.'}
      </p>
    </div>
  )
}
