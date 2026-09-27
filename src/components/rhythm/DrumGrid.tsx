import { memo, useCallback, useEffect, useRef, type PointerEvent } from 'react'

import { type PlayheadStore } from '@/hooks/useRhythmEngine'
import { VOICE_LABELS, VOICES, type VoiceId } from '@/lib/rhythm'
import { HOLD_TO_DRAG_MS, TAP_SLOP_PX, accumulatedScroll, activateOnPointer, cn } from '@/lib/utils'

type DrumGridPattern = Record<VoiceId, boolean[]>

type DrumGridProps = {
  beats: number
  subdivisionSteps: number
  pattern: DrumGridPattern
  playheadStore: PlayheadStore
  barIndex: number
  playing: boolean
  onPaint: (voice: VoiceId, step: number, on: boolean, preview: boolean) => void
  onPreview: (voice: VoiceId) => void
}

type PaintStroke = {
  voice: VoiceId
  on: boolean
  lastKey: string
}

type PendingPaint = {
  pointerId: number
  x: number
  y: number
  scroll: number
  cell: { voice: VoiceId; step: number; on: boolean }
  engaged: boolean
  ignored: boolean
}

function readCell(node: Element | null): { voice: VoiceId; step: number; on: boolean } | null {
  const cell = node?.closest('[data-grid-cell]')
  if (!cell) return null
  const voice = cell.getAttribute('data-voice-cell')
  const step = Number(cell.getAttribute('data-step'))
  if (!voice || !Number.isInteger(step)) return null
  return { voice: voice as VoiceId, step, on: cell.getAttribute('aria-pressed') === 'true' }
}

function cellFromPoint(x: number, y: number) {
  return readCell(document.elementFromPoint(x, y))
}

