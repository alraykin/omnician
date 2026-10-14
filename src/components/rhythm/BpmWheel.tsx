import { useEffect, useRef, useState } from 'react'

import { clampBpm, MAX_BPM, MIN_BPM } from '@/lib/rhythm'
import { DRAG_DEADZONE_PX, cn } from '@/lib/utils'

type BpmWheelProps = {
  value: number
  onChange: (bpm: number) => void
  compact?: boolean
  faceBpm?: number
}

const NEIGHBORS = [-3, -2, -1, 0, 1, 2, 3] as const
const ITEM_PX = 22
/** Slow drags take more travel per BPM (the 7743a9e precision). */
const PX_PER_BPM = 16
const FLICK_WINDOW_MS = 90
const FLICK_PEAK_MS = 45
const FLICK_MIN_BPM_S = 18
const FLICK_MAX_BPM_S = 240
const FRICTION_FAST = 1.72
const FRICTION_SLOW = 3.6
const COAST_STOP_BPM_S = 2.6

type Sample = { t: number; y: number }

function coastFriction(bpmPerSec: number): number {
  const speed = Math.abs(bpmPerSec)
  const t = Math.min(1, speed / 220)
  return FRICTION_SLOW + (FRICTION_FAST - FRICTION_SLOW) * t * t
}

function boostFlick(rawBpmPerSec: number): number {
  const sign = rawBpmPerSec < 0 ? -1 : 1
  const speed = Math.abs(rawBpmPerSec)
  if (speed < FLICK_MIN_BPM_S) return 0
  const span = Math.max(1, FLICK_MAX_BPM_S - FLICK_MIN_BPM_S)
  const t = Math.min(1, (speed - FLICK_MIN_BPM_S) / span)
  const gain = 1.1 + 1.25 * t * t
  return sign * Math.min(FLICK_MAX_BPM_S, speed * gain)
}

function verticalSpeed(samples: Sample[]): number {
  if (samples.length < 2) return 0
  const first = samples[0]
  const last = samples[samples.length - 1]
  const dt = Math.max((last.t - first.t) / 1000, 0.008)
  const dy = first.y - last.y
  if (Math.abs(dy) < 1.2) return 0
  return dy / dt / PX_PER_BPM
}

