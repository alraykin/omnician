import { memo, useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'

import { CountStrip, HitDiamond, PlayheadLine, gridLineProps } from '@/components/rhythm/DrumFlatBits'
import { type TransportClock } from '@/hooks/useRhythmEngine'
import { beatBoxView, inputSlotFromX, type InputDivision } from '@/lib/beat-boxes'
import { BAR_LONG_PRESS_MS, MOVE_ARM_MS } from '@/lib/bar-press'
import { gridLineKind, isBarEndSlot } from '@/lib/drum-flat-grid'
import { fracInBar } from '@/lib/editor-playhead'
import { HOLD_NUDGE_CLASS } from '@/lib/hold-repeat'
import { VOICE_LABELS, VOICES, type RhythmBar, type VoiceId } from '@/lib/rhythm'
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

const SWIPE_PX = 56

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

function sameSlot(
  a: Pick<SlotCell, 'bar' | 'voice' | 'beat' | 'slot'>,
  b: Pick<SlotCell, 'bar' | 'voice' | 'beat' | 'slot'>,
) {
  return a.bar === b.bar && a.voice === b.voice && a.beat === b.beat && a.slot === b.slot
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
  barIndex,
  input,
  playing,
  getClock,
  canSwipe,
  onSelectBar,
  onToggle,
  onToggleSoft,
  onMoveHit,
  onPreview,
}: {
  bars: readonly RhythmBar[]
  barIndex: number
  input: InputDivision
  playing: boolean
  getClock: () => TransportClock
  canSwipe: boolean
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
  const swipeRef = useRef<{ pointerId: number; x: number; y: number; fromBar: number } | null>(null)
  const holdTimerRef = useRef(0)
  const armTimerRef = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLSpanElement>(null)
  const pointerPosRef = useRef({ x: 0, y: 0 })
  const moveToRef = useRef<SlotCell | null>(null)
  const [moving, setMoving] = useState<{
    soft: boolean
    fromBar: number
    fromVoice: VoiceId
    fromBeat: number
    fromSlot: number
  } | null>(null)
  const [moveTo, setMoveTo] = useState<SlotCell | null>(null)

  const shown = Math.min(Math.max(0, barIndex), Math.max(0, bars.length - 1))
  const bar = bars[shown] ?? bars[0]
  const onSelectBarRef = useRef(onSelectBar)
  onSelectBarRef.current = onSelectBar
  const shownRef = useRef(shown)
  shownRef.current = shown
  const playingRef = useRef(playing)
  playingRef.current = playing

  const paintAt = useCallback(
    (targetBar: number, voice: VoiceId, beat: number, slot: number, preview: boolean) => {
      const stroke = paintRef.current
      if (!stroke || stroke.voice !== voice) return
      const key = `${targetBar}:${voice}:${beat}:${slot}`
      if (stroke.lastKey === key) return
      stroke.lastKey = key
      onToggle(targetBar, voice, beat, slot, stroke.on, preview)
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
    swipeRef.current = null
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
      swipeRef.current = null
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
      swipeRef.current = null
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
    const track = trackRef.current
    if (!line || !track) return
    let raf = 0
    let lastRequested = -1
    const hide = () => {
      line.hidden = true
      line.setAttribute('data-playhead-on', '0')
    }
    const tick = () => {
      const clock = getClock()
      const current = shownRef.current
      const live = playingRef.current && clock.playing && !clock.precount
      if (!live) {
        lastRequested = -1
        hide()
      } else if (clock.barIndex !== current) {
        if (lastRequested !== clock.barIndex) {
          lastRequested = clock.barIndex
          onSelectBarRef.current(clock.barIndex)
        }
        hide()
      } else {
        lastRequested = clock.barIndex
        const frac = fracInBar(clock)
        const x = frac * track.clientWidth
        line.hidden = false
        line.setAttribute('data-playhead-on', '1')
        line.setAttribute('data-playhead-frac', String(frac))
        line.setAttribute('data-playhead-x', String(Math.round(x)))
        line.style.transform = `translateX(${x}px)`
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [getClock])

  const startPaint = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      swipeRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, fromBar: shown }
      const cell = readSlot(event.target instanceof Element ? event.target : null, event.clientX, input)
      if (!cell) return
      const coarse = needsMoveArm(event.pointerType)
      pendingRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scroll: accumulatedScroll(rootRef.current),
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
        swipeRef.current = null
        onToggleSoft(pending.bar, pending.voice, pending.beat, pending.slot)
      }, BAR_LONG_PRESS_MS)
    },
    [input, onToggleSoft, shown],
  )

  const finishSwipe = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current
    if (!canSwipe || !swipe || swipe.pointerId !== event.pointerId) return false
    const pending = pendingRef.current
    if (pending?.engaged || pending?.moving || pending?.softened) return false
    const dx = event.clientX - swipe.x
    const dy = event.clientY - swipe.y
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.15) return false
    const next = swipe.fromBar + (dx < 0 ? 1 : -1)
    if (next < 0 || next >= bars.length) return false
    onSelectBar(next)
    return true
  }

  if (!bar) return null

  return (
    <div
      ref={rootRef}
      data-drum-editor-grid
      data-drum-flat="1"
      data-editor-one-bar="1"
      data-editor-bar={shown}
      data-drum-input={input}
      data-moving={moving ? '1' : '0'}
      data-bar-count={bars.length}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(HOLD_NUDGE_CLASS, 'flex h-full min-h-0 min-w-0 flex-1')}
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
        if (Math.abs(accumulatedScroll(rootRef.current) - pending.scroll) > 1) {
          pending.ignored = true
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
        if (Math.abs(dx) > Math.abs(dy) * 1.15 && Math.abs(dx) >= SWIPE_PX) {
          pending.ignored = true
          window.clearTimeout(holdTimerRef.current)
          window.clearTimeout(armTimerRef.current)
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
        if (finishSwipe(event)) {
          endPaint()
          return
        }
        if (
          pending &&
          pending.pointerId === event.pointerId &&
          !pending.engaged &&
          !pending.ignored &&
          !pending.softened
        ) {
          const dist = Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
          const scrolled = Math.abs(accumulatedScroll(rootRef.current) - pending.scroll) > 1
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
          data-hit-diamond
          data-soft={moving.soft ? '1' : '0'}
          className={cn('drum-hit-diamond drum-hit-ghost', moving.soft && 'opacity-40')}
          style={{ left: pointerPosRef.current.x, top: pointerPosRef.current.y }}
        />
      ) : null}
      <div
        data-editor-labels
        className="grid h-full w-[4.4rem] shrink-0 grid-rows-[1.25rem_repeat(14,minmax(0,1fr))] bg-[#0B0F1A] pr-1.5"
      >
        <div aria-hidden />
        {VOICES.map((voice) => {
          const lit = (bar.pattern[voice] ?? []).length > 0
          return (
            <button
              key={voice}
              type="button"
              data-voice={voice}
              data-row-lit={lit ? '1' : '0'}
              {...voicePreviewHandlers(onPreview, voice)}
              className={cn(
                'flex min-h-0 items-center truncate text-left text-[0.58rem] font-semibold leading-none',
                lit ? 'text-slate-100' : 'text-slate-500',
              )}
            >
              {VOICE_LABELS[voice]}
            </button>
          )
        })}
      </div>
      <div ref={trackRef} data-editor-track className="relative min-h-0 min-w-0 flex-1 overflow-x-visible overflow-y-hidden">
        <div
          data-editor-bar-page={shown}
          className="grid h-full min-h-0 w-full grid-rows-[1.25rem_repeat(14,minmax(0,1fr))]"
        >
          <CountStrip beats={bar.beats} input={input} />
          {VOICES.map((voice) => {
            const hits = bar.pattern[voice] ?? []
            return (
              <div key={voice} data-voice-row data-row-lit={hits.length > 0 ? '1' : '0'} className="flex min-h-0 min-w-0">
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
                      key={`${voice}-${beat}`}
                      data-beat-box
                      data-voice-cell={voice}
                      data-beat={beat}
                      data-bar-index={shown}
                      data-division={view.division}
                      data-input-filled={filledInput}
                      className="relative flex min-h-0 min-w-0 flex-1 touch-manipulation"
                    >
                      {view.slots.map((slot) => {
                        const isSource =
                          moving?.fromVoice === voice &&
                          moving.fromBar === shown &&
                          moving.fromBeat === beat &&
                          moving.fromSlot === slot.slot
                        const isTarget =
                          moveTo?.voice === voice &&
                          moveTo.bar === shown &&
                          moveTo.beat === beat &&
                          moveTo.slot === slot.slot
                        return (
                          <span
                            key={slot.slot}
                            data-box-slot={slot.slot}
                            data-filled={slot.filled ? '1' : '0'}
                            data-soft={slot.soft ? '1' : '0'}
                            {...gridLineProps(
                              gridLineKind(beat, slot.slot),
                              isBarEndSlot(beat, slot.slot, bar.beats, input),
                            )}
                            {...(isSource ? { 'data-move-source': '1' } : {})}
                            {...(isTarget ? { 'data-drop-target': '1' } : {})}
                            className="relative h-full min-h-0 min-w-0 flex-1"
                          >
                            {slot.filled ? <HitDiamond soft={slot.soft} hide={isSource} /> : null}
                          </span>
                        )
                      })}
                      {view.dots
                        ? view.dotsAt.map((frac, index) => (
                            <HitDiamond
                              key={`off-${frac}`}
                              soft={view.dotsSoft[index] === true}
                              style={{ left: `${frac * 100}%` }}
                            />
                          ))
                        : null}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        <PlayheadLine lineRef={playheadRef} mark="editor" />
      </div>
    </div>
  )
})
