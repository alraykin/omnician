import { useEffect, useRef, useState } from 'react'

import { clampBpm, MAX_BPM, MIN_BPM } from '@/lib/rhythm'
import { DRAG_DEADZONE_PX, HOLD_TO_DRAG_MS, accumulatedScroll, cn } from '@/lib/utils'

type BpmWheelProps = {
  value: number
  onChange: (bpm: number) => void
}

const VISIBLE_TICKS = 36
const DEG_PER_BPM = 10
const RAD_PER_BPM = (DEG_PER_BPM * Math.PI) / 180
const MIN_RADIUS = 28
const FLICK_WINDOW_MS = 90
const FLICK_PEAK_MS = 45
const FLICK_MIN_BPM_S = 18
const FLICK_MAX_BPM_S = 240
const FRICTION_FAST = 1.72
const FRICTION_SLOW = 3.6
const COAST_STOP_BPM_S = 2.6

type Sample = { t: number; x: number; y: number }

function coastFriction(bpmPerSec: number): number {
  const speed = Math.abs(bpmPerSec)
  const t = Math.min(1, speed / 220)
  return FRICTION_SLOW + (FRICTION_FAST - FRICTION_SLOW) * t * t
}

/** Light throws stay near measured speed; hard throws get extra reach. */
function boostFlick(rawBpmPerSec: number): number {
  const sign = rawBpmPerSec < 0 ? -1 : 1
  const speed = Math.abs(rawBpmPerSec)
  if (speed < FLICK_MIN_BPM_S) return 0
  const span = Math.max(1, FLICK_MAX_BPM_S - FLICK_MIN_BPM_S)
  const t = Math.min(1, (speed - FLICK_MIN_BPM_S) / span)
  const gain = 1.1 + 1.25 * t * t
  return sign * Math.min(FLICK_MAX_BPM_S, speed * gain)
}

