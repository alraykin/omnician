import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import {
  MAX_SB_PCT,
  MAX_SB_REPEATS,
  MAX_SB_STEP,
  MIN_SB_PCT,
  MIN_SB_REPEATS,
  MIN_SB_STEP,
  sbBpm,
  type SpeedBuilder,
} from '@/lib/speed-builder'
import { holdRepeatProps, mergeHoldRepeatClass } from '@/lib/hold-repeat'
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
    <div className="flex w-full min-w-0 items-center gap-1">
      <p className="w-[3.15rem] shrink-0 text-[0.55rem] font-semibold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </p>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        data-sb-dec={label}
        disabled={value <= min}
        className={mergeHoldRepeatClass(
          'flex size-6 touch-manipulation items-center justify-center rounded-md border border-white/12 text-slate-200 disabled:opacity-35',
        )}
        {...holdRepeatProps({
          direction: -1,
          tapStep: 1,
          min,
          max,
          getValue: () => value,
          setValue: onChange,
        })}
      >
        <Minus className="size-3" />
      </button>
      {draft === null ? (
        <button
          type="button"
          aria-label={`${label} ${value}${suffix}, tap to type`}
          {...activateOnPointer(() => setDraft(String(value)))}
          className="min-w-[2.1rem] flex-1 whitespace-nowrap text-center text-sm font-bold tabular-nums text-white"
        >
          {value}
          {suffix ? <span className="text-[0.6rem] font-semibold text-slate-500">{suffix}</span> : null}
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
          className="min-w-[2.1rem] max-w-[2.4rem] flex-1 bg-transparent text-center text-sm font-bold tabular-nums text-white outline-none caret-[#C084FC]"
        />
      )}
      <button
        type="button"
        aria-label={`Increase ${label}`}
        data-sb-inc={label}
        disabled={value >= max}
        className={mergeHoldRepeatClass(
          'flex size-6 touch-manipulation items-center justify-center rounded-md border border-white/12 text-slate-200 disabled:opacity-35',
        )}
        {...holdRepeatProps({
          direction: 1,
          tapStep: 1,
          min,
          max,
          getValue: () => value,
          setValue: onChange,
        })}
      >
        <Plus className="size-3" />
      </button>
    </div>
  )
}

function PowerSwitch({
  on,
  onChange,
  label,
  testId,
  dimmed = false,
}: {
  on: boolean
  onChange: (next: boolean) => void
  label: string
  testId?: string
  dimmed?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-toggle={testId}
      data-on={on ? 'true' : 'false'}
      data-sb-power={testId === 'speed-builder' ? (on ? 'on' : 'off') : undefined}
      {...activateOnPointer(() => onChange(!on))}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        on ? 'bg-[#A855F7]' : 'bg-white/15',
        dimmed && 'opacity-45',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left]',
          on ? 'left-4' : 'left-0.5',
        )}
      />
    </button>
  )
}

const TOGGLE_LABEL =
  'text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-slate-400 whitespace-nowrap'

export function SpeedBuilderPanel({
  value,
  baseBpm,
  onChange,
  precountAlways = false,
}: {
  value: SpeedBuilder
  baseBpm: number
  onChange: (next: SpeedBuilder) => void
  precountAlways?: boolean
}) {
  const patch = (partial: Partial<SpeedBuilder>) => onChange({ ...value, ...partial })
  const fromBpm = sbBpm(baseBpm, value.fromPct)
  const toBpm = sbBpm(baseBpm, value.toPct)

  return (
    <div
      data-speed-builder
      className="relative z-20 flex h-full min-w-0 flex-1 flex-col"
      data-enabled={value.enabled ? 'true' : 'false'}
    >
      <div className="flex h-full w-max max-w-full flex-col">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Speed Builder
          </p>
          <PowerSwitch
            on={value.enabled}
            onChange={(enabled) => patch({ enabled })}
            label="Speed Builder on"
            testId="speed-builder"
          />
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
          <IntStepper
            label="Repeats"
            value={value.repeats}
            min={MIN_SB_REPEATS}
            max={MAX_SB_REPEATS}
            suffix=""
            onChange={(repeats) =>
              patch({ repeats: Math.min(MAX_SB_REPEATS, Math.max(MIN_SB_REPEATS, repeats)) })
            }
          />
          <p className="pl-[3.15rem] whitespace-nowrap text-[0.62rem] tabular-nums text-slate-500" data-sb-range data-sb-repeats={value.repeats}>
            {fromBpm} → {toBpm} BPM
          </p>
        </div>
        <div className="mt-auto pt-1.5">
          <SpeedBuilderToggles value={value} onChange={onChange} precountAlways={precountAlways} />
        </div>
      </div>
    </div>
  )
}

export function SpeedBuilderToggles({
  value,
  onChange,
  className,
  precountAlways = false,
}: {
  value: SpeedBuilder
  onChange: (next: SpeedBuilder) => void
  className?: string
  precountAlways?: boolean
}) {
  const patch = (partial: Partial<SpeedBuilder>) => onChange({ ...value, ...partial })
  const announceDim = !value.enabled
  const precountDim = !value.enabled && !precountAlways
  return (
    <div
      className={cn('w-full self-end', className)}
      data-sb-toggles
      data-precount-always={precountAlways ? 'true' : 'false'}
    >
      <div className="grid w-full grid-cols-[3.15rem_minmax(0,1fr)] items-center gap-x-1 gap-y-1.5">
        <p className={cn(TOGGLE_LABEL, 'text-left', announceDim && 'opacity-45')}>Announce</p>
        <div className="flex justify-end">
          <PowerSwitch
            on={value.announce}
            onChange={(announce) => patch({ announce })}
            label="Announce"
            testId="announce"
            dimmed={announceDim}
          />
        </div>
        <p className={cn(TOGGLE_LABEL, 'text-left', precountDim && 'opacity-45')}>Precount</p>
        <div className="flex justify-end">
          <PowerSwitch
            on={value.precount}
            onChange={(precount) => patch({ precount })}
            label="Precount"
            testId="precount"
            dimmed={precountDim}
          />
        </div>
      </div>
    </div>
  )
}
