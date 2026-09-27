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
  const counting = playing && playhead.precount
  const active = counting ? barIndex : playing && playhead.bar >= 0 ? playhead.bar : barIndex

  return (
    <div data-bar-strip className="flex items-center gap-1">
      <p
        className="shrink-0 text-xs font-bold tabular-nums tracking-tight text-white sm:text-sm"
        data-bar-now={counting ? playhead.beat + 1 : active + 1}
        data-bar-total={bars.length}
        data-precount={counting ? 'true' : 'false'}
      >
        {counting && playhead.beat >= 0
          ? `Count ${playhead.beat + 1}`
          : `Bar ${active + 1} of ${bars.length}`}
      </p>
      <div
        data-bar-chips
        className="grid min-w-0 flex-1 grid-cols-8 gap-0.5"
      >
        {bars.map((_, index) => {
          const live = playing && !playhead.precount && playhead.bar === index
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
                'flex aspect-square min-h-6 w-full touch-manipulation items-center justify-center rounded-md text-[0.65rem] font-semibold tabular-nums sm:text-xs',
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
          {...activateOnPointer(onAdd)}
          className="flex size-6 touch-manipulation items-center justify-center rounded-md border border-white/12 text-slate-200 disabled:opacity-40 sm:size-7"
        >
          <Plus className="size-3.5" />
        </button>
        {bars.length > 1 ? (
          <button
            type="button"
            aria-label="Remove this bar"
            {...activateOnPointer(onRemove)}
            className="flex size-6 touch-manipulation items-center justify-center rounded-md text-slate-300 hover:bg-white/8 hover:text-white sm:size-7"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
