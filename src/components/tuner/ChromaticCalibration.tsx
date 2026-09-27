import { useRef } from 'react'

import { A4_RANGE } from '@/lib/custom-presets'
import { A4_HZ } from '@/lib/notes'
import { DRAG_DEADZONE_PX, accumulatedScroll } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type ChromaticCalibrationProps = {
  a4Hz: number
  onChange: (hz: number) => void
  compact?: boolean
}

export function ChromaticCalibration({
  a4Hz,
  onChange,
  compact = false,
}: ChromaticCalibrationProps) {
  const liveRef = useRef(false)
  const startRef = useRef<{ x: number; y: number; scroll: number; value: number } | null>(null)

  return (
    <div
      className={
        compact
          ? 'rounded-2xl border border-white/10 bg-white/4 px-4 py-3'
          : 'rounded-2xl border border-white/10 bg-[#141A28]/80 px-4 py-4'
      }
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
            Chromatic calibration
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">
            A4 = {a4Hz} Hz
          </p>
        </div>
        {a4Hz !== A4_HZ ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(A4_HZ)}>
            Reset 440
          </Button>
        ) : null}
      </div>
      <input
        type="range"
        min={A4_RANGE.min}
        max={A4_RANGE.max}
        step={1}
        value={a4Hz}
        onPointerDown={(event) => {
          liveRef.current = false
          startRef.current = {
            x: event.clientX,
            y: event.clientY,
            scroll: accumulatedScroll(event.currentTarget),
            value: a4Hz,
          }
        }}
        onPointerMove={(event) => {
          const start = startRef.current
          if (!start) return
          if (Math.abs(accumulatedScroll(event.currentTarget) - start.scroll) > 1) {
            liveRef.current = false
            return
          }
          const dx = event.clientX - start.x
          const dy = event.clientY - start.y
          if (Math.hypot(dx, dy) < DRAG_DEADZONE_PX) return
          liveRef.current = Math.abs(dx) >= Math.abs(dy)
        }}
        onPointerUp={() => {
          liveRef.current = false
          startRef.current = null
        }}
        onPointerCancel={() => {
          liveRef.current = false
          startRef.current = null
        }}
        onChange={(event) => {
          if (!liveRef.current && startRef.current) {
            event.currentTarget.value = String(startRef.current.value)
            return
          }
          onChange(Number(event.target.value))
        }}
        aria-label="A4 reference frequency"
        className="omni-slider mt-4 w-full"
      />
      <div className="mt-1 flex justify-between text-[0.65rem] text-slate-500">
        <span>{A4_RANGE.min}</span>
        <span>Concert {A4_HZ}</span>
        <span>{A4_RANGE.max}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Slide this if your piano or track uses a different A. Chromatic mode
        hides string lists and locks to the nearest note.
      </p>
    </div>
  )
}
