import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import {
  MAX_SB_PCT,
  MAX_SB_STEP,
  MIN_SB_PCT,
  MIN_SB_STEP,
  sbBpm,
  type SpeedBuilder,
} from '@/lib/speed-builder'
import { activateOnPointer, cn } from '@/lib/utils'

function IntStepper({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (next: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    if (draft === null) return
    const parsed = Number.parseInt(draft.replace(/[^\d-]/g, ''), 10)
    setDraft(null)
    if (!Number.isFinite(parsed)) return
    onChange(Math.min(max, Math.max(min, parsed)))
  }

  return (
    <div className="flex items-center gap-1">
      <p className="w-[2.7rem] shrink-0 text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        {...activateOnPointer(() => onChange(value - 1))}
        className="flex size-6 touch-manipulation items-center justify-center rounded-md border border-white/12 text-slate-200 disabled:opacity-35"
      >
        <Minus className="size-3" />
      </button>
      {draft === null ? (
        <button
          type="button"
          aria-label={`${label} ${value}${suffix}, tap to type`}
          {...activateOnPointer(() => setDraft(String(value)))}
          className="min-w-[2.1rem] text-center text-sm font-bold tabular-nums text-white"
        >
          {value}
          <span className="text-[0.6rem] font-semibold text-slate-500">{suffix}</span>
        </button>
      ) : (
        <input
          aria-label={label}
          inputMode="numeric"
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setDraft(null)
            }
          }}
          className="min-w-[2.1rem] max-w-[2.4rem] bg-transparent text-center text-sm font-bold tabular-nums text-white outline-none caret-[#C084FC]"
        />
      )}
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        {...activateOnPointer(() => onChange(value + 1))}
        className="flex size-6 touch-manipulation items-center justify-center rounded-md border border-white/12 text-slate-200 disabled:opacity-35"
      >
        <Plus className="size-3" />
      </button>
    </div>
  )
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string
  on: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      {...activateOnPointer(() => onChange(!on))}
      className={cn(
        'flex h-6 items-center gap-1 rounded-full border px-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.08em]',
        on
          ? 'border-[#A855F7]/60 bg-[#A855F7] text-white'
          : 'border-white/12 bg-white/4 text-slate-400',
      )}
    >
      {label}
    </button>
  )
}

export function SpeedBuilderPanel({
  value,
  baseBpm,
  onChange,
}: {
  value: SpeedBuilder
  baseBpm: number
  onChange: (next: SpeedBuilder) => void
}) {
  const patch = (partial: Partial<SpeedBuilder>) => onChange({ ...value, ...partial })
  const fromBpm = sbBpm(baseBpm, value.fromPct)
  const toBpm = sbBpm(baseBpm, value.toPct)

  return (
    <div data-speed-builder className="min-w-0 flex-1" data-enabled={value.enabled ? 'true' : 'false'}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Speed Builder
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={value.enabled}
          aria-label="Speed Builder on"
          data-sb-power={value.enabled ? 'on' : 'off'}
          {...activateOnPointer(() => patch({ enabled: !value.enabled }))}
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors',
            value.enabled ? 'bg-[#A855F7]' : 'bg-white/15',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left]',
              value.enabled ? 'left-4' : 'left-0.5',
            )}
          />
        </button>
      </div>

      <div className={cn('mt-1.5 space-y-1', !value.enabled && 'opacity-45')}>
        <IntStepper
          label="From"
          value={value.fromPct}
          min={MIN_SB_PCT}
          max={MAX_SB_PCT}
          suffix="%"
          onChange={(fromPct) => patch({ fromPct: Math.min(MAX_SB_PCT, Math.max(MIN_SB_PCT, fromPct)) })}
        />
        <IntStepper
          label="To"
          value={value.toPct}
          min={MIN_SB_PCT}
          max={MAX_SB_PCT}
          suffix="%"
          onChange={(toPct) => patch({ toPct: Math.min(MAX_SB_PCT, Math.max(MIN_SB_PCT, toPct)) })}
        />
        <IntStepper
          label="Step"
          value={value.stepPct}
          min={MIN_SB_STEP}
          max={MAX_SB_STEP}
          suffix="%"
          onChange={(stepPct) => patch({ stepPct: Math.min(MAX_SB_STEP, Math.max(MIN_SB_STEP, stepPct)) })}
        />
        <p className="pl-[2.7rem] text-[0.62rem] tabular-nums text-slate-500" data-sb-range>
          {fromBpm} → {toBpm} BPM
        </p>
        <div className="flex flex-wrap gap-1 pt-0.5">
          <Toggle label="Precount" on={value.precount} onChange={(precount) => patch({ precount })} />
          <Toggle label="Announce" on={value.announce} onChange={(announce) => patch({ announce })} />
        </div>
      </div>
    </div>
  )
}
