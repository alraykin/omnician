import { memo, useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'

import { type TransportClock, type PlayheadStore } from '@/hooks/useRhythmEngine'
import {
  beatBoxView,
  inputSlotFromX,
  type InputDivision,
} from '@/lib/beat-boxes'
import { BAR_LONG_PRESS_MS, MOVE_ARM_MS } from '@/lib/bar-press'
import {
  editorBarOffsetsPx,
  editorBarWidthPx,
  editorBeatWidthPx,
  editorPatternWidthPx,
  followPlayheadScroll,
  fracInBar,
  playheadOffsetPx,
} from '@/lib/editor-playhead'
import { HOLD_NUDGE_CLASS } from '@/lib/hold-repeat'
import {
  VOICE_LABELS,
  VOICES,
  type RhythmBar,
  type VoiceId,
} from '@/lib/rhythm'
import { TAP_SLOP_PX, accumulatedScroll, activateOnPointer, cn, isCoarsePointer } from '@/lib/utils'

type SlotCell = {
  bar: number
  voice: VoiceId
  beat: number
  slot: number
  filled: boolean
  soft: boolean
}

type PendingPaint = {
  pointerId: number
  x: number
  y: number
  scroll: number
  scrollX: number
  bar: number
  voice: VoiceId
  beat: number
  slot: number
  filled: boolean
  soft: boolean
  coarse: boolean
  engaged: boolean
  moving: boolean
  moveArmed: boolean
  ignored: boolean
  softened: boolean
}

const HIT_INSET_PX = 2

function HitDot({
  soft,
  className,
  style,
}: {
  soft: boolean
  className?: string
  style?: { left: string }
}) {
  return (
    <span
      data-hit-dot
      data-hit-align="start"
      data-soft={soft ? '1' : '0'}
      className={cn(
        'aspect-square h-auto w-3 max-w-full shrink-0 rounded-full',
        soft ? 'bg-[#6D28D9]/50' : 'bg-[#A855F7]',
        className,
      )}
      style={style}
    />
  )
}

function lightHaptic() {
  try {
    navigator.vibrate?.(10)
  } catch {
    /* optional */
  }
}

function needsMoveArm(pointerType: string) {
  return pointerType === 'touch' || (pointerType !== 'mouse' && isCoarsePointer())
}

function sameSlot(a: Pick<SlotCell, 'bar' | 'voice' | 'beat' | 'slot'>, b: Pick<SlotCell, 'bar' | 'voice' | 'beat' | 'slot'>) {
  return a.bar === b.bar && a.voice === b.voice && a.beat === b.beat && a.slot === b.slot
}

function accumulatedScrollX(node: EventTarget | null): number {
  let total = typeof window === 'undefined' ? 0 : window.scrollX
  let el: Element | null = node instanceof Element ? node : null
  while (el) {
    total += el.scrollLeft
    el = el.parentElement
  }
  return total
}

function readSlot(node: Element | null, clientX: number, input: InputDivision): SlotCell | null {
  const box = node?.closest('[data-beat-box]')
  if (!box) return null
  const voice = box.getAttribute('data-voice-cell')
  const beat = Number(box.getAttribute('data-beat'))
  const bar = Number(box.getAttribute('data-bar-index'))
  if (!voice || !Number.isInteger(beat) || !Number.isInteger(bar)) return null
  const rect = box.getBoundingClientRect()
  const slot = inputSlotFromX(clientX - rect.left, rect.width, input)
  const slotEl = box.querySelector(`[data-box-slot="${slot}"]`)
  const filled =
    slotEl?.getAttribute('data-filled') === '1' ||
    (box.getAttribute('data-input-filled')?.split(',').includes(String(slot)) ?? false)
  const soft = slotEl?.getAttribute('data-soft') === '1'
  return { bar, voice: voice as VoiceId, beat, slot, filled, soft }
}

function slotFromPoint(x: number, y: number, input: InputDivision, root?: HTMLElement | null) {
  const node = document.elementFromPoint(x, y)
  if (!node || (root && !root.contains(node))) return null
  return readSlot(node, x, input)
}

function voicePreviewHandlers(onPreview: (voice: VoiceId) => void, voice: VoiceId) {
  const tap = activateOnPointer(() => onPreview(voice))
  return {
    ...tap,
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      tap.onPointerDown(event)
    },
  }
}

