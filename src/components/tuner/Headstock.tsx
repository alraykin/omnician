import { OmnicianMark } from '@/components/OmnicianMark'
import { layoutPegs } from '@/lib/headstock'
import type { InstrumentString } from '@/lib/notes'
import type { InstrumentId } from '@/lib/presets'
import { cn } from '@/lib/utils'

type HeadstockProps = {
  strings: readonly InstrumentString[]
  config: InstrumentId
  selectedId: string | null
  tunedIds: ReadonlySet<string>
  autoString: boolean
  onAutoChange: (value: boolean) => void
  onTapPeg: (string: InstrumentString) => void
}

export function Headstock({
  strings,
  config,
  selectedId,
  tunedIds,
  autoString,
  onAutoChange,
  onTapPeg,
}: HeadstockProps) {
  const slots = layoutPegs(strings, config)
  const left = slots.filter((slot) => slot.side === 'left')
  const right = slots.filter((slot) => slot.side === 'right')
  const fifth = slots.find((slot) => slot.side === 'fifth')
  const rows = Math.max(left.length, right.length, 1)

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Headstock
        </p>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          Auto strings
          <AutoSwitch on={autoString} onChange={onAutoChange} />
        </label>
      </div>

      <div className="relative mx-auto w-full max-w-sm">
        <HeadstockSilhouette rows={rows} />
        <div className="relative z-10 px-1 pb-2 pt-2">
          <div className="flex justify-center pb-1">
            <OmnicianMark className="h-11 w-11 sm:h-12 sm:w-12" title="Omnician" />
          </div>
          <div
            className="grid items-center gap-x-1"
            style={{ gridTemplateColumns: '1fr minmax(3.5rem, 28%) 1fr' }}
          >
            <div className="flex flex-col items-end justify-between gap-1 self-stretch py-1">
              {Array.from({ length: rows }, (_, row) => {
                const slot = left[row]
                if (!slot) return <div key={`l-empty-${row}`} className="h-11" />
                return (
                  <PegButton
                    key={slot.string.id}
                    string={slot.string}
                    selected={slot.string.id === selectedId}
                    tuned={tunedIds.has(slot.string.id)}
                    align="right"
                    onClick={() => onTapPeg(slot.string)}
                  />
                )
              })}
            </div>
            <div className="min-h-16" aria-hidden />
            <div className="flex flex-col items-start justify-between gap-1 self-stretch py-1">
              {Array.from({ length: rows }, (_, row) => {
                const slot = right[row]
                if (!slot) return <div key={`r-empty-${row}`} className="h-11" />
                return (
                  <PegButton
                    key={slot.string.id}
                    string={slot.string}
                    selected={slot.string.id === selectedId}
                    tuned={tunedIds.has(slot.string.id)}
                    align="left"
                    onClick={() => onTapPeg(slot.string)}
                  />
                )
              })}
            </div>
          </div>
          {fifth ? (
            <div className="mt-1 flex justify-start pl-2">
              <PegButton
                string={fifth.string}
                selected={fifth.string.id === selectedId}
                tuned={tunedIds.has(fifth.string.id)}
                align="center"
                fifth
                onClick={() => onTapPeg(fifth.string)}
              />
            </div>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-center text-[0.65rem] leading-4 text-slate-500">
        Tap a peg to hear its pitch and set the target. Red is the active string;
        green stays until that string is played out of tune.
      </p>
    </div>
  )
}

function AutoSwitch({
  on,
  onChange,
}: {
  on: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Auto strings"
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors',
        on ? 'justify-end bg-[#A855F7]' : 'justify-start bg-white/15',
      )}
    >
      <span className="block size-6 shrink-0 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.45)]" />
    </button>
  )
}

function HeadstockSilhouette({ rows }: { rows: number }) {
  const height = 168 + rows * 38
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 220 ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <path
        d={silhouettePath(height)}
        fill="#1A2233"
        stroke="#8B6B3D"
        strokeWidth="3"
      />
      <path
        d={silhouettePath(height)}
        fill="none"
        stroke="rgba(168, 85, 247, 0.28)"
        strokeWidth="1.2"
        transform="translate(0 1)"
      />
      <rect
        x="78"
        y={height - 18}
        width="64"
        height="10"
        rx="1.5"
        fill="#C9A36A"
      />
      {Array.from({ length: 6 }, (_, index) => (
        <line
          key={index}
          x1={88 + index * 7.2}
          y1={height - 18}
          x2={88 + index * 7.2}
          y2={height - 8}
          stroke="#3B2A14"
          strokeWidth="0.8"
        />
      ))}
    </svg>
  )
}

function silhouettePath(height: number): string {
  const nut = height - 22
  return [
    'M 78 14',
    'C 48 14 32 36 32 64',
    `L 36 ${nut - 36}`,
    `L 72 ${nut}`,
    `L 148 ${nut}`,
    `L 184 ${nut - 36}`,
    'L 188 64',
    'C 188 36 172 14 142 14',
    'Z',
  ].join(' ')
}

function PegButton({
  string,
  selected,
  tuned,
  align,
  fifth = false,
  onClick,
}: {
  string: InstrumentString
  selected: boolean
  tuned: boolean
  align: 'left' | 'right' | 'center'
  fifth?: boolean
  onClick: () => void
}) {
  const tone = tuned ? 'green' : selected ? 'red' : 'idle'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`String ${string.stringNo}, ${string.label}${string.octave}${tuned ? ', in tune' : ''}`}
      className={cn(
        'flex items-center gap-1.5 rounded-2xl px-1 py-0.5',
        align === 'right' && 'flex-row-reverse text-right',
        align === 'center' && 'flex-col',
      )}
    >
      <span
        className={cn(
          'size-8 rounded-full ring-2 transition sm:size-9',
          tone === 'green' &&
            'bg-emerald-400 ring-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.7)]',
          tone === 'red' &&
            'bg-red-500 ring-red-300 shadow-[0_0_14px_rgba(239,68,68,0.65)]',
          tone === 'idle' && 'bg-[#2A3348] ring-[#C9A36A]/70',
        )}
      />
      <span className="min-w-7">
        <span className="block text-sm font-bold leading-none text-white">
          {string.label}
        </span>
        <span className="block text-[0.7rem] font-semibold tabular-nums text-slate-300">
          {fifth ? '5th' : `${string.stringNo}`}
        </span>
      </span>
    </button>
  )
}
