import { useEffect, useRef, useState } from 'react'

import { clampBpm, MAX_BPM, MIN_BPM } from '@/lib/rhythm'
import { cn } from '@/lib/utils'

type BpmWheelProps = {
  value: number
  onChange: (bpm: number) => void
}

const TICKS = 36
const DEG_PER_BPM = 10
const RAD_PER_BPM = (DEG_PER_BPM * Math.PI) / 180
const MIN_RADIUS = 28
const FLICK_WINDOW_MS = 70
const FLICK_MIN_BPM_S = 16
const FLICK_MAX_BPM_S = 92
const FRICTION = 2.85
const COAST_STOP_BPM_S = 2.4

type Sample = { t: number; x: number; y: number }

function unwrapDelta(from: number, to: number): number {
  let delta = to - from
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

function pointAngle(x: number, y: number, cx: number, cy: number): number | null {
  const dx = x - cx
  const dy = y - cy
  if (Math.hypot(dx, dy) < MIN_RADIUS) return null
  return Math.atan2(dy, dx)
}

export function BpmWheel({ value, onChange }: BpmWheelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hitRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [coasting, setCoasting] = useState(false)
  const [visual, setVisual] = useState(value)
  const [shown, setShown] = useState(value)
  const editing = draft !== null
  const live = dragging || coasting
  const ringAngle = (visual - MIN_BPM) * DEG_PER_BPM

  const visualRef = useRef(value)
  const emittedRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const dragRef = useRef<{ x: number; y: number; angle: number } | null>(null)
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
    let next = visualRef.current + velRef.current * dt
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
    velRef.current *= Math.exp(-FRICTION * dt)
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
    const velocity = Math.max(-FLICK_MAX_BPM_S, Math.min(FLICK_MAX_BPM_S, bpmPerSec))
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

  useEffect(() => () => stopCoast(), [])

  const hitCenter = () => {
    const node = hitRef.current
    if (!node) return { x: 0, y: 0 }
    const rect = node.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }

  useEffect(() => {
    const node = hitRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (editingRef.current) return
      event.preventDefault()
      stopCoast()
      const { x: cx } = hitCenter()
      const onRight = event.clientX >= cx
      const down = event.deltaY > 0
      const clockwise = onRight ? down : !down
      const steps = Math.max(1, Math.round(Math.abs(event.deltaY) / 48))
      emitIfNeeded(emittedRef.current + (clockwise ? 1 : -1) * steps)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  const flickVelocity = (): number => {
    const samples = samplesRef.current
    if (samples.length < 2) return 0
    const latest = samples[samples.length - 1]
    const cutoff = latest.t - FLICK_WINDOW_MS
    const windowed = samples.filter((sample) => sample.t >= cutoff)
    const used = windowed.length >= 2 ? windowed : samples
    const { x: cx, y: cy } = hitCenter()
    let total = 0
    let prev = pointAngle(used[0].x, used[0].y, cx, cy)
    for (let i = 1; i < used.length; i += 1) {
      const next = pointAngle(used[i].x, used[i].y, cx, cy)
      if (prev == null || next == null) {
        prev = next
        continue
      }
      total += unwrapDelta(prev, next)
      prev = next
    }
    const dt = Math.max((used[used.length - 1].t - used[0].t) / 1000, 0.008)
    if (Math.abs(total) < 0.04) return 0
    return total / dt / RAD_PER_BPM
  }

  const commitDraft = () => {
    if (draft === null) return
    const parsed = Number.parseInt(draft.replace(/[^\d]/g, ''), 10)
    setDraft(null)
    if (!Number.isFinite(parsed)) return
    const clamped = clampBpm(parsed)
    if (clamped !== emittedRef.current) onChange(clamped)
  }

  const endDrag = (flick: boolean, event?: { timeStamp: number; clientX: number; clientY: number }) => {
    if (event) samplesRef.current.push({ t: event.timeStamp, x: event.clientX, y: event.clientY })
    dragRef.current = null
    draggingRef.current = false
    setDragging(false)
    if (flick) startCoast(flickVelocity())
    else snapToEmitted()
    samplesRef.current = []
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative size-[176px] sm:size-[188px]">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-1 left-1/2 h-4 w-28 -translate-x-1/2 rounded-full bg-black/50 blur-md"
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
          data-tempo-hit="true"
          className="bpm-dial-hit absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:[&_.bpm-dial]:ring-2 focus-visible:[&_.bpm-dial]:ring-[#A855F7]/70"
          onPointerDown={(event) => {
            movedRef.current = false
            stopCoast()
            snapToEmitted()
            if (editing) return
            if ((event.target as HTMLElement).closest('button, input')) return
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            const { x: cx, y: cy } = hitCenter()
            const angle = pointAngle(event.clientX, event.clientY, cx, cy)
            dragRef.current = {
              x: event.clientX,
              y: event.clientY,
              angle: angle ?? Math.atan2(event.clientY - cy, event.clientX - cx),
            }
            samplesRef.current = [{ t: event.timeStamp, x: event.clientX, y: event.clientY }]
            draggingRef.current = true
            setDragging(true)
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current
            if (!drag || editing) return
            const { x: cx, y: cy } = hitCenter()
            const nextAngle = pointAngle(event.clientX, event.clientY, cx, cy)
            samplesRef.current.push({ t: event.timeStamp, x: event.clientX, y: event.clientY })
            if (samplesRef.current.length > 16) samplesRef.current.shift()
            const dist = Math.hypot(event.clientX - drag.x, event.clientY - drag.y)
            if (dist > 2) movedRef.current = true
            drag.x = event.clientX
            drag.y = event.clientY
            if (nextAngle == null) return
            const delta = unwrapDelta(drag.angle, nextAngle)
            drag.angle = nextAngle
            emitIfNeeded(visualRef.current + delta / RAD_PER_BPM)
          }}
          onPointerUp={(event) => endDrag(true, event)}
          onPointerCancel={() => endDrag(false)}
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
          <div className="bpm-dial pointer-events-none relative size-[176px] select-none rounded-full sm:size-[188px]">
            <span aria-hidden className="bpm-dial-pip" />
            <div
              aria-hidden
              data-ring-angle={ringAngle}
              className={cn('bpm-dial-ring', live ? 'bpm-dial-ring-live' : 'bpm-dial-ring-smooth')}
              style={{ transform: `rotate(${ringAngle}deg)` }}
            >
              <span
                className="bpm-dial-index"
                style={{
                  transform: `rotate(0deg) translateY(calc(-1 * var(--ring-radius)))`,
                }}
              />
              {Array.from({ length: TICKS }, (_, index) => {
                const major = index % 3 === 0
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
                    className="pointer-events-auto mt-0.5 w-[5.2rem] bg-transparent text-center text-5xl font-bold tabular-nums tracking-tight text-white outline-none caret-[#C084FC]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (movedRef.current) return
                      setDraft(String(shown))
                    }}
                    className="pointer-events-auto mt-0.5 rounded-xl px-2 text-5xl font-bold tabular-nums tracking-tight text-white"
                  >
                    {shown}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
