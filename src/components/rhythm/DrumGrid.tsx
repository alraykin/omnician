import { memo, useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode, type Ref } from 'react'

import { type PlayheadStore } from '@/hooks/useRhythmEngine'
import {
  beatBoxView,
  beatsPerGridRow,
  drumGridIsCompact,
  inputSlotFromX,
  type InputDivision,
} from '@/lib/beat-boxes'
import { BAR_LONG_PRESS_MS } from '@/lib/bar-press'
import { HOLD_NUDGE_CLASS } from '@/lib/hold-repeat'
import { VOICE_LABELS, VOICES, type Pattern, type VoiceId } from '@/lib/rhythm'
import { TAP_SLOP_PX, accumulatedScroll, activateOnPointer, cn } from '@/lib/utils'

type DrumGridProps = {
  beats: number
  pattern: Pattern
  input: InputDivision
  playheadStore: PlayheadStore
  barIndex: number
  playing: boolean
  onToggle: (voice: VoiceId, beat: number, slot: number, on: boolean, preview: boolean) => void
  onToggleSoft: (voice: VoiceId, beat: number, slot: number) => void
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
  engaged: boolean
  ignored: boolean
  softened: boolean
}

function readSlot(
  node: Element | null,
  clientX: number,
  input: InputDivision,
): { voice: VoiceId; beat: number; slot: number; filled: boolean } | null {
  const box = node?.closest('[data-beat-box]')
  if (!box) return null
  const voice = box.getAttribute('data-voice-cell')
  const beat = Number(box.getAttribute('data-beat'))
  if (!voice || !Number.isInteger(beat)) return null
  const rect = box.getBoundingClientRect()
  const slot = inputSlotFromX(clientX - rect.left, rect.width, input)
  const filled = box.getAttribute('data-input-filled')?.split(',').includes(String(slot)) ?? false
  return { voice: voice as VoiceId, beat, slot, filled }
}

/** 12px dots sit 2px in from the slot’s left edge and shrink if the slot is narrower. */
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

function slotFromPoint(x: number, y: number, input: InputDivision) {
  return readSlot(document.elementFromPoint(x, y), x, input)
}

