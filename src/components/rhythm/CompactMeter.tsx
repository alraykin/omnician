import { Minus, Plus } from 'lucide-react'

import { BEAT_UNITS, MAX_BEATS, MIN_BEATS, type BeatUnit } from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

function stepBeatUnit(current: BeatUnit, dir: 1 | -1): BeatUnit {
  const index = BEAT_UNITS.indexOf(current)
  return BEAT_UNITS[Math.min(BEAT_UNITS.length - 1, Math.max(0, index + dir))] ?? current
}

function Stepper({
  label,
  value,
  display,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
}: {
  label: string
  value: number
  display?: string
  onDec: () => void
  onInc: () => void
  decDisabled: boolean
  incDisabled: boolean
}) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={decDisabled}
        {...activateOnPointer(onDec)}
        className={cn(
          'flex size-7 touch-manipulation items-center justify-center rounded-md border border-white/12 text-slate-200',
          decDisabled && 'opacity-35',
        )}
      >
        <Minus className="size-3" />
      </button>
      <span
        className="min-w-[1.4rem] text-center text-base font-bold tabular-nums text-white"
        data-meter-value={value}
      >
        {display ?? value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={incDisabled}
        {...activateOnPointer(onInc)}
        className={cn(
          'flex size-7 touch-manipulation items-center justify-center rounded-md border border-white/12 text-slate-200',
          incDisabled && 'opacity-35',
        )}
      >
        <Plus className="size-3" />
      </button>
    </div>
  )
}

export function CompactMeter({
  beats,
  beatUnit,
  onChange,
}: {
  beats: number
  beatUnit: BeatUnit
  onChange: (beats: number, beatUnit: BeatUnit) => void
}) {
  const unitIndex = BEAT_UNITS.indexOf(beatUnit)

  return (
    <div data-section="meter" className="flex items-center justify-between gap-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Meter</p>
      <div className="flex items-center gap-1.5" data-meter={`${beats}/${beatUnit}`}>
        <Stepper
          label="beats"
          value={beats}
          onDec={() => onChange(beats - 1, beatUnit)}
          onInc={() => onChange(beats + 1, beatUnit)}
          decDisabled={beats <= MIN_BEATS}
          incDisabled={beats >= MAX_BEATS}
        />
        <span className="text-lg font-bold leading-none text-slate-500">/</span>
        <Stepper
          label="beat unit"
          value={beatUnit}
          display={`${beatUnit}`}
          onDec={() => onChange(beats, stepBeatUnit(beatUnit, -1))}
          onInc={() => onChange(beats, stepBeatUnit(beatUnit, 1))}
          decDisabled={unitIndex <= 0}
          incDisabled={unitIndex >= BEAT_UNITS.length - 1}
        />
      </div>
    </div>
  )
}