export const DrumGrid = memo(function DrumGrid({
  beats,
  subdivisionSteps,
  pattern,
  playheadStore,
  barIndex,
  playing,
  onPaint,
  onPreview,
}: DrumGridProps) {
  const steps = beats * subdivisionSteps
  const paintRef = useRef<PaintStroke | null>(null)
  const pendingRef = useRef<PendingPaint | null>(null)
  const holdTimerRef = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const paintAt = useCallback(
    (voice: VoiceId, step: number, preview: boolean) => {
      const stroke = paintRef.current
      if (!stroke || stroke.voice !== voice) return
      const key = `${voice}:${step}`
      if (stroke.lastKey === key) return
      stroke.lastKey = key
      onPaint(voice, step, stroke.on, preview)
    },
    [onPaint],
  )

  const endPaint = useCallback(() => {
    window.clearTimeout(holdTimerRef.current)
    paintRef.current = null
    pendingRef.current = null
  }, [])

  const engagePaint = useCallback(
    (preview: boolean) => {
      const pending = pendingRef.current
      if (!pending || pending.engaged || pending.ignored) return
      pending.engaged = true
      rootRef.current?.setPointerCapture(pending.pointerId)
      paintRef.current = { voice: pending.cell.voice, on: !pending.cell.on, lastKey: '' }
      paintAt(pending.cell.voice, pending.cell.step, preview)
    },
    [paintAt],
  )

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const nowClass = 'is-now'
    let painted: Element[] = []
    const apply = () => {
      const snap = playheadStore.getSnapshot()
      const live = playing && snap.bar === barIndex && snap.step >= 0
      for (const node of painted) node.classList.remove(nowClass)
      painted = []
      if (!live) {
        root.removeAttribute('data-playhead-step')
        return
      }
      root.setAttribute('data-playhead-step', String(snap.step))
      const nodes = root.querySelectorAll(`[data-grid-cell][data-step="${snap.step}"]`)
      nodes.forEach((node) => {
        node.classList.add(nowClass)
        painted.push(node)
      })
    }
    apply()
    return playheadStore.subscribe(apply)
  }, [playheadStore, barIndex, playing])

  const startPaint = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      const cell = readCell(event.target instanceof Element ? event.target : null)
      if (!cell) return
      pendingRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scroll: accumulatedScroll(rootRef.current),
        cell,
        engaged: false,
        ignored: false,
      }
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = window.setTimeout(() => engagePaint(true), HOLD_TO_DRAG_MS)
    },
    [engagePaint],
  )

  return (
    <div
      ref={rootRef}
      data-drum-grid
      data-bar-index={barIndex}
      className="max-h-[min(46vh,28rem)] max-w-full touch-manipulation overflow-x-auto overflow-y-auto pb-1 md:max-h-[min(50vh,32rem)] lg:max-h-[min(54vh,36rem)]"
      onPointerDown={startPaint}
      onClick={(event) => event.preventDefault()}
      onPointerMove={(event) => {
        const pending = pendingRef.current
        if (paintRef.current && pending?.engaged) {
          const cell = cellFromPoint(event.clientX, event.clientY)
          if (cell) paintAt(cell.voice, cell.step, false)
          return
        }
        if (!pending || pending.pointerId !== event.pointerId || pending.ignored || pending.engaged) return
        if (Math.abs(accumulatedScroll(rootRef.current) - pending.scroll) > 1) {
          pending.ignored = true
          window.clearTimeout(holdTimerRef.current)
          return
        }
        const dx = event.clientX - pending.x
        const dy = event.clientY - pending.y
        const dist = Math.hypot(dx, dy)
        if (dist < TAP_SLOP_PX) return
        if (Math.abs(dy) > Math.abs(dx) * 1.15) {
          pending.ignored = true
          window.clearTimeout(holdTimerRef.current)
          return
        }
        engagePaint(true)
      }}
      onPointerCancel={endPaint}
      onPointerUp={(event) => {
        const pending = pendingRef.current
        window.clearTimeout(holdTimerRef.current)
        if (
          pending &&
          pending.pointerId === event.pointerId &&
          !pending.engaged &&
          !pending.ignored
        ) {
          const dist = Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
          const scrolled = Math.abs(accumulatedScroll(rootRef.current) - pending.scroll) > 1
          if (dist <= TAP_SLOP_PX && !scrolled) {
            paintRef.current = { voice: pending.cell.voice, on: !pending.cell.on, lastKey: '' }
            paintAt(pending.cell.voice, pending.cell.step, true)
          }
        }
        endPaint()
      }}
    >
      <div className="grid w-full min-w-0 grid-cols-[4rem_minmax(0,1fr)] gap-x-0.5 gap-y-0.5 sm:grid-cols-[4.4rem_minmax(0,1fr)] md:grid-cols-[5.1rem_minmax(0,1fr)]">
        <div aria-hidden />
        <div className="mb-1.5 flex min-w-0 items-center gap-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-slate-500">
          {Array.from({ length: beats }, (_, beat) => (
            <span
              key={`beat-${beat}`}
              className="min-w-0 flex-1 text-center"
              style={{ flex: subdivisionSteps }}
            >
              {beat + 1}
            </span>
          ))}
        </div>

        {VOICES.map((voice) => (
          <div key={voice} className="contents">
            <button
              type="button"
              data-voice={voice}
              {...(() => {
                const tap = activateOnPointer(() => onPreview(voice))
                return {
                  ...tap,
                  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
                    event.stopPropagation()
                    tap.onPointerDown(event)
                  },
                }
              })()}
              className="min-w-0 touch-manipulation whitespace-nowrap rounded-md py-1 pr-0.5 text-left text-[0.56rem] font-semibold leading-none tracking-tight text-slate-300 hover:bg-white/6 hover:text-white sm:text-[0.62rem] md:text-[0.68rem] lg:text-xs"
            >
              {VOICE_LABELS[voice]}
            </button>
            <div className="flex min-w-0 touch-none gap-0.5 py-px">
              {Array.from({ length: beats }, (_, beat) => (
                <div key={`${voice}-${beat}`} className="flex min-w-0 gap-px" style={{ flex: subdivisionSteps }}>
                  {Array.from({ length: subdivisionSteps }, (_, offset) => {
                    const step = beat * subdivisionSteps + offset
                    if (step >= steps) return null
                    return (
                      <DrumCell
                        key={step}
                        voice={voice}
                        step={step}
                        beat={beat}
                        offset={offset}
                        on={Boolean(pattern[voice]?.[step])}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

const DrumCell = memo(function DrumCell({
  voice,
  step,
  beat,
  offset,
  on,
}: {
  voice: VoiceId
  step: number
  beat: number
  offset: number
  on: boolean
}) {
  return (
    <button
      type="button"
      data-grid-cell
      data-voice-cell={voice}
      data-step={step}
      aria-pressed={on}
      aria-label={`${VOICE_LABELS[voice]}, beat ${beat + 1}, slot ${offset + 1}${on ? ', on' : ', off'}`}
      className={cn(
        'h-5 min-w-0 flex-1 touch-manipulation rounded-md border sm:h-6 md:h-7 lg:h-8',
        on ? 'border-[#A855F7] bg-[#A855F7]' : offset === 0 ? 'border-white/14 bg-white/8' : 'border-white/8 bg-white/4',
      )}
    />
  )
})