export function BpmWheel({ value, onChange, compact = false, faceBpm }: BpmWheelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hitRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [coasting, setCoasting] = useState(false)
  const [visual, setVisual] = useState(value)
  const [shown, setShown] = useState(value)
  const editing = draft !== null
  const face = faceBpm ?? shown
  const center = Math.round(visual)
  const frac = visual - center

  const visualRef = useRef(value)
  const emittedRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const dragRef = useRef<{ y: number } | null>(null)
  const pendingRef = useRef<{ pointerId: number; y: number; x: number; tapEdit: boolean } | null>(null)
  const samplesRef = useRef<Sample[]>([])
  const movedRef = useRef(false)
  const velRef = useRef(0)
  const rafRef = useRef(0)
  const coastingRef = useRef(false)
  const draggingRef = useRef(false)
  const lastTsRef = useRef(0)
  const reducedRef = useRef(false)
  const editingRef = useRef(false)

  onChangeRef.current = onChange
  editingRef.current = editing

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      reducedRef.current = mq.matches
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const snapToEmitted = () => {
    visualRef.current = emittedRef.current
    setVisual(emittedRef.current)
  }

  const stopCoast = () => {
    coastingRef.current = false
    setCoasting(false)
    velRef.current = 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }

  const emitIfNeeded = (nextFloat: number) => {
    const clampedFloat = Math.min(MAX_BPM, Math.max(MIN_BPM, nextFloat))
    visualRef.current = clampedFloat
    setVisual(clampedFloat)
    const prev = emittedRef.current
    let dest = prev
    if (clampedFloat >= prev + 1 - 1e-9) {
      dest = Math.min(MAX_BPM, Math.floor(clampedFloat + 1e-9))
    } else if (clampedFloat <= prev - 1 + 1e-9) {
      dest = Math.max(MIN_BPM, Math.ceil(clampedFloat - 1e-9))
    }
    if (dest !== prev) {
      const dir = dest > prev ? 1 : -1
      for (let bpm = prev + dir; dir > 0 ? bpm <= dest : bpm >= dest; bpm += dir) {
        emittedRef.current = bpm
        onChangeRef.current(bpm)
        if (draggingRef.current && typeof navigator.vibrate === 'function') {
          navigator.vibrate(8)
        }
      }
      setShown(dest)
    }
    return clampedFloat
  }

  const coastFrame = (now: number) => {
    if (!coastingRef.current) return
    const dt = Math.min(0.032, Math.max(0.001, (now - lastTsRef.current) / 1000))
    lastTsRef.current = now
    const next = visualRef.current + velRef.current * dt
    if (next <= MIN_BPM) {
      emitIfNeeded(MIN_BPM)
      stopCoast()
      return
    }
    if (next >= MAX_BPM) {
      emitIfNeeded(MAX_BPM)
      stopCoast()
      return
    }
    velRef.current *= Math.exp(-coastFriction(velRef.current) * dt)
    emitIfNeeded(next)
    if (Math.abs(velRef.current) < COAST_STOP_BPM_S) {
      snapToEmitted()
      stopCoast()
      return
    }
    rafRef.current = requestAnimationFrame(coastFrame)
  }

  const startCoast = (bpmPerSec: number) => {
    if (reducedRef.current) {
      snapToEmitted()
      return
    }
    const velocity = boostFlick(bpmPerSec)
    if (Math.abs(velocity) < FLICK_MIN_BPM_S) {
      snapToEmitted()
      return
    }
    velRef.current = velocity
    coastingRef.current = true
    setCoasting(true)
    lastTsRef.current = performance.now()
    rafRef.current = requestAnimationFrame(coastFrame)
  }

  useEffect(() => {
    if (value === emittedRef.current) return
    stopCoast()
    emittedRef.current = value
    visualRef.current = value
    setVisual(value)
    setShown(value)
  }, [value])

  useEffect(
    () => () => {
      stopCoast()
    },
    [],
  )

  useEffect(() => {
    const node = hitRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (editingRef.current) return
      event.preventDefault()
      stopCoast()
      const dir = event.deltaY > 0 ? -1 : 1
      const steps = Math.max(1, Math.round(Math.abs(event.deltaY) / 48))
      emitIfNeeded(emittedRef.current + dir * steps)
    }
    const onTouchMove = (event: TouchEvent) => {
      if (editingRef.current) return
      event.preventDefault()
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    node.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      node.removeEventListener('wheel', onWheel)
      node.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  const flickVelocity = (): number => {
    const samples = samplesRef.current
    if (samples.length < 2) return 0
    const latest = samples[samples.length - 1]
    const windowed = samples.filter((sample) => sample.t >= latest.t - FLICK_WINDOW_MS)
    const used = windowed.length >= 2 ? windowed : samples
    const peak = used.filter((sample) => sample.t >= latest.t - FLICK_PEAK_MS)
    const sustained = verticalSpeed(used)
    const burst = peak.length >= 2 ? verticalSpeed(peak) : sustained
    return Math.abs(burst) > Math.abs(sustained) ? burst : sustained
  }

  const commitDraft = () => {
    if (draft === null) return
    const parsed = Number.parseInt(draft.replace(/[^\d]/g, ''), 10)
    setDraft(null)
    if (!Number.isFinite(parsed)) return
    const clamped = clampBpm(parsed)
    if (clamped !== emittedRef.current) onChange(clamped)
  }

  const endDrag = (flick: boolean, event?: { timeStamp: number; clientY: number }) => {
    if (event) samplesRef.current.push({ t: event.timeStamp, y: event.clientY })
    dragRef.current = null
    draggingRef.current = false
    setDragging(false)
    if (flick) startCoast(flickVelocity())
    else snapToEmitted()
    samplesRef.current = []
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-1.5 inset-x-1.5 h-3 rounded-full bg-black/55 blur-[5px]"
        />
        <div
          ref={hitRef}
          role="slider"
          aria-label="Tempo"
          aria-valuemin={MIN_BPM}
          aria-valuemax={MAX_BPM}
          aria-valuenow={shown}
          aria-disabled={editing}
          tabIndex={editing ? -1 : 0}
          data-visual-bpm={visual.toFixed(2)}
          data-coasting={coasting ? 'true' : 'false'}
          data-spinning={dragging ? 'true' : 'false'}
          data-tempo-hit="true"
          data-bpm-wheel="vertical"
          className={cn(
            'bpm-wheel relative touch-none select-none rounded-[26px] p-[5px] outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/70',
            compact ? 'h-[152px] w-[68px]' : 'h-[164px] w-[72px]',
          )}
          onPointerDown={(event) => {
            movedRef.current = false
            if (editing) return
            const target = event.target as HTMLElement
            if (target.closest('input')) return
            if (event.button !== 0) return
            event.preventDefault()
            try {
              event.currentTarget.setPointerCapture(event.pointerId)
            } catch {
              // Capture is best-effort; non-passive touchmove still holds the page.
            }
            stopCoast()
            pendingRef.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              tapEdit: Boolean(target.closest('[data-bpm-edit]')),
            }
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current
            if (drag && !editing) {
              const dy = drag.y - event.clientY
              drag.y = event.clientY
              samplesRef.current.push({ t: event.timeStamp, y: event.clientY })
              if (samplesRef.current.length > 24) samplesRef.current.shift()
              if (Math.abs(dy) > 1.5) movedRef.current = true
              emitIfNeeded(visualRef.current + dy / PX_PER_BPM)
              return
            }

            const pending = pendingRef.current
            if (!pending || pending.pointerId !== event.pointerId || editing) return
            const dist = Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
            if (dist < DRAG_DEADZONE_PX) return
            event.preventDefault()
            try {
              event.currentTarget.setPointerCapture(event.pointerId)
            } catch {
              // Already captured on pointerdown when the browser allows it.
            }
            stopCoast()
            snapToEmitted()
            dragRef.current = { y: event.clientY }
            samplesRef.current = [{ t: event.timeStamp, y: event.clientY }]
            draggingRef.current = true
            setDragging(true)
            pendingRef.current = null
          }}
          onPointerUp={(event) => {
            const pending = pendingRef.current
            pendingRef.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
            if (dragRef.current) {
              endDrag(true, event)
              return
            }
            if (pending?.tapEdit && !movedRef.current && !editing) {
              setDraft(String(shown))
            }
          }}
          onPointerCancel={(event) => {
            pendingRef.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
            if (dragRef.current) endDrag(false)
          }}
          onKeyDown={(event) => {
            if (editing) return
            if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
              event.preventDefault()
              stopCoast()
              emitIfNeeded(emittedRef.current + 1)
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
              event.preventDefault()
              stopCoast()
              emitIfNeeded(emittedRef.current - 1)
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              stopCoast()
              setDraft(String(shown))
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
              style={{
                perspective: '420px',
                transform: `translateY(${-frac * ITEM_PX}px)`,
              }}
            >
              {NEIGHBORS.map((offset) => {
                const bpm = center + offset
                const hidden = bpm < MIN_BPM || bpm > MAX_BPM
                const active = offset === 0
                return (
                  <span
                    key={offset}
                    data-bpm-tick={bpm}
                    className={cn(
                      'flex h-[22px] items-center font-semibold tabular-nums tracking-tight',
                      active ? 'text-[1.05rem] text-white' : 'text-[0.7rem] text-slate-500',
                      Math.abs(offset) === 1 && 'text-slate-300',
                      hidden && 'opacity-0',
                    )}
                    style={
                      hidden
                        ? undefined
                        : {
                            transform: `rotateX(${(offset - frac) * -16}deg) scale(${1 - Math.abs(offset - frac) * 0.07})`,
                            opacity: 1 - Math.abs(offset - frac) * 0.18,
                          }
                    }
                  >
                    {hidden ? '—' : active && editing ? (
                      <input
                        ref={inputRef}
                        aria-label="Custom tempo"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={draft ?? ''}
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
                        className="pointer-events-auto w-[2.6rem] bg-transparent text-center text-[1.05rem] font-bold tabular-nums text-white outline-none caret-[#C084FC]"
                      />
                    ) : active ? (
                      <button
                        type="button"
                        data-bpm-edit
                        aria-label="Edit tempo"
                        onClick={() => {
                          if (movedRef.current) return
                          setDraft(String(face))
                        }}
                        className="pointer-events-auto rounded-md px-0.5 text-[1.05rem] font-bold tabular-nums text-white"
                      >
                        {face}
                      </button>
                    ) : (
                      bpm
                    )}
                  </span>
                )
              })}
            </div>
            <div className="pointer-events-none absolute inset-x-[11px] top-1/2 z-10 h-[42px] -translate-y-1/2 rounded-[12px] bg-[#A855F7]/18 ring-1 ring-[#C084FC]/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_14px_rgba(168,85,247,0.28)]" />
            <div className="pointer-events-none absolute inset-x-3 top-1/2 z-20 h-px -translate-y-1/2 bg-white/35" />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 bg-gradient-to-b from-[#070a12] via-[#070a12]/55 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 bg-gradient-to-t from-[#070a12] via-[#070a12]/55 to-transparent" />
            <div className="pointer-events-none absolute inset-x-3 top-[7px] z-30 h-3 rounded-full bg-white/18 blur-[2px]" />
          </div>
        </div>
      </div>
    </div>
  )
}
