import { useEffect, useRef, useState } from 'react'

import {
  ITEM_PX,
  PX_PER_BPM,
  SNAP_BPM_S,
  TAP_SLOP_PX,
  bpmDeltaFromFinger,
  centeredBpm,
  coastFriction,
  COAST_STOP_BPM_S,
  FLICK_MIN_BPM_S,
  flickVelocityBpm,
  stripOffsetPx,
  type WheelSample,
} from '@/lib/bpm-wheel-physics'
import { clampBpm, MAX_BPM, MIN_BPM } from '@/lib/rhythm'
import { cn } from '@/lib/utils'

type BpmWheelProps = {
  value: number
  onChange: (bpm: number) => void
  compact?: boolean
  faceBpm?: number
}

const NEIGHBORS = [-2, -1, 0, 1, 2] as const

export function BpmWheel({ value, onChange, compact = false }: BpmWheelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hitRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [coasting, setCoasting] = useState(false)
  const [visual, setVisual] = useState(value)
  const [shown, setShown] = useState(value)
  const editing = draft !== null
  const center = Math.round(visual)
  const frac = visual - center
  const stripY = stripOffsetPx(visual)

  const visualRef = useRef(value)
  const emittedRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const samplesRef = useRef<WheelSample[]>([])
  const movedRef = useRef(false)
  const velRef = useRef(0)
  const rafRef = useRef(0)
  const coastingRef = useRef(false)
  const snappingRef = useRef(false)
  const draggingRef = useRef(false)
  const lastTsRef = useRef(0)
  const lastYRef = useRef(0)
  const lastMoveTsRef = useRef(0)
  const reducedRef = useRef(false)
  const editingRef = useRef(false)
  const inputKindRef = useRef<'none' | 'touch' | 'mouse'>('none')
  const pointerIdRef = useRef<number | null>(null)
  const startRef = useRef<{ x: number; y: number; tapEdit: boolean } | null>(null)
  const shownRef = useRef(value)

  onChangeRef.current = onChange
  editingRef.current = editing
  shownRef.current = shown

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
    snappingRef.current = false
    setCoasting(false)
    velRef.current = 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }

  const emitIfNeeded = (nextFloat: number) => {
    const clampedFloat = Math.min(MAX_BPM, Math.max(MIN_BPM, nextFloat))
    visualRef.current = clampedFloat
    setVisual(clampedFloat)
    const dest = centeredBpm(clampedFloat, MIN_BPM, MAX_BPM)
    const prev = emittedRef.current
    if (dest !== prev) {
      const dir = dest > prev ? 1 : -1
      for (let bpm = prev + dir; dir > 0 ? bpm <= dest : bpm >= dest; bpm += dir) {
        emittedRef.current = bpm
        onChangeRef.current(bpm)
      }
      if (draggingRef.current && typeof navigator.vibrate === 'function') {
        navigator.vibrate(8)
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
      startSnap()
      return
    }
    rafRef.current = requestAnimationFrame(coastFrame)
  }

  const snapFrame = (now: number) => {
    if (!snappingRef.current) return
    const dt = Math.min(0.032, Math.max(0.001, (now - lastTsRef.current) / 1000))
    lastTsRef.current = now
    const target = centeredBpm(visualRef.current, MIN_BPM, MAX_BPM)
    const delta = target - visualRef.current
    if (Math.abs(delta) < 0.012) {
      emitIfNeeded(target)
      stopCoast()
      return
    }
    const step = Math.sign(delta) * SNAP_BPM_S * dt
    const next = Math.abs(step) >= Math.abs(delta) ? target : visualRef.current + step
    emitIfNeeded(next)
    rafRef.current = requestAnimationFrame(snapFrame)
  }

  const startSnap = () => {
    if (reducedRef.current) {
      snapToEmitted()
      return
    }
    const target = centeredBpm(visualRef.current, MIN_BPM, MAX_BPM)
    if (Math.abs(target - visualRef.current) < 0.012) {
      emitIfNeeded(target)
      stopCoast()
      return
    }
    snappingRef.current = true
    coastingRef.current = false
    setCoasting(false)
    lastTsRef.current = performance.now()
    rafRef.current = requestAnimationFrame(snapFrame)
  }

  const startCoast = (bpmPerSec: number) => {
    if (reducedRef.current) {
      startSnap()
      return
    }
    if (Math.abs(bpmPerSec) < FLICK_MIN_BPM_S) {
      startSnap()
      return
    }
    velRef.current = bpmPerSec
    coastingRef.current = true
    setCoasting(true)
    lastTsRef.current = performance.now()
    rafRef.current = requestAnimationFrame(coastFrame)
  }

  useEffect(() => {
    if (value === emittedRef.current) return
    if (draggingRef.current || coastingRef.current || snappingRef.current) return
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

  const beginFinger = (x: number, y: number, time: number, tapEdit: boolean) => {
    stopCoast()
    movedRef.current = false
    lastYRef.current = y
    lastMoveTsRef.current = time
    samplesRef.current = [{ t: time, y }]
    startRef.current = { x, y, tapEdit }
    draggingRef.current = true
    setDragging(true)
  }

  const moveFinger = (y: number, time: number) => {
    if (!draggingRef.current || editingRef.current) return
    const dy = y - lastYRef.current
    const dt = (time - lastMoveTsRef.current) / 1000
    lastYRef.current = y
    lastMoveTsRef.current = time
    samplesRef.current.push({ t: time, y })
    if (samplesRef.current.length > 32) samplesRef.current.shift()
    const start = startRef.current
    if (start && Math.hypot(0, y - start.y) > TAP_SLOP_PX) movedRef.current = true
    if (Math.abs(dy) < 0.01) return
    emitIfNeeded(visualRef.current + bpmDeltaFromFinger(dy, dt))
  }

  const endFinger = (y: number, time: number, flick: boolean) => {
    if (!draggingRef.current) return
    samplesRef.current.push({ t: time, y })
    draggingRef.current = false
    setDragging(false)
    inputKindRef.current = 'none'
    pointerIdRef.current = null
    const start = startRef.current
    startRef.current = null
    if (flick) startCoast(flickVelocityBpm(samplesRef.current, time))
    else startSnap()
    samplesRef.current = []
    return start
  }

  useEffect(() => {
    const node = hitRef.current
    if (!node) return

    const onTouchStart = (event: TouchEvent) => {
      if (editingRef.current) return
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      if (!touch) return
      event.preventDefault()
      if (inputKindRef.current === 'mouse') return
      inputKindRef.current = 'touch'
      const target = event.target as HTMLElement
      beginFinger(touch.clientX, touch.clientY, performance.now(), Boolean(target.closest('[data-bpm-edit]')))
    }

    const onTouchMove = (event: TouchEvent) => {
      if (editingRef.current) return
      event.preventDefault()
      if (inputKindRef.current !== 'touch') return
      const touch = event.touches[0]
      if (!touch) return
      moveFinger(touch.clientY, performance.now())
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (inputKindRef.current !== 'touch') return
      event.preventDefault()
      const touch = event.changedTouches[0]
      const start = endFinger(touch?.clientY ?? lastYRef.current, performance.now(), true)
      if (start?.tapEdit && !movedRef.current && !editingRef.current) {
        setDraft(String(shownRef.current))
      }
    }

    const onTouchCancel = () => {
      if (inputKindRef.current !== 'touch') return
      endFinger(lastYRef.current, performance.now(), false)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (editingRef.current) return
      if (event.button !== 0) return
      const target = event.target as HTMLElement
      if (target.closest('input')) return
      try {
        node.setPointerCapture(event.pointerId)
      } catch {
        // Capture is best-effort; touch listeners still hold the page.
      }
      if (event.pointerType === 'touch') {
        pointerIdRef.current = event.pointerId
        return
      }
      if (inputKindRef.current === 'touch') return
      event.preventDefault()
      inputKindRef.current = 'mouse'
      pointerIdRef.current = event.pointerId
      beginFinger(event.clientX, event.clientY, performance.now(), Boolean(target.closest('[data-bpm-edit]')))
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || inputKindRef.current !== 'mouse') return
      if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) return
      const coalesced =
        typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event]
      for (const item of coalesced) {
        moveFinger(item.clientY, performance.now())
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      if (node.hasPointerCapture(event.pointerId)) {
        node.releasePointerCapture(event.pointerId)
      }
      if (event.pointerType === 'touch') return
      if (inputKindRef.current !== 'mouse') return
      const start = endFinger(event.clientY, performance.now(), true)
      if (start?.tapEdit && !movedRef.current && !editingRef.current) {
        setDraft(String(shownRef.current))
      }
    }

    const onPointerCancel = (event: PointerEvent) => {
      if (node.hasPointerCapture(event.pointerId)) {
        node.releasePointerCapture(event.pointerId)
      }
      if (inputKindRef.current !== 'mouse') return
      endFinger(event.clientY, performance.now(), false)
    }

    const onWheel = (event: WheelEvent) => {
      if (editingRef.current) return
      event.preventDefault()
      stopCoast()
      const dir = event.deltaY > 0 ? -1 : 1
      const steps = Math.max(1, Math.round(Math.abs(event.deltaY) / 48))
      emitIfNeeded(emittedRef.current + dir * steps)
    }

    const opts: AddEventListenerOptions = { passive: false, capture: true }
    node.addEventListener('touchstart', onTouchStart, opts)
    node.addEventListener('touchmove', onTouchMove, opts)
    node.addEventListener('touchend', onTouchEnd, opts)
    node.addEventListener('touchcancel', onTouchCancel, opts)
    node.addEventListener('pointerdown', onPointerDown, opts)
    node.addEventListener('pointermove', onPointerMove, opts)
    node.addEventListener('pointerup', onPointerUp, opts)
    node.addEventListener('pointercancel', onPointerCancel, opts)
    node.addEventListener('wheel', onWheel, opts)
    return () => {
      node.removeEventListener('touchstart', onTouchStart, opts)
      node.removeEventListener('touchmove', onTouchMove, opts)
      node.removeEventListener('touchend', onTouchEnd, opts)
      node.removeEventListener('touchcancel', onTouchCancel, opts)
      node.removeEventListener('pointerdown', onPointerDown, opts)
      node.removeEventListener('pointermove', onPointerMove, opts)
      node.removeEventListener('pointerup', onPointerUp, opts)
      node.removeEventListener('pointercancel', onPointerCancel, opts)
      node.removeEventListener('wheel', onWheel, opts)
    }
  }, [])

  const commitDraft = () => {
    if (draft === null) return
    const parsed = Number.parseInt(draft.replace(/[^\d]/g, ''), 10)
    setDraft(null)
    if (!Number.isFinite(parsed)) return
    const clamped = clampBpm(parsed)
    if (clamped !== emittedRef.current) onChange(clamped)
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
          data-higher-below="true"
          data-px-per-bpm={PX_PER_BPM}
          style={{
            touchAction: 'none',
            ['--wheel-y' as string]: `${(visual * ITEM_PX).toFixed(2)}px`,
          }}
          className={cn(
            'bpm-wheel relative select-none rounded-[26px] p-[5px] outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/70',
            compact ? 'h-[176px] w-[76px]' : 'h-[176px] w-[76px]',
          )}
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
              data-wheel-strip
              style={{
                perspective: '420px',
                transform: `translateY(${stripY}px)`,
              }}
            >
              {NEIGHBORS.map((offset) => {
                const bpm = center + offset
                const hidden = bpm < MIN_BPM || bpm > MAX_BPM
                const dist = Math.abs(offset - frac)
                return (
                  <span
                    key={offset}
                    data-bpm-tick={bpm}
                    className={cn(
                      'pointer-events-none flex h-[28px] items-center font-semibold tabular-nums tracking-tight',
                      dist < 0.55
                        ? 'text-[1.05rem] text-white'
                        : dist < 1.25
                          ? 'text-[0.78rem] text-slate-300'
                          : 'text-[0.68rem] text-slate-500',
                      hidden && 'opacity-0',
                    )}
                    style={
                      hidden
                        ? undefined
                        : {
                            transform: `rotateX(${(offset - frac) * -18}deg) scale(${1 - dist * 0.08})`,
                            opacity: 1 - dist * 0.22,
                          }
                    }
                  >
                    {hidden ? '—' : bpm}
                  </span>
                )
              })}
            </div>
            {editing ? (
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
                className="absolute inset-x-[11px] top-1/2 z-30 h-[42px] -translate-y-1/2 rounded-[12px] bg-[#0b0f1a]/80 text-center text-[1.05rem] font-bold tabular-nums text-white outline-none caret-[#C084FC]"
              />
            ) : (
              <button
                type="button"
                data-bpm-edit
                aria-label="Edit tempo"
                onClick={() => {
                  if (movedRef.current) return
                  setDraft(String(shown))
                }}
                className="absolute inset-x-[11px] top-1/2 z-30 h-[42px] -translate-y-1/2 rounded-[12px] bg-transparent"
              />
            )}
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