function BeatWrapTrack({
  beatsPerRow,
  className,
  children,
  trackRef,
  labels,
}: {
  beatsPerRow: number
  className?: string
  children: ReactNode
  trackRef?: Ref<HTMLDivElement>
  labels?: boolean
}) {
  return (
    <div
      ref={trackRef}
      data-beats-per-row={beatsPerRow}
      {...(labels ? { 'data-beat-labels': '' } : {})}
      className={cn('grid min-w-0 gap-x-1 gap-y-0.5', className)}
      style={{ gridTemplateColumns: `repeat(${beatsPerRow}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  )
}

function useBeatsPerRow(beats: number, input: InputDivision) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [beatsPerRow, setBeatsPerRow] = useState(() =>
    beatsPerGridRow({
      beats,
      input,
      trackPx: typeof window === 'undefined' ? 320 : Math.max(160, window.innerWidth - 96),
      compact: typeof window === 'undefined' ? true : drumGridIsCompact(window.innerWidth),
    }),
  )

  useEffect(() => {
    const node = trackRef.current
    if (!node) return
    const apply = () => {
      const next = beatsPerGridRow({
        beats,
        input,
        trackPx: node.clientWidth,
        compact: drumGridIsCompact(window.innerWidth),
      })
      setBeatsPerRow((prev) => (prev === next ? prev : next))
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(node)
    const mq = window.matchMedia('(max-width: 639px)')
    mq.addEventListener('change', apply)
    window.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      mq.removeEventListener('change', apply)
      window.removeEventListener('resize', apply)
    }
  }, [beats, input])

  return { trackRef, beatsPerRow }
}

export const DrumGrid = memo(function DrumGrid({
  beats,
  pattern,
  input,
  playheadStore,
  barIndex,
  playing,
  onToggle,
  onToggleSoft,
  onPreview,
}: DrumGridProps) {
  const paintRef = useRef<PaintStroke | null>(null)
  const pendingRef = useRef<PendingPaint | null>(null)
  const holdTimerRef = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const { trackRef, beatsPerRow } = useBeatsPerRow(beats, input)
  const wrapping = beatsPerRow < beats

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

  const endPaint = useCallback(() => {
    window.clearTimeout(holdTimerRef.current)
    paintRef.current = null
    pendingRef.current = null
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
    const nowClass = 'is-now'
    let painted: Element[] = []
    const apply = () => {
      const snap = playheadStore.getSnapshot()
      const live = playing && snap.bar === barIndex && snap.beat >= 0 && !snap.precount
      for (const node of painted) node.classList.remove(nowClass)
      painted = []
      if (!live) {
        root.removeAttribute('data-playhead-beat')
        return
      }
      root.setAttribute('data-playhead-beat', String(snap.beat))
      const nodes = root.querySelectorAll(`[data-beat-box][data-beat="${snap.beat}"]`)
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
      const cell = readSlot(event.target instanceof Element ? event.target : null, event.clientX, input)
      if (!cell) return
      pendingRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scroll: accumulatedScroll(rootRef.current),
        voice: cell.voice,
        beat: cell.beat,
        slot: cell.slot,
        filled: cell.filled,
        engaged: false,
        ignored: false,
        softened: false,
      }
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = window.setTimeout(() => {
        const pending = pendingRef.current
        if (!pending || pending.engaged || pending.ignored || pending.softened) return
        if (!pending.filled) return
        pending.softened = true
        onToggleSoft(pending.voice, pending.beat, pending.slot)
      }, BAR_LONG_PRESS_MS)
    },
    [input, onToggleSoft],
  )

  return (
    <div
      ref={rootRef}
      data-drum-grid
      data-beat-boxes
      data-bar-index={barIndex}
      data-drum-input={input}
      data-beats-per-row={beatsPerRow}
      data-beat-wrap={wrapping ? '1' : '0'}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        HOLD_NUDGE_CLASS,
        'max-w-full touch-manipulation overflow-x-hidden overflow-y-visible pb-0.5',
      )}
      onPointerDown={startPaint}
      onClick={(event) => event.preventDefault()}
      onPointerMove={(event) => {
        const pending = pendingRef.current
        if (paintRef.current && pending?.engaged) {
          const cell = slotFromPoint(event.clientX, event.clientY, input)
          if (cell) paintAt(cell.voice, cell.beat, cell.slot, false)
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
        if (pending && pending.pointerId === event.pointerId && !pending.engaged && !pending.ignored && !pending.softened) {
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
      <div className="grid w-full min-w-0 grid-cols-[3.85rem_minmax(0,1fr)] gap-x-1 gap-y-px sm:grid-cols-[4.4rem_minmax(0,1fr)] sm:gap-y-1 md:grid-cols-[5.1rem_minmax(0,1fr)]">
        <div aria-hidden />
        <BeatWrapTrack
          labels
          trackRef={trackRef}
          beatsPerRow={beatsPerRow}
          className="mb-px text-[0.5rem] font-semibold uppercase tracking-wider text-slate-500 sm:mb-0.5 sm:text-[0.6rem]"
        >
          {Array.from({ length: beats }, (_, beat) => (
            <span
              key={`beat-${beat}`}
              data-beat-label={beat + 1}
                className="min-w-0 border border-transparent px-px text-left tabular-nums leading-none"
            >
              {beat + 1}
            </span>
          ))}
        </BeatWrapTrack>

        {VOICES.map((voice) => {
          const hits = pattern[voice] ?? []
          return (
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
                className="flex min-w-0 items-center self-stretch touch-manipulation whitespace-nowrap rounded-md py-0 pr-0.5 text-left text-[0.52rem] font-semibold leading-none tracking-tight text-slate-300 hover:bg-white/6 hover:text-white sm:text-[0.62rem] md:text-[0.68rem] wide:text-[0.58rem]"
              >
                {VOICE_LABELS[voice]}
              </button>
              <BeatWrapTrack beatsPerRow={beatsPerRow} className="touch-none">
                {Array.from({ length: beats }, (_, beat) => {
                  const view = beatBoxView(hits, beat, input)
                  const filledInput = Array.from({ length: input }, (_, slot) =>
                    hits.some(
                      (hit) =>
                        hit.beat === beat &&
                        hit.num * input === slot * hit.den,
                    ),
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
                      className={cn(
                        'relative flex min-w-0 items-center overflow-hidden rounded-md px-px py-0 sm:rounded-lg sm:py-0.5',
                        view.triplet
                          ? 'border border-[#A855F7] bg-[#A855F7]/8'
                          : 'border border-white/8 bg-white/[0.03]',
                      )}
                    >
                      <div className="relative flex w-full min-w-0 gap-0.5">
                        {view.slots.map((slot) => (
                          <span
                            key={slot.slot}
                            data-box-slot={slot.slot}
                            data-filled={slot.filled ? '1' : '0'}
                            data-soft={slot.soft ? '1' : '0'}
                            className={cn(
                              'flex h-4 min-w-0 flex-1 items-center justify-start overflow-hidden rounded-md border border-dashed border-white/18 bg-transparent pl-[2px] sm:h-6 md:h-7 wide:!h-5',
                            )}
                          >
                            {slot.filled ? <HitDot soft={slot.soft} /> : null}
                          </span>
                        ))}
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
              </BeatWrapTrack>
            </div>
          )
        })}
      </div>
    </div>
  )
})

export function DrumInputChips({
  value,
  onChange,
  className,
}: {
  value: InputDivision
  onChange: (next: InputDivision) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Input subdivision"
      data-section="drum-input"
      className={cn('flex w-full min-w-0 items-center gap-1', className)}
    >
      {([
        [2, '1/8'],
        [4, '1/16'],
        [3, '1/8T'],
        [6, '1/16T'],
      ] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          data-drum-input={id}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            'h-7 min-w-0 flex-1 rounded-full text-[0.65rem] font-semibold touch-manipulation sm:h-8 sm:text-[0.7rem]',
            value === id ? 'bg-[#A855F7] text-white' : 'border border-white/10 bg-white/4 text-slate-200',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
