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
      <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Wheel
      </p>
      <div
        role="slider"
        aria-label="Tempo wheel"
        aria-valuemin={MIN_BPM}
        aria-valuemax={MAX_BPM}
        aria-valuenow={value}
        tabIndex={0}
        className="relative h-[148px] w-16 touch-none select-none overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F1A] shadow-[inset_0_0_18px_rgba(168,85,247,0.12)]"
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
        <div className="pointer-events-none absolute inset-x-1 top-[54px] z-10 h-10 rounded-xl bg-[#A855F7]/20 ring-1 ring-[#A855F7]/45" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-8 bg-gradient-to-b from-[#0B0F1A] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-8 bg-gradient-to-t from-[#0B0F1A] to-transparent" />
        <div className="flex h-full flex-col items-center justify-center">
          {neighbors.map((offset) => {
            const bpm = value + offset
            const hidden = bpm < MIN_BPM || bpm > MAX_BPM
            return (
              <span
                key={offset}
                className={cn(
                  'flex h-[21px] items-center font-semibold tabular-nums',
                  offset === 0 ? 'text-base text-white' : 'text-[0.7rem] text-slate-500',
                  Math.abs(offset) === 1 && 'text-slate-300',
                  hidden && 'opacity-0',
                )}
              >
                {hidden ? '—' : bpm}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
