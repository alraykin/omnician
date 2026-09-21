import { useRef } from 'react'

import { clampBpm, MAX_BPM, MIN_BPM } from '@/lib/rhythm'
import { cn } from '@/lib/utils'

type BpmWheelProps = {
  value: number
  onChange: (bpm: number) => void
}

export function BpmWheel({ value, onChange }: BpmWheelProps) {
  const dragRef = useRef<{ y: number; bpm: number } | null>(null)
  const neighbors = [-3, -2, -1, 0, 1, 2, 3]

  const bump = (next: number) => {
    const clamped = clampBpm(next)
    if (clamped === value) return
    onChange(clamped)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8)
    }
  }

  return (
    <div className="flex flex-col items-center">
      <p className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Wheel
      </p>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-1.5 inset-x-1.5 h-3 rounded-full bg-black/55 blur-[5px]"
        />
        <div
          role="slider"
          aria-label="Tempo wheel"
          aria-valuemin={MIN_BPM}
          aria-valuemax={MAX_BPM}
          aria-valuenow={value}
          tabIndex={0}
          className="bpm-wheel relative h-[164px] w-[72px] touch-none select-none rounded-[26px] p-[5px] outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/70"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            dragRef.current = { y: event.clientY, bpm: value }
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current
            if (!drag) return
            const delta = drag.y - event.clientY
            const steps = Math.round(delta / 7)
            if (steps === 0) return
            drag.y = event.clientY
            drag.bpm = clampBpm(drag.bpm + steps)
            bump(drag.bpm)
          }}
          onPointerUp={() => {
            dragRef.current = null
          }}
          onPointerCancel={() => {
            dragRef.current = null
          }}
          onWheel={(event) => {
            bump(
              value +
                (event.deltaY > 0 ? -1 : 1) *
                  Math.max(1, Math.round(Math.abs(event.deltaY) / 40)),
            )
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
              event.preventDefault()
              bump(value + 1)
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
              event.preventDefault()
              bump(value - 1)
            }
          }}
        >
          <div className="bpm-wheel-drum relative h-full overflow-hidden rounded-[21px]">
            <div className="bpm-wheel-knurl pointer-events-none absolute inset-y-0 left-0 w-2.5" />
            <div className="bpm-wheel-knurl pointer-events-none absolute inset-y-0 right-0 w-2.5" />
            <div className="bpm-wheel-shade pointer-events-none absolute inset-y-0 left-0 w-5" />
            <div className="bpm-wheel-shade-right pointer-events-none absolute inset-y-0 right-0 w-5" />
            <div
              className="flex h-full flex-col items-center justify-center"
              style={{ perspective: '420px' }}
            >
              {neighbors.map((offset) => {
                const bpm = value + offset
                const hidden = bpm < MIN_BPM || bpm > MAX_BPM
                return (
                  <span
                    key={offset}
                    className={cn(
                      'flex h-[22px] items-center font-semibold tabular-nums tracking-tight',
                      offset === 0 ? 'text-[1.05rem] text-white' : 'text-[0.7rem] text-slate-500',
                      Math.abs(offset) === 1 && 'text-slate-300',
                      hidden && 'opacity-0',
                    )}
                    style={
                      hidden
                        ? undefined
                        : {
                            transform: `rotateX(${offset * -16}deg) scale(${1 - Math.abs(offset) * 0.07})`,
                            opacity: 1 - Math.abs(offset) * 0.18,
                          }
                    }
                  >
                    {hidden ? '—' : bpm}
                  </span>
                )
              })}
            </div>
            <div className="pointer-events-none absolute inset-x-[11px] top-[58px] z-10 h-[42px] rounded-[12px] bg-[#A855F7]/18 ring-1 ring-[#C084FC]/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_14px_rgba(168,85,247,0.28)]" />
            <div className="pointer-events-none absolute inset-x-3 top-[58px] z-20 h-px bg-white/35" />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 bg-gradient-to-b from-[#070a12] via-[#070a12]/55 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 bg-gradient-to-t from-[#070a12] via-[#070a12]/55 to-transparent" />
            <div className="pointer-events-none absolute inset-x-3 top-[7px] z-30 h-3 rounded-full bg-white/18 blur-[2px]" />
          </div>
        </div>
      </div>
    </div>
  )
}
