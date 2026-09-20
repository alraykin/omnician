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
          <button
            type="button"
            role="switch"
            aria-checked={autoString}
            onClick={() => onAutoChange(!autoString)}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              autoString ? 'bg-[#A855F7]' : 'bg-white/15',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-5 rounded-full bg-white transition-transform',
                autoString ? 'translate-x-5' : 'translate-x-0.5',
              )}
            />
          </button>
        </label>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#151B2C] px-2 pb-3 pt-3 sm:px-3">
        <div className="flex justify-center">
          <OmnicianMark className="h-10 w-10 sm:h-12 sm:w-12" title="Omnician" />
        </div>

        <div
          className="mt-2 grid items-start gap-x-2"
          style={{ gridTemplateColumns: '1fr 2.4rem 1fr' }}
        >
          <div className="flex flex-col items-end gap-1.5">
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

          <div className="relative mx-auto h-full min-h-16 w-7">
            <div className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-white/20" />
            {strings.map((string, index) => (
              <div
                key={string.id}
                className={cn(
                  'absolute left-1/2 w-px -translate-x-1/2',
                  tunedIds.has(string.id) ? 'bg-emerald-400/80' : 'bg-white/25',
                )}
                style={{
                  top: `${8 + index * 4}%`,
                  bottom: 0,
                  marginLeft: `${(index - (strings.length - 1) / 2) * 3}px`,
                }}
              />
            ))}
          </div>

          <div className="flex flex-col items-start gap-1.5">
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
          <div className="mt-2 flex justify-center">
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

        <div className="mx-auto mt-3 h-2 w-[72%] rounded-sm bg-[#C9A36A]/80 shadow-[0_0_12px_rgba(201,163,106,0.25)]" />
        <p className="mt-2 text-center text-[0.65rem] text-slate-500">
          Tap a peg to hear its pitch. Red is the string you are on; green stays
          until it is played out of tune.
        </p>
      </div>
    </div>
  )
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
        'flex items-center gap-2 rounded-2xl px-1.5 py-1',
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
          tone === 'idle' && 'bg-[#2A3348] ring-white/20',
        )}
      />
      <span className="min-w-8">
        <span className="block text-sm font-bold leading-none text-white">
          {string.label}
        </span>
        <span className="block text-[0.6rem] uppercase tracking-wider text-slate-500">
          {fifth ? '5th' : `${string.stringNo}`}
        </span>
      </span>
    </button>
  )
}
