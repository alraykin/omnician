import { Plus, Trash2 } from 'lucide-react'

import { usePlayhead, type PlayheadStore } from '@/hooks/useRhythmEngine'
import { type RhythmBar } from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

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

  return (
    <div data-bar-strip className="flex items-center gap-1.5">
      <p
        className="shrink-0 text-sm font-bold tabular-nums tracking-tight text-white"
        data-bar-now={active + 1}
        data-bar-total={bars.length}
      >
        Bar {active + 1} of {bars.length}
      </p>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
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
                'flex size-7 touch-manipulation items-center justify-center rounded-md text-xs font-semibold tabular-nums',
                selected ? 'bg-[#A855F7] text-white' : 'border border-white/10 bg-white/4 text-slate-200',
                live && 'omni-beat-pulse',
              )}
            >
              {index + 1}
            </button>
          )
        })}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label="Add bar"
          disabled={!canAdd}
          onClick={onAdd}
          className="flex size-7 touch-manipulation items-center justify-center rounded-md border border-white/12 text-slate-200 disabled:opacity-40"
        >
          <Plus className="size-3.5" />
        </button>
        {bars.length > 1 ? (
          <button
            type="button"
            aria-label="Remove this bar"
            onClick={onRemove}
            className="flex size-7 touch-manipulation items-center justify-center rounded-md text-slate-300 hover:bg-white/8 hover:text-white"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
