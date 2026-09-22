import { useEffect, useRef, useState } from 'react'

import { clampBpm, MAX_BPM, MIN_BPM } from '@/lib/rhythm'
import { cn } from '@/lib/utils'

type BpmWheelProps = {
  value: number
  onChange: (bpm: number) => void
}

const TICKS = 48
const DEG_PER_BPM = 10

export function BpmWheel({ value, onChange }: BpmWheelProps) {
  const dragRef = useRef<{ y: number; bpm: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const editing = draft !== null
  const ringAngle = (value - MIN_BPM) * DEG_PER_BPM

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const bump = (next: number) => {
    if (editing) return
    const clamped = clampBpm(next)
    if (clamped === value) return
    onChange(clamped)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8)
    }
  }

  const commitDraft = () => {
    if (draft === null) return
    const parsed = Number.parseInt(draft.replace(/[^\d]/g, ''), 10)
    setDraft(null)
    if (!Number.isFinite(parsed)) return
    const clamped = clampBpm(parsed)
    if (clamped !== value) onChange(clamped)
  }

  const endDrag = () => {
    dragRef.current = null
    setDragging(false)
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-1 left-1/2 h-4 w-28 -translate-x-1/2 rounded-full bg-black/50 blur-md"
        />
        <div
          role="slider"
          aria-label="Tempo"
          aria-valuemin={MIN_BPM}
          aria-valuemax={MAX_BPM}
          aria-valuenow={value}
          aria-disabled={editing}
          tabIndex={editing ? -1 : 0}
          className="bpm-dial relative size-[176px] touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/70 sm:size-[188px]"
          onPointerDown={(event) => {
            if (editing) return
            if ((event.target as HTMLElement).closest('button, input')) return
            event.currentTarget.setPointerCapture(event.pointerId)
            dragRef.current = { y: event.clientY, bpm: value }
            setDragging(true)
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current
            if (!drag || editing) return
            const delta = drag.y - event.clientY
            const steps = Math.round(delta / 7)
            if (steps === 0) return
            drag.y = event.clientY
            drag.bpm = clampBpm(drag.bpm + steps)
            bump(drag.bpm)
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={(event) => {
            if (editing) return
            bump(
              value +
                (event.deltaY > 0 ? -1 : 1) *
                  Math.max(1, Math.round(Math.abs(event.deltaY) / 40)),
            )
          }}
          onKeyDown={(event) => {
            if (editing) return
            if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
              event.preventDefault()
              bump(value + 1)
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
              event.preventDefault()
              bump(value - 1)
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              setDraft(String(value))
            }
          }}
        >
          <span aria-hidden className="bpm-dial-pip" />
          <div
            aria-hidden
            data-ring-angle={ringAngle}
            className={cn(
              'bpm-dial-ring',
              dragging ? 'bpm-dial-ring-live' : 'bpm-dial-ring-smooth',
            )}
            style={{ transform: `rotate(${ringAngle}deg)` }}
          >
            {Array.from({ length: TICKS }, (_, index) => {
              const major = index % 4 === 0
              const deg = (index / TICKS) * 360
              return (
                <span
                  key={index}
                  className={major ? 'bpm-dial-tick bpm-dial-tick-major' : 'bpm-dial-tick'}
                  style={{
                    transform: `rotate(${deg}deg) translateY(calc(-1 * var(--ring-radius)))`,
                  }}
                />
              )
            })}
          </div>
          <div className="bpm-dial-face">
            <div className="pointer-events-none absolute inset-x-8 top-[14px] z-20 h-5 rounded-full bg-white/16 blur-[3px]" />
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center">
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                BPM
              </span>
              {editing ? (
                <input
                  ref={inputRef}
                  aria-label="Custom tempo"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                  onBlur={commitDraft}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitDraft()
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      setDraft(null)
                    }
                    event.stopPropagation()
                  }}
                  className="mt-0.5 w-[5.2rem] bg-transparent text-center text-5xl font-bold tabular-nums tracking-tight text-white outline-none caret-[#C084FC]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setDraft(String(value))}
                  className="mt-0.5 rounded-xl px-2 text-5xl font-bold tabular-nums tracking-tight text-white"
                >
                  {value}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