export const DrumEditorGrid = memo(function DrumEditorGrid({
  bars,
  input,
  playing,
  playheadStore,
  getClock,
  selectedBar,
  onSelectBar,
  onToggle,
  onToggleSoft,
  onMoveHit,
  onPreview,
}: {
  bars: readonly RhythmBar[]
  input: InputDivision
  playing: boolean
  playheadStore: PlayheadStore
  getClock: () => TransportClock
  selectedBar: number
  onSelectBar: (index: number) => void
  onToggle: (barIndex: number, voice: VoiceId, beat: number, slot: number, on: boolean, preview: boolean) => void
  onToggleSoft: (barIndex: number, voice: VoiceId, beat: number, slot: number) => void
  onMoveHit: (
    fromBar: number,
    fromVoice: VoiceId,
    fromBeat: number,
    fromSlot: number,
    toVoice: VoiceId,
    toBeat: number,
    toSlot: number,
    toBar: number,
  ) => void
  onPreview: (voice: VoiceId) => void
}) {
  const paintRef = useRef<{ voice: VoiceId; on: boolean; lastKey: string } | null>(null)
  const pendingRef = useRef<PendingPaint | null>(null)
  const holdTimerRef = useRef(0)
  const armTimerRef = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLSpanElement>(null)
  const pointerPosRef = useRef({ x: 0, y: 0 })
  const moveToRef = useRef<SlotCell | null>(null)
  const userScrollUntilRef = useRef(0)
  const lastAutoScrollRef = useRef(0)
  const [moving, setMoving] = useState<{
    soft: boolean
    fromBar: number
    fromVoice: VoiceId
    fromBeat: number
    fromSlot: number
  } | null>(null)
  const [moveTo, setMoveTo] = useState<SlotCell | null>(null)

  const beatPx = editorBeatWidthPx(input)
  const totalPx = editorPatternWidthPx(bars, input)
  const barOffsets = editorBarOffsetsPx(bars, input)

  const paintAt = useCallback(
    (bar: number, voice: VoiceId, beat: number, slot: number, preview: boolean) => {
      const stroke = paintRef.current
      if (!stroke || stroke.voice !== voice) return
      const key = `${bar}:${voice}:${beat}:${slot}`
      if (stroke.lastKey === key) return
      stroke.lastKey = key
      onToggle(bar, voice, beat, slot, stroke.on, preview)
    },
    [onToggle],
  )

  const placeGhost = useCallback((x: number, y: number) => {
    pointerPosRef.current = { x, y }
    const ghost = ghostRef.current
    if (!ghost) return
    ghost.style.left = `${x}px`
    ghost.style.top = `${y}px`
  }, [])

  const highlightTarget = useCallback((cell: SlotCell | null) => {
    const prev = moveToRef.current
    if (prev === cell) return
    if (prev && cell && sameSlot(prev, cell)) return
    if (!prev && !cell) return
    moveToRef.current = cell
    setMoveTo(cell)
  }, [])

  const endPaint = useCallback(() => {
    window.clearTimeout(holdTimerRef.current)
    window.clearTimeout(armTimerRef.current)
    paintRef.current = null
    pendingRef.current = null
    moveToRef.current = null
    setMoveTo(null)
    setMoving(null)
  }, [])

  const engagePaint = useCallback(
    (preview: boolean) => {
      const pending = pendingRef.current
      if (!pending || pending.engaged || pending.ignored || pending.softened) return
      window.clearTimeout(holdTimerRef.current)
      pending.engaged = true
      rootRef.current?.setPointerCapture(pending.pointerId)
      paintRef.current = { voice: pending.voice, on: !pending.filled, lastKey: '' }
      paintAt(pending.bar, pending.voice, pending.beat, pending.slot, preview)
    },
    [paintAt],
  )

  const beginMove = useCallback(
    (event: PointerEvent<HTMLDivElement>, pending: PendingPaint) => {
      window.clearTimeout(holdTimerRef.current)
      window.clearTimeout(armTimerRef.current)
      pending.moving = true
      pending.engaged = true
      try {
        rootRef.current?.setPointerCapture(pending.pointerId)
      } catch {
        /* test pointers */
      }
      const origin: SlotCell = {
        bar: pending.bar,
        voice: pending.voice,
        beat: pending.beat,
        slot: pending.slot,
        filled: pending.filled,
        soft: pending.soft,
      }
      moveToRef.current = origin
      setMoving({
        soft: pending.soft,
        fromBar: pending.bar,
        fromVoice: pending.voice,
        fromBeat: pending.beat,
        fromSlot: pending.slot,
      })
      setMoveTo(origin)
      placeGhost(event.clientX, event.clientY)
    },
    [placeGhost],
  )

  useEffect(() => {
    if (!moving) return
    placeGhost(pointerPosRef.current.x, pointerPosRef.current.y)
  }, [moving, placeGhost])

  useEffect(() => {
    const line = playheadRef.current
    const scroller = scrollRef.current
    if (!line || !scroller) return
    let raf = 0
    const tick = () => {
      const clock = getClock()
      const snap = playheadStore.getSnapshot()
      const live = playing && clock.playing && !clock.precount && snap.bar >= 0
      if (!live) {
        line.hidden = true
        line.setAttribute('data-playhead-on', '0')
      } else {
        const frac = fracInBar(clock)
        const x = playheadOffsetPx({ bars, input, barIndex: clock.barIndex, frac })
        line.hidden = false
        line.setAttribute('data-playhead-on', '1')
        line.setAttribute('data-playhead-x', String(Math.round(x)))
        line.style.transform = `translateX(${x}px)`
        if (Date.now() >= userScrollUntilRef.current) {
          const next = followPlayheadScroll({
            scrollLeft: scroller.scrollLeft,
            clientWidth: scroller.clientWidth,
            playheadX: x,
          })
          if (next != null && Math.abs(next - scroller.scrollLeft) > 2) {
            lastAutoScrollRef.current = next
            scroller.scrollLeft = next
          }
        }
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [bars, getClock, input, playheadStore, playing])

  const startPaint = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      const cell = readSlot(event.target instanceof Element ? event.target : null, event.clientX, input)
      if (!cell) return
      const coarse = needsMoveArm(event.pointerType)
      pendingRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scroll: accumulatedScroll(scrollRef.current),
        scrollX: accumulatedScrollX(scrollRef.current),
        bar: cell.bar,
        voice: cell.voice,
        beat: cell.beat,
        slot: cell.slot,
        filled: cell.filled,
        soft: cell.soft,
        coarse,
        engaged: false,
        moving: false,
        moveArmed: cell.filled && !coarse,
        ignored: false,
        softened: false,
      }
      window.clearTimeout(holdTimerRef.current)
      window.clearTimeout(armTimerRef.current)
      if (cell.filled && coarse) {
        armTimerRef.current = window.setTimeout(() => {
          const pending = pendingRef.current
          if (!pending || pending.engaged || pending.ignored || pending.softened || pending.moving) return
          pending.moveArmed = true
          lightHaptic()
        }, MOVE_ARM_MS)
      }
      holdTimerRef.current = window.setTimeout(() => {
        const pending = pendingRef.current
        if (!pending || pending.engaged || pending.ignored || pending.softened || pending.moving) return
        if (!pending.filled) return
        pending.softened = true
        onToggleSoft(pending.bar, pending.voice, pending.beat, pending.slot)
      }, BAR_LONG_PRESS_MS)
    },
    [input, onToggleSoft],
  )

  return (
    <div
      ref={rootRef}
      data-drum-editor-grid
      data-editor-one-row="1"
      data-drum-input={input}
      data-moving={moving ? '1' : '0'}
      data-bar-count={bars.length}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(HOLD_NUDGE_CLASS, 'flex min-h-0 min-w-0 flex-1')}
      onPointerDown={startPaint}
      onClick={(event) => event.preventDefault()}
      onPointerMove={(event) => {
        const pending = pendingRef.current
        if (pending?.moving) {
          if (event.cancelable) event.preventDefault()
          placeGhost(event.clientX, event.clientY)
          highlightTarget(slotFromPoint(event.clientX, event.clientY, input, rootRef.current))
          return
        }
        if (paintRef.current && pending?.engaged) {
          const cell = slotFromPoint(event.clientX, event.clientY, input, rootRef.current)
          if (cell) paintAt(cell.bar, cell.voice, cell.beat, cell.slot, false)
          return
        }
        if (!pending || pending.pointerId !== event.pointerId || pending.ignored || pending.engaged) return
        const scrolled =
          Math.abs(accumulatedScroll(scrollRef.current) - pending.scroll) > 1 ||
          Math.abs(accumulatedScrollX(scrollRef.current) - pending.scrollX) > 1
        if (scrolled) {
          pending.ignored = true
          userScrollUntilRef.current = Date.now() + 1600
          window.clearTimeout(holdTimerRef.current)
          window.clearTimeout(armTimerRef.current)
          return
        }
        const dx = event.clientX - pending.x
        const dy = event.clientY - pending.y
        const dist = Math.hypot(dx, dy)
        if (dist < TAP_SLOP_PX) return
        if (pending.filled && pending.moveArmed && !pending.softened) {
          if (event.cancelable) event.preventDefault()
          beginMove(event, pending)
          return
        }
        if (pending.filled && pending.coarse) {
          pending.ignored = true
          window.clearTimeout(holdTimerRef.current)
          window.clearTimeout(armTimerRef.current)
          return
        }
        if (Math.abs(dy) > Math.abs(dx) * 1.15) {
          pending.ignored = true
          window.clearTimeout(holdTimerRef.current)
          window.clearTimeout(armTimerRef.current)
          return
        }
        engagePaint(true)
      }}
      onPointerCancel={endPaint}
      onPointerUp={(event) => {
        const pending = pendingRef.current
        window.clearTimeout(holdTimerRef.current)
        window.clearTimeout(armTimerRef.current)
        if (pending && pending.pointerId === event.pointerId && pending.moving) {
          const cell = slotFromPoint(event.clientX, event.clientY, input, rootRef.current)
          if (cell && !sameSlot(pending, cell)) {
            onMoveHit(
              pending.bar,
              pending.voice,
              pending.beat,
              pending.slot,
              cell.voice,
              cell.beat,
              cell.slot,
              cell.bar,
            )
          }
          endPaint()
          return
        }
        if (pending && pending.pointerId === event.pointerId && !pending.engaged && !pending.ignored && !pending.softened) {
          const dist = Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
          const scrolled =
            Math.abs(accumulatedScroll(scrollRef.current) - pending.scroll) > 1 ||
            Math.abs(accumulatedScrollX(scrollRef.current) - pending.scrollX) > 1
          if (dist <= TAP_SLOP_PX && !scrolled) {
            paintRef.current = { voice: pending.voice, on: !pending.filled, lastKey: '' }
            paintAt(pending.bar, pending.voice, pending.beat, pending.slot, true)
          }
        }
        endPaint()
      }}
    >
      {moving ? (
        <span
          ref={ghostRef}
          data-hit-ghost
          data-soft={moving.soft ? '1' : '0'}
          className={cn(
            'pointer-events-none fixed z-50 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_4px_rgba(168,85,247,0.28)]',
            moving.soft ? 'bg-[#6D28D9]/50' : 'bg-[#A855F7]',
          )}
          style={{ left: pointerPosRef.current.x, top: pointerPosRef.current.y }}
        />
      ) : null}
      <div
        data-editor-labels
        className="grid w-[4.4rem] shrink-0 grid-rows-[1.15rem_repeat(14,minmax(0,1fr))] gap-y-px border-r border-white/8 bg-[#0B0F1A] pr-1"
      >
        <div aria-hidden />
        {VOICES.map((voice) => (
          <button
            key={voice}
            type="button"
            data-voice={voice}
            {...voicePreviewHandlers(onPreview, voice)}
            className="flex min-h-0 items-center truncate text-left text-[0.58rem] font-semibold leading-none text-slate-300"
          >
            {VOICE_LABELS[voice]}
          </button>
        ))}
      </div>
      <div
        ref={scrollRef}
        data-editor-scroll
        className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:thin]"
        style={{ touchAction: 'pan-x' }}
        onScroll={() => {
          const scroller = scrollRef.current
          if (!scroller) return
          if (Math.abs(scroller.scrollLeft - lastAutoScrollRef.current) > 8) {
            userScrollUntilRef.current = Date.now() + 1600
          }
        }}
      >
        <div
          data-editor-track
          className="relative grid h-full min-h-0 grid-rows-[1.15rem_repeat(14,minmax(0,1fr))] gap-y-px"
          style={{ width: totalPx, minWidth: totalPx }}
        >
          <div className="relative flex min-w-0">
            {bars.map((bar, barIndex) => (
              <div
                key={`beats-${barIndex}`}
                data-editor-bar-head={barIndex}
                className="flex shrink-0"
                style={{ width: editorBarWidthPx(bar.beats, input) }}
              >
                {Array.from({ length: bar.beats }, (_, beat) => (
                  <button
                    key={`${barIndex}-${beat}`}
                    type="button"
                    data-beat-label={beat + 1}
                    data-bar-index={barIndex}
                    onClick={() => onSelectBar(barIndex)}
                    className={cn(
                      'min-w-0 flex-1 text-left text-[0.55rem] font-semibold tabular-nums leading-none text-slate-500',
                      selectedBar === barIndex && 'text-[#E9D5FF]',
                    )}
                  >
                    {beat + 1}
                  </button>
                ))}
              </div>
            ))}
          </div>
          {VOICES.map((voice) => (
            <div key={voice} className="relative flex min-h-0 min-w-0">
              {bars.map((bar, barIndex) => {
                const hits = bar.pattern[voice] ?? []
                return (
                  <div
                    key={`${voice}-${barIndex}`}
                    data-editor-bar={barIndex}
                    data-editor-selected={selectedBar === barIndex ? '1' : '0'}
                    className={cn(
                      'flex min-h-0 shrink-0 gap-px px-px',
                      selectedBar === barIndex && 'bg-[#A855F7]/6',
                    )}
                    style={{ width: editorBarWidthPx(bar.beats, input) }}
                  >
                    {Array.from({ length: bar.beats }, (_, beat) => {
                      const view = beatBoxView(hits, beat, input)
                      const filledInput = Array.from({ length: input }, (_, slot) =>
                        hits.some((hit) => hit.beat === beat && hit.num * input === slot * hit.den),
                      )
                        .map((on, slot) => (on ? String(slot) : ''))
                        .filter(Boolean)
                        .join(',')
                      return (
                        <div
                          key={`${voice}-${barIndex}-${beat}`}
                          data-beat-box
                          data-voice-cell={voice}
                          data-beat={beat}
                          data-bar-index={barIndex}
                          data-division={view.division}
                          data-input-filled={filledInput}
                          className="relative flex min-h-0 min-w-0 flex-1 items-center overflow-hidden rounded-md border border-white/8 bg-white/[0.03] px-px"
                          style={{ width: beatPx }}
                        >
                          <div className="relative flex h-full w-full min-w-0 items-center gap-0.5">
                            {view.slots.map((slot) => {
                              const isSource =
                                moving?.fromVoice === voice &&
                                moving.fromBar === barIndex &&
                                moving.fromBeat === beat &&
                                moving.fromSlot === slot.slot
                              const isTarget =
                                moveTo?.voice === voice &&
                                moveTo.bar === barIndex &&
                                moveTo.beat === beat &&
                                moveTo.slot === slot.slot
                              return (
                                <span
                                  key={slot.slot}
                                  data-box-slot={slot.slot}
                                  data-filled={slot.filled ? '1' : '0'}
                                  data-soft={slot.soft ? '1' : '0'}
                                  {...(isSource ? { 'data-move-source': '1' } : {})}
                                  {...(isTarget ? { 'data-drop-target': '1' } : {})}
                                  className={cn(
                                    'flex h-[70%] min-h-3.5 min-w-0 flex-1 items-center justify-start overflow-hidden rounded-md border border-dashed border-white/18 bg-transparent pl-[2px]',
                                    isTarget && 'border-solid border-[#A855F7] bg-[#A855F7]/30',
                                  )}
                                >
                                  {slot.filled ? (
                                    <HitDot soft={slot.soft} className={isSource ? 'opacity-0' : undefined} />
                                  ) : null}
                                </span>
                              )
                            })}
                            {view.dots
                              ? view.dotsAt.map((frac, index) => (
                                  <HitDot
                                    key={`off-${frac}`}
                                    soft={view.dotsSoft[index] === true}
                                    className="pointer-events-none absolute top-1/2 -translate-y-1/2"
                                    style={{ left: `calc(${frac * 100}% + ${HIT_INSET_PX}px)` }}
                                  />
                                ))
                              : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
          <div
            ref={playheadRef}
            data-editor-playhead
            hidden
            className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-[#FF3B4A] shadow-[0_0_8px_rgba(255,59,74,0.55)]"
            style={{ left: 0, transform: `translateX(${barOffsets[0] ?? 0}px)` }}
          />
        </div>
      </div>
    </div>
  )
})
