import { useEffect, useRef } from 'react'

import { SubdivIcon } from '@/components/rhythm/SubdivIcons'
import { usePlayhead, type PlayheadStore } from '@/hooks/useRhythmEngine'
import {
  SUBDIVISION_LABELS,
  SUBDIVISIONS,
  beatAccentAt,
  beatSubdivisionAt,
  type AccentLevel,
  type RhythmBar,
  type SubdivisionId,
} from '@/lib/rhythm'
import { activateOnPointer, chunkRows, cn } from '@/lib/utils'

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
const BEATS_PER_ROW = 8

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
  const live = playing && playhead.bar === barIndex
  const liveBeat = playhead.beat
  const rootRef = useRef<HTMLDivElement>(null)
  const beats = Array.from({ length: bar.beats }, (_, beat) => beat)
  const rows = chunkRows(beats, BEATS_PER_ROW)

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
      <div className="flex flex-col items-center gap-1.5" data-beat-wrap="true" data-beat-count={bar.beats}>
        {rows.map((row, rowIndex) => (
          <div
            key={`beat-row-${rowIndex}`}
            data-beat-row={rowIndex}
            className="flex w-full justify-center gap-1"
          >
            {row.map((beat) => {
              const level = beatAccentAt(bar.beatAccents, beat)
              const subdiv = beatSubdivisionAt(bar, beat)
              const now = live && liveBeat === beat
              const open = pickerBeat === beat
              return (
                <div
                  key={`beat-${beat}`}
                  className="flex w-9 shrink-0 flex-col items-center sm:w-10"
                >
                  <button
                    type="button"
                    data-accent-row="beat"
                    data-beat={beat}
                    data-level={level}
                    aria-label={`Beat ${beat + 1}, ${LEVEL_NAME[level]}`}
                    {...activateOnPointer(() => (accentEdit ? onCycleAccent(beat) : onPreviewBeat(beat)))}
                    className={cn(
                      'flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-full border text-sm font-bold tabular-nums sm:size-10',
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
                    aria-label={`Beat ${beat + 1} subdivision, ${SUBDIVISION_LABELS[subdiv]}`}
                    aria-expanded={open}
                    {...activateOnPointer(() => onPickerBeat(open ? null : beat))}
                    className={cn(
                      'mt-0.5 flex h-6 w-full items-center justify-center rounded-sm text-slate-300',
                      open && 'text-[#E9D5FF]',
                    )}
                  >
                    <SubdivIcon steps={subdiv} tiny />
                  </button>
                </div>
              )
            })}
          </div>
        ))}
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
                  aria-label={SUBDIVISION_LABELS[steps]}
                  aria-pressed={selected}
                  {...activateOnPointer(() => onSetBeatSubdiv(pickerBeat, steps))}
                  className={cn(
                    'flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg',
                    selected
                      ? 'bg-[#A855F7] text-white'
                      : 'border border-white/10 bg-white/4 text-slate-100',
                  )}
                >
                  <SubdivIcon steps={steps} compact />
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
