import { ChevronDown, Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { A4_PRESETS, A4_RANGE, clampA4, stepA4 } from '@/lib/custom-presets'
import { A4_HZ } from '@/lib/notes'
import { cn } from '@/lib/utils'

type A4ReferenceControlProps = {
  a4Hz: number
  onChange: (hz: number) => void
}

export function A4ReferenceControl({ a4Hz, onChange }: A4ReferenceControlProps) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('a4') === '1'
  })

  const setHz = (hz: number) => onChange(clampA4(hz))
  const atMin = a4Hz <= A4_RANGE.min
  const atMax = a4Hz >= A4_RANGE.max

  return (
    <>
      <button
        type="button"
        data-a4-open
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`A4 reference ${a4Hz} hertz. Tap to change.`}
        onClick={() => setOpen(true)}
        className="mx-auto mt-1 flex h-6 w-full min-w-0 items-center justify-center gap-px overflow-hidden rounded-full border border-white/18 bg-white/10 px-1 text-[0.58rem] font-semibold leading-none tabular-nums text-slate-200 transition-colors hover:border-white/28 hover:bg-white/14 hover:text-white"
      >
        <span className="min-w-0 truncate">A4 {a4Hz} Hz</span>
        <ChevronDown className="size-2.5 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 px-0 pb-[var(--tabbar-clearance)] pt-2 sm:items-center sm:p-4"
          data-a4-sheet
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="a4-sheet-title"
            className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#0F1422] px-4 pb-4 pt-4 sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
              Reference pitch
            </p>
            <h2
              id="a4-sheet-title"
              className="mt-1 text-xl font-bold tracking-tight text-white"
            >
              A4
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Detection, cents, string targets, and reference tones all follow this A.
            </p>

            <div className="mt-5 flex items-center justify-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-a4-minus
                aria-label="Lower A4 by 1 hertz"
                disabled={atMin}
                onClick={() => setHz(stepA4(a4Hz, -1))}
              >
                <Minus className="size-5" />
              </Button>
              <div className="min-w-36 text-center">
                <p className="text-4xl font-extrabold tabular-nums tracking-tight text-white">
                  {a4Hz}
                </p>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Hz
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-a4-plus
                aria-label="Raise A4 by 1 hertz"
                disabled={atMax}
                onClick={() => setHz(stepA4(a4Hz, 1))}
              >
                <Plus className="size-5" />
              </Button>
            </div>

            <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Common standards
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {A4_PRESETS.map((preset) => {
                const selected = a4Hz === preset.hz
                return (
                  <button
                    key={preset.hz}
                    type="button"
                    data-a4-preset={preset.hz}
                    onClick={() => setHz(preset.hz)}
                    className={cn(
                      'rounded-2xl px-2 py-2.5 text-center ring-1 transition-colors',
                      selected
                        ? 'bg-[#A855F7]/20 text-white ring-[#A855F7]/70'
                        : 'bg-white/5 text-slate-300 ring-white/8 hover:bg-white/8',
                    )}
                  >
                    <span className="block text-sm font-semibold tabular-nums">
                      {preset.label}
                    </span>
                    {preset.hint ? (
                      <span className="mt-0.5 block text-[0.65rem] text-slate-400">
                        {preset.hint}
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-[0.65rem] text-slate-500">
                        Hz
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <p className="mt-3 text-center text-xs text-slate-500">
              {A4_RANGE.min}–{A4_RANGE.max} Hz · 1 Hz steps
              {a4Hz !== A4_HZ ? ' · not concert 440' : ''}
            </p>

            <Button
              type="button"
              className="mt-4 w-full"
              data-a4-done
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
