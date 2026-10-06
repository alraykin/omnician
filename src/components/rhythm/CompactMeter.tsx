import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

import {
  BEAT_UNITS,
  MAX_BEATS,
  MIN_BEATS,
  parseMeterBeatUnit,
  parseMeterBeats,
  type BeatUnit,
} from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

function stepBeatUnit(current: BeatUnit, dir: 1 | -1): BeatUnit {
  const index = BEAT_UNITS.indexOf(current)
  return BEAT_UNITS[Math.min(BEAT_UNITS.length - 1, Math.max(0, index + dir))] ?? current
}

function MeterValue({
  label,
  value,
  display,
  parse,
  onCommit,
}: {
  label: string
  value: number
  display?: string
  parse: (raw: string) => number | null
  onCommit: (next: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!editing) return
    const node = inputRef.current
    if (!node) return
    node.focus()
    node.select()
  }, [editing])

  const open = () => {
    doneRef.current = false
    setDraft(String(value))
    setEditing(true)
  }

  const finish = (apply: boolean) => {
    if (doneRef.current) return
    doneRef.current = true
    setEditing(false)
    if (!apply) return
    const next = parse(draft)
    if (next == null || next === value) return
    onCommit(next)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-meter-value={value}
        data-meter-edit={label}
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={`Type ${label}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => finish(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            finish(true)
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            finish(false)
          }
        }}
        className="h-7 w-10 min-w-[1.75rem] rounded-md bg-white/8 text-center text-base font-bold tabular-nums text-white outline-none ring-1 ring-[#A855F7]"
      />
    )
  }

  return (
    <button
      type="button"
      data-meter-value={value}
      aria-label={`${label}, ${display ?? value}. Tap to type`}
      {...activateOnPointer(open)}
      className="flex h-7 min-w-[1.75rem] items-center justify-center text-center text-base font-bold tabular-nums text-white"
    >
      {display ?? value}
    </button>
  )
}

function Stepper({
  label,
  value,
  display,
  parse,
  onCommit,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
}: {
  label: string
  value: number
  display?: string
  parse: (raw: string) => number | null
  onCommit: (next: number) => void
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
      <MeterValue label={label} value={value} display={display} parse={parse} onCommit={onCommit} />
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
          parse={parseMeterBeats}
          onCommit={(next) => onChange(next, beatUnit)}
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
          parse={parseMeterBeatUnit}
          onCommit={(next) => onChange(beats, next as BeatUnit)}
          onDec={() => onChange(beats, stepBeatUnit(beatUnit, -1))}
          onInc={() => onChange(beats, stepBeatUnit(beatUnit, 1))}
          decDisabled={unitIndex <= 0}
          incDisabled={unitIndex >= BEAT_UNITS.length - 1}
        />
      </div>
    </div>
  )
}
