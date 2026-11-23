import { useEffect, useRef } from 'react'

import { SubdivIcon } from '@/components/rhythm/SubdivIcons'
import { usePlayhead, type PlayheadStore } from '@/hooks/useRhythmEngine'
import {
  SUBDIVISIONS,
  subdivisionLabel,
  beatAccentAt,
  beatSubdivisionAt,
  type AccentLevel,
  type RhythmBar,
  type SubdivisionId,
} from '@/lib/rhythm'
import { activateOnPointer, CLICK_BEATS_PER_ROW, cn } from '@/lib/utils'

export { CLICK_BEATS_PER_ROW }

type ClickAccentGridProps = {
  bar: RhythmBar
  playheadStore: PlayheadStore
  barIndex: number
  playing: boolean
  accentEdit: boolean
  pickerBeat: number | null
  onPickerBeat: (beat: number | null) => void
  onPreviewBeat: (beat: number) => void
  onCycleAccent: (beat: number) => void
  onSetBeatSubdiv: (beat: number, subdivision: SubdivisionId) => void
}

function accentTone(level: AccentLevel) {
  if (level === 2) return 'border-[#A855F7] bg-[#A855F7] text-white'
  if (level === 1) return 'border-[#C4B5FD] bg-[#C4B5FD] text-[#2E1064]'
  return 'border-white/18 bg-white/8 text-slate-100'
}

const LEVEL_NAME = ['unaccented', 'soft accent', 'strong accent'] as const

export function ClickAccentGrid({
  bar,
  playheadStore,
  barIndex,
  playing,
  accentEdit,
  pickerBeat,
  onPickerBeat,
  onPreviewBeat,
  onCycleAccent,
  onSetBeatSubdiv,
}: ClickAccentGridProps) {
  const playhead = usePlayhead(playheadStore)
  const live = playing && !playhead.precount && playhead.bar === barIndex
  const liveBeat = playhead.beat
  const rootRef = useRef<HTMLDivElement>(null)
  const beats = Array.from({ length: bar.beats }, (_, beat) => beat)

  useEffect(() => {
    if (pickerBeat === null) return
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      onPickerBeat(null)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [onPickerBeat, pickerBeat])

  return (
    <div ref={rootRef} data-section="beats" data-accent-edit={accentEdit ? 'true' : 'false'}>
      <div
        className="grid w-full grid-cols-8 justify-items-center gap-x-1 gap-y-1.5"
        data-beat-wrap="true"
        data-beat-count={bar.beats}
        data-beat-row-size={CLICK_BEATS_PER_ROW}
      >
        {beats.map((beat) => {
          const level = beatAccentAt(bar.beatAccents, beat)
          const subdiv = beatSubdivisionAt(bar, beat)
          const now = live && liveBeat === beat
          const open = pickerBeat === beat
          return (
            <div
              key={`beat-${beat}`}
              data-beat-cell={beat}
              className="flex w-full min-w-0 max-w-10 flex-col items-center"
            >
              <button
                type="button"
                data-accent-row="beat"
                data-beat={beat}
                data-live={now ? 'true' : 'false'}
                data-level={level}
                aria-label={`Beat ${beat + 1}, ${LEVEL_NAME[level]}`}
                {...activateOnPointer(() => (accentEdit ? onCycleAccent(beat) : onPreviewBeat(beat)))}
                className={cn(
                  'flex aspect-square w-full max-w-10 min-h-8 touch-manipulation items-center justify-center rounded-full border text-sm font-bold tabular-nums',
                  accentTone(level),
                  accentEdit && 'ring-1 ring-[#A855F7]/55',
                  now && 'omni-beat-pulse',
                )}
              >
                {beat + 1}
              </button>
              <button
                type="button"
                data-beat-note={beat}
                data-subdivision={subdiv}
                aria-label={`Beat ${beat + 1} subdivision, ${subdivisionLabel(subdiv, bar.beatUnit)}`}
                aria-expanded={open}
                {...activateOnPointer(() => onPickerBeat(open ? null : beat))}
                className={cn(
                  'mt-0.5 flex h-6 w-full min-w-0 items-center justify-center rounded-sm text-slate-300',
                  open && 'text-[#E9D5FF]',
                )}
              >
                <SubdivIcon steps={subdiv} beatUnit={bar.beatUnit} tiny />
              </button>
            </div>
          )
        })}
      </div>
      {pickerBeat !== null ? (
        <div
          role="dialog"
          aria-label={`Subdivision for beat ${pickerBeat + 1}`}
          data-section="beat-subdiv-picker"
          className="mt-1.5 rounded-xl border border-white/12 bg-[#0B0F1A] px-1.5 py-1.5"
        >
          <p className="mb-1 text-center text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Beat {pickerBeat + 1}
          </p>
          <div className="flex flex-wrap justify-center gap-1">
            {SUBDIVISIONS.map((steps) => {
              const selected = beatSubdivisionAt(bar, pickerBeat) === steps
              return (
                <button
                  key={steps}
                  type="button"
                  data-picker-subdivision={steps}
                  aria-label={subdivisionLabel(steps, bar.beatUnit)}
                  aria-pressed={selected}
                  {...activateOnPointer(() => onSetBeatSubdiv(pickerBeat, steps))}
                  className={cn(
                    'flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg',
                    selected
                      ? 'bg-[#A855F7] text-white'
                      : 'border border-white/10 bg-white/4 text-slate-100',
                  )}
                >
                  <SubdivIcon steps={steps} beatUnit={bar.beatUnit} compact />
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
