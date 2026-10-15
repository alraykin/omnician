import { memo, useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'

import { CountStrip, HitDiamond, PlayheadLine, gridLineProps } from '@/components/rhythm/DrumFlatBits'
import { type TransportClock } from '@/hooks/useRhythmEngine'
import { fracInBar } from '@/lib/editor-playhead'
import { gridLineKind, isBarEndSlot } from '@/lib/drum-flat-grid'
import {
  beatBoxView,
  INPUT_CHIPS,
  inputSlotFromX,
  kitBeatBlocks,
  kitBlockColumns,
  type InputDivision,
  type KitBeatBlock,
} from '@/lib/beat-boxes'
import { SubdivIcon } from '@/components/rhythm/SubdivIcons'
import { BAR_LONG_PRESS_MS, MOVE_ARM_MS } from '@/lib/bar-press'
import { HOLD_NUDGE_CLASS } from '@/lib/hold-repeat'
import {
  subdivisionLabel,
  type BeatUnit,
  type Pattern,
  type VoiceId,
  VOICE_LABELS,
  VOICES,
} from '@/lib/rhythm'
import { TAP_SLOP_PX, accumulatedScroll, activateOnPointer, cn, isCoarsePointer } from '@/lib/utils'

type DrumGridProps = {
  beats: number
  pattern: Pattern
  input: InputDivision
  getClock: () => TransportClock
  barIndex: number
  playing: boolean
  onToggle: (voice: VoiceId, beat: number, slot: number, on: boolean, preview: boolean) => void
  onToggleSoft: (voice: VoiceId, beat: number, slot: number) => void
  onMoveHit: (
    fromVoice: VoiceId,
    fromBeat: number,
    fromSlot: number,
    toVoice: VoiceId,
    toBeat: number,
    toSlot: number,
  ) => void
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
  heldLong: boolean
}

type SlotCell = {
  voice: VoiceId
  beat: number
  slot: number
  filled: boolean
  soft: boolean
}

function readSlot(
  node: Element | null,
  clientX: number,
  input: InputDivision,
): SlotCell | null {
  const box = node?.closest('[data-beat-box]')
  if (!box) return null
  const voice = box.getAttribute('data-voice-cell')
  const beat = Number(box.getAttribute('data-beat'))
  if (!voice || !Number.isInteger(beat)) return null
  const rect = box.getBoundingClientRect()
  const slot = inputSlotFromX(clientX - rect.left, rect.width, input)
  const slotEl = box.querySelector(`[data-box-slot="${slot}"]`)
  const filled =
    slotEl?.getAttribute('data-filled') === '1' ||
    (box.getAttribute('data-input-filled')?.split(',').includes(String(slot)) ?? false)
  const soft = slotEl?.getAttribute('data-soft') === '1'
  return { voice: voice as VoiceId, beat, slot, filled, soft }
}

function sameSlot(a: Pick<SlotCell, 'voice' | 'beat' | 'slot'>, b: Pick<SlotCell, 'voice' | 'beat' | 'slot'>) {
  return a.voice === b.voice && a.beat === b.beat && a.slot === b.slot
}

function lightHaptic() {
  try {
    navigator.vibrate?.(10)
  } catch {
    /* haptic is optional */
  }
}

function needsMoveArm(pointerType: string) {
  return pointerType === 'touch' || (pointerType !== 'mouse' && isCoarsePointer())
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

function KitBlock({
  block,
  columns,
  barBeats,
  pattern,
  input,
  onPreview,
  moveFrom,
  moveTo,
}: {
  block: KitBeatBlock
  columns: number
  barBeats: number
  pattern: Pattern
  input: InputDivision
  onPreview: (voice: VoiceId) => void
  moveFrom?: { voice: VoiceId; beat: number; slot: number } | null
  moveTo?: { voice: VoiceId; beat: number; slot: number } | null
}) {
  const beats = Array.from({ length: block.count }, (_, i) => block.start + i)
  return (
    <div
      data-kit-block={block.index}
      data-kit-block-start={block.start}
      data-kit-block-count={block.count}
      data-beats-per-row={columns}
      className="flex w-full min-w-0 gap-x-1 sm:gap-x-1.5"
    >
      <div
        data-kit-labels
        className="grid w-[3.85rem] shrink-0 grid-rows-[1.25rem_repeat(14,minmax(2rem,1fr))_1px] sm:w-[4.4rem] md:w-[5.1rem]"
      >
        <div aria-hidden />
        {VOICES.map((voice, row) => {
          const lit = (pattern[voice] ?? []).length > 0
          const last = row === VOICES.length - 1
          return (
            <button
              key={voice}
              type="button"
              data-voice={voice}
              data-row-lit={lit ? '1' : '0'}
              {...(last ? { 'data-grid-last-row': '1' } : {})}
              {...voicePreviewHandlers(onPreview, voice)}
              className={cn(
                'flex min-h-[2rem] min-w-0 items-center self-stretch touch-manipulation whitespace-nowrap py-0 pr-0.5 text-left text-[0.52rem] font-semibold leading-none tracking-tight sm:text-[0.62rem] md:text-[0.68rem] wide:text-[0.58rem]',
                lit ? 'text-slate-100 hover:text-white' : 'text-slate-500 hover:text-slate-200',
              )}
            >
              {VOICE_LABELS[voice]}
            </button>
          )
        })}
        <div data-grid-floor aria-hidden />
      </div>
      <div data-kit-block-track className="relative min-w-0 flex-1 pl-1.5">
        <div
          className="grid min-w-0 grid-rows-[1.25rem_repeat(14,minmax(2rem,1fr))_1px]"
          style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}
        >
          <CountStrip beats={block.count} beatOffset={block.start} input={input} columns={columns} />
          {VOICES.map((voice, row) => {
            const hits = pattern[voice] ?? []
            const last = row === VOICES.length - 1
            return (
              <div
                key={`${block.index}-${voice}`}
                data-voice-row
                data-row-lit={hits.length > 0 ? '1' : '0'}
                {...(last ? { 'data-grid-last-row': '1' } : {})}
                className="grid min-h-[2rem] min-w-0 touch-none"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {beats.map((beat) => {
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
                      data-division={view.division}
                      data-empty={view.empty ? '1' : '0'}
                      data-triplet={view.triplet ? '1' : '0'}
                      data-dots={view.dots ? '1' : '0'}
                      data-input-filled={filledInput}
                      className="relative flex min-h-[2rem] min-w-0"
                    >
                      {view.slots.map((slot) => {
                        const isSource =
                          moveFrom?.voice === voice && moveFrom.beat === beat && moveFrom.slot === slot.slot
                        const isTarget =
                          moveTo?.voice === voice && moveTo.beat === beat && moveTo.slot === slot.slot
                        return (
                          <span
                            key={slot.slot}
                            data-box-slot={slot.slot}
                            data-filled={slot.filled ? '1' : '0'}
                            data-soft={slot.soft ? '1' : '0'}
                            {...gridLineProps(
                              gridLineKind(beat, slot.slot),
                              isBarEndSlot(beat, slot.slot, barBeats, input),
                            )}
                            {...(isSource ? { 'data-move-source': '1' } : {})}
                            {...(isTarget ? { 'data-drop-target': '1' } : {})}
                            className="relative h-full min-h-[2rem] min-w-0 flex-1"
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
          <div data-grid-floor aria-hidden />
        </div>
        <PlayheadLine mark="grid" />
      </div>
    </div>
  )
}

export const DrumGrid = memo(function DrumGrid({
  beats,
  pattern,
  input,
  getClock,
  barIndex,
  playing,
  onToggle,
  onToggleSoft,
  onMoveHit,
  onPreview,
}: DrumGridProps) {
  const paintRef = useRef<PaintStroke | null>(null)
  const pendingRef = useRef<PendingPaint | null>(null)
  const holdTimerRef = useRef(0)
  const armTimerRef = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLSpanElement>(null)
  const pointerPosRef = useRef({ x: 0, y: 0 })
  const moveToRef = useRef<SlotCell | null>(null)
  const [moving, setMoving] = useState<{
    soft: boolean
    fromVoice: VoiceId
    fromBeat: number
    fromSlot: number
  } | null>(null)
  const [moveTo, setMoveTo] = useState<SlotCell | null>(null)
  const [trackPx, setTrackPx] = useState(() =>
    typeof window === 'undefined' ? 320 : Math.max(160, window.innerWidth - 96),
  )
  const blocks = kitBeatBlocks({ beats, input, trackPx })
  const columns = kitBlockColumns(blocks)

  useEffect(() => {
    const node = trackRef.current
    if (!node) return
    const apply = () => {
      const next = Math.max(120, Math.round(node.clientWidth))
      setTrackPx((prev) => (prev === next ? prev : next))
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(node)
    return () => ro.disconnect()
  }, [beats, input])

  const paintAt = useCallback(
    (voice: VoiceId, beat: number, slot: number, preview: boolean) => {
      const stroke = paintRef.current
      if (!stroke || stroke.voice !== voice) return
      const key = `${voice}:${beat}:${slot}`
      if (stroke.lastKey === key) return
      stroke.lastKey = key
      onToggle(voice, beat, slot, stroke.on, preview)
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

  useEffect(() => {
    if (!moving) return
    placeGhost(pointerPosRef.current.x, pointerPosRef.current.y)
  }, [moving, placeGhost])

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
      paintAt(pending.voice, pending.beat, pending.slot, preview)
    },
    [paintAt],
  )

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let lastBeat = Number.NaN
    let raf = 0
    const heads = () => root.querySelectorAll<HTMLElement>('[data-grid-playhead]')
    const hideHeads = () => {
      heads().forEach((line) => {
        line.hidden = true
        line.setAttribute('data-playhead-on', '0')
      })
    }
    const paintBeat = (beat: number) => {
      if (beat === lastBeat) return
      lastBeat = beat
      if (beat < 0) root.removeAttribute('data-playhead-beat')
      else root.setAttribute('data-playhead-beat', String(beat))
    }
    const tick = () => {
      const clock = getClock()
      const live = playing && clock.playing && !clock.precount && clock.barIndex === barIndex
      if (!live) {
        hideHeads()
        paintBeat(-1)
        raf = window.requestAnimationFrame(tick)
        return
      }
      const frac = fracInBar(clock)
      const pos = frac * beats
      paintBeat(Math.min(beats - 1, Math.max(0, Math.floor(pos))))
      const cols = Number(root.getAttribute('data-kit-block-beats')) || beats
      heads().forEach((line) => {
        const block = line.closest('[data-kit-block]')
        const track = block?.querySelector<HTMLElement>('[data-kit-block-track]')
        if (!block || !track) {
          line.hidden = true
          return
        }
        const start = Number(block.getAttribute('data-kit-block-start'))
        const count = Number(block.getAttribute('data-kit-block-count'))
        const inBlock = pos >= start && pos < start + count
        if (!inBlock) {
          line.hidden = true
          line.setAttribute('data-playhead-on', '0')
          return
        }
        const x = ((pos - start) / cols) * track.clientWidth
        line.hidden = false
        line.setAttribute('data-playhead-on', '1')
        line.setAttribute('data-playhead-x', String(Math.round(x)))
        line.style.transform = `translateX(${x}px)`
      })
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(raf)
      hideHeads()
    }
  }, [getClock, barIndex, playing, beats])

  const beginMove = useCallback(
    (event: PointerEvent<HTMLDivElement>, pending: PendingPaint) => {
      window.clearTimeout(holdTimerRef.current)
      window.clearTimeout(armTimerRef.current)
      pending.moving = true
      pending.engaged = true
      try {
        rootRef.current?.setPointerCapture(pending.pointerId)
      } catch {
        /* dispatched test pointers may not be active */
      }
      const origin: SlotCell = {
        voice: pending.voice,
        beat: pending.beat,
        slot: pending.slot,
        filled: pending.filled,
        soft: pending.soft,
      }
      moveToRef.current = origin
      setMoving({
        soft: pending.soft,
        fromVoice: pending.voice,
        fromBeat: pending.beat,
        fromSlot: pending.slot,
      })
      setMoveTo(origin)
      placeGhost(event.clientX, event.clientY)
    },
    [placeGhost],
  )

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
        scroll: accumulatedScroll(rootRef.current),
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
        heldLong: false,
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
        if (pending.filled) {
          pending.heldLong = true
          return
        }
        pending.softened = true
        lightHaptic()
        onToggleSoft(pending.voice, pending.beat, pending.slot)
      }, BAR_LONG_PRESS_MS)
    },
    [input, onToggleSoft],
  )

  return (
    <div
      ref={rootRef}
      data-drum-grid
      data-drum-flat="1"
      data-beat-boxes
      data-bar-index={barIndex}
      data-drum-input={input}
      data-kit-blocks={blocks.length}
      data-kit-block-beats={columns}
      data-beats-per-row={columns}
      data-kit-track-px={trackPx}
      data-beat-wrap={blocks.length > 1 ? '1' : '0'}
      data-moving={moving ? '1' : '0'}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        HOLD_NUDGE_CLASS,
        'max-w-full touch-manipulation overflow-x-clip overflow-y-clip pb-0.5',
      )}
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
          if (cell) paintAt(cell.voice, cell.beat, cell.slot, false)
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
            onMoveHit(pending.voice, pending.beat, pending.slot, cell.voice, cell.beat, cell.slot)
          }
          endPaint()
          return
        }
        if (
          pending &&
          pending.pointerId === event.pointerId &&
          !pending.engaged &&
          !pending.ignored &&
          !pending.softened &&
          !pending.heldLong
        ) {
          const dist = Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
          const scrolled = Math.abs(accumulatedScroll(rootRef.current) - pending.scroll) > 1
          if (dist <= TAP_SLOP_PX && !scrolled) {
            paintRef.current = { voice: pending.voice, on: !pending.filled, lastKey: '' }
            paintAt(pending.voice, pending.beat, pending.slot, true)
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
      <div className="relative flex w-full min-w-0 flex-col gap-3">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 grid h-0 grid-cols-[3.85rem_minmax(0,1fr)] gap-x-1 sm:grid-cols-[4.4rem_minmax(0,1fr)] md:grid-cols-[5.1rem_minmax(0,1fr)]"
        >
          <div />
          <div ref={trackRef} data-kit-track />
        </div>
        {blocks.map((block) => (
          <KitBlock
            key={block.index}
            block={block}
            columns={columns}
            barBeats={beats}
            pattern={pattern}
            input={input}
            onPreview={onPreview}
            moveFrom={
              moving
                ? { voice: moving.fromVoice, beat: moving.fromBeat, slot: moving.fromSlot }
                : null
            }
            moveTo={moveTo}
          />
        ))}
      </div>
    </div>
  )
})

export function DrumInputChips({
  value,
  onChange,
  beatUnit,
  className,
}: {
  value: InputDivision
  onChange: (next: InputDivision) => void
  beatUnit: BeatUnit
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Input subdivision"
      data-section="drum-input"
      data-drum-beat-unit={beatUnit}
      className={cn('flex w-full min-w-0 items-center gap-0.5 sm:gap-1', className)}
    >
      {INPUT_CHIPS.map(({ id }) => {
        const label = subdivisionLabel(id, beatUnit)
        return (
          <button
            key={id}
            type="button"
            data-drum-input={id}
            data-subdivision={id}
            data-subdivision-label={label}
            aria-label={label}
            title={label}
            aria-pressed={value === id}
            {...activateOnPointer(() => onChange(id))}
            className={cn(
              'flex h-9 min-w-0 flex-1 items-center touch-manipulation rounded-lg sm:h-11',
              value === id
                ? 'bg-[#A855F7] text-white'
                : 'border border-white/10 bg-white/4 text-slate-100 hover:border-[#A855F7]/50',
            )}
          >
            <SubdivIcon steps={id} beatUnit={beatUnit} compact className="mx-auto" />
          </button>
        )
      })}
    </div>
  )
}