function angularSpeed(samples: Sample[], cx: number, cy: number): number {
  if (samples.length < 2) return 0
  let total = 0
  let prev = pointAngle(samples[0].x, samples[0].y, cx, cy)
  for (let i = 1; i < samples.length; i += 1) {
    const next = pointAngle(samples[i].x, samples[i].y, cx, cy)
    if (prev == null || next == null) {
      prev = next
      continue
    }
    total += unwrapDelta(prev, next)
    prev = next
  }
  const dt = Math.max((samples[samples.length - 1].t - samples[0].t) / 1000, 0.008)
  if (Math.abs(total) < 0.04) return 0
  return total / dt / RAD_PER_BPM
}
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

  const visualRef = useRef(value)
  const emittedRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const dragRef = useRef<{ x: number; y: number; angle: number } | null>(null)
  const pendingRef = useRef<{
    pointerId: number
    x: number
    y: number
    scroll: number
    armed: boolean
    ignored: boolean
    inner: boolean
  } | null>(null)
  const holdTimerRef = useRef(0)
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
      window.clearTimeout(holdTimerRef.current)
      stopCoast()
    },
    [],
  )

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
    const windowed = samples.filter((sample) => sample.t >= latest.t - FLICK_WINDOW_MS)
    const used = windowed.length >= 2 ? windowed : samples
    const peak = used.filter((sample) => sample.t >= latest.t - FLICK_PEAK_MS)
    const { x: cx, y: cy } = hitCenter()
    const sustained = angularSpeed(used, cx, cy)
    const burst = peak.length >= 2 ? angularSpeed(peak, cx, cy) : sustained
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
      <div className="relative size-[152px] sm:size-[188px] lg:size-[216px]">
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
          data-spinning={dragging ? 'true' : 'false'}
          data-tempo-hit="true"
          className="bpm-dial-hit absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:[&_.bpm-dial]:ring-2 focus-visible:[&_.bpm-dial]:ring-[#A855F7]/70"
          onPointerDown={(event) => {
            movedRef.current = false
            if (editing) return
            if ((event.target as HTMLElement).closest('button, input')) return
            if (event.button !== 0) return
            const { x: cx, y: cy } = hitCenter()
            const radius = Math.hypot(event.clientX - cx, event.clientY - cy)
            pendingRef.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              scroll: accumulatedScroll(event.currentTarget),
              armed: false,
              ignored: false,
              inner: radius < MIN_RADIUS,
            }
            window.clearTimeout(holdTimerRef.current)
            holdTimerRef.current = window.setTimeout(() => {
              const pending = pendingRef.current
              if (!pending || pending.ignored || pending.inner) return
              pending.armed = true
            }, HOLD_TO_DRAG_MS)
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current
            if (drag && !editing) {
              const { x: cx, y: cy } = hitCenter()
              const nextAngle = pointAngle(event.clientX, event.clientY, cx, cy)
              samplesRef.current.push({ t: event.timeStamp, x: event.clientX, y: event.clientY })
              if (samplesRef.current.length > 24) samplesRef.current.shift()
              const dist = Math.hypot(event.clientX - drag.x, event.clientY - drag.y)
              if (dist > 2) movedRef.current = true
              drag.x = event.clientX
              drag.y = event.clientY
              if (nextAngle == null) return
              const delta = unwrapDelta(drag.angle, nextAngle)
              drag.angle = nextAngle
              emitIfNeeded(visualRef.current + delta / RAD_PER_BPM)
              return
            }

            const pending = pendingRef.current
            if (!pending || pending.pointerId !== event.pointerId || editing) return
            if (pending.ignored || pending.inner) return
            if (Math.abs(accumulatedScroll(event.currentTarget) - pending.scroll) > 1) {
              pending.ignored = true
              window.clearTimeout(holdTimerRef.current)
              return
            }
            const dx = event.clientX - pending.x
            const dy = event.clientY - pending.y
            const dist = Math.hypot(dx, dy)
            if (dist < DRAG_DEADZONE_PX) return
            const vertical = Math.abs(dy) > Math.abs(dx) * 1.2
            if (!pending.armed && vertical) {
              pending.ignored = true
              window.clearTimeout(holdTimerRef.current)
              return
            }
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            stopCoast()
            snapToEmitted()
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
            pendingRef.current = null
            window.clearTimeout(holdTimerRef.current)
          }}
          onPointerUp={(event) => {
            window.clearTimeout(holdTimerRef.current)
            pendingRef.current = null
            if (dragRef.current) endDrag(true, event)
          }}
          onPointerCancel={() => {
            window.clearTimeout(holdTimerRef.current)
            pendingRef.current = null
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
          <div className="bpm-dial pointer-events-none relative size-[152px] select-none rounded-full sm:size-[188px] lg:size-[216px]">
            <span aria-hidden className="bpm-dial-pip" />
            <div
              aria-hidden
              data-visual-bpm={visual.toFixed(2)}
              className={cn('bpm-dial-ring', live ? 'bpm-dial-ring-live' : 'bpm-dial-ring-smooth')}
            >
              {Array.from({ length: VISIBLE_TICKS }, (_, index) => {
                const bpm = Math.round(visual) + index - Math.floor(VISIBLE_TICKS / 2)
                const deg = (visual - bpm) * DEG_PER_BPM
                const kind = bpm % 10 === 0 ? 'ten' : bpm % 5 === 0 ? 'five' : 'one'
                const inRange = bpm >= MIN_BPM && bpm <= MAX_BPM
                const label = kind === 'ten' && inRange && Math.abs(deg) <= 70
                return (
                  <span
                    key={`${bpm}-${index}`}
                    data-tick-bpm={bpm}
                    data-tick-kind={kind}
                    className={cn(
                      'bpm-dial-tick',
                      kind === 'ten' && 'bpm-dial-tick-ten',
                      kind === 'five' && 'bpm-dial-tick-five',
                      kind === 'one' && 'bpm-dial-tick-one',
                      !inRange && 'opacity-20',
                    )}
                    style={{
                      transform: `rotate(${deg}deg) translateY(calc(-1 * var(--ring-radius)))`,
                    }}
                  >
                    {label ? (
                      <span
                        className="bpm-dial-tick-label"
                        style={{ transform: `rotate(${-deg}deg)` }}
                      >
                        {bpm}
                      </span>
                    ) : null}
                  </span>
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
                    className="pointer-events-auto mt-0.5 w-[5.2rem] bg-transparent text-center text-4xl font-bold tabular-nums tracking-tight text-white outline-none caret-[#C084FC] sm:text-5xl"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (movedRef.current) return
                      setDraft(String(shown))
                    }}
                    className="pointer-events-auto mt-0.5 rounded-xl px-2 text-4xl font-bold tabular-nums tracking-tight text-white sm:text-5xl"
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
