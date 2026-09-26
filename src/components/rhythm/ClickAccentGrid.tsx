import { usePlayhead, type PlayheadStore } from '@/hooks/useRhythmEngine'
import {
  beatAccentAt,
  beatSubdivisionAt,
  type AccentLevel,
  type RhythmBar,
} from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

type ClickAccentGridProps = {
  bar: RhythmBar
  playheadStore: PlayheadStore
  barIndex: number
  playing: boolean
  selectedBeat: number | null
  accentEdit: boolean
  onSelectBeat: (beat: number) => void
  onCycleAccent: (beat: number) => void
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
  selectedBeat,
  accentEdit,
  onSelectBeat,
  onCycleAccent,
}: ClickAccentGridProps) {
  const playhead = usePlayhead(playheadStore)
  const live = playing && playhead.bar === barIndex
  const liveBeat = playhead.beat
  const mixed = bar.beatSubdivisions.some((item) => item !== bar.subdivision)

  return (
    <div data-section="beats" data-accent-edit={accentEdit ? 'true' : 'false'}>
      <div className="-mx-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
        <div className="flex w-max min-w-full justify-center gap-2 px-1">
          {Array.from({ length: bar.beats }, (_, beat) => {
            const level = beatAccentAt(bar.beatAccents, beat)
            const now = live && liveBeat === beat
            const selected = !accentEdit && selectedBeat === beat
            const custom = mixed && beatSubdivisionAt(bar, beat) !== bar.subdivision
            return (
              <button
                key={`beat-${beat}`}
                type="button"
                data-accent-row="beat"
                data-beat={beat}
                data-level={level}
                data-selected={selected ? 'true' : 'false'}
                data-custom-subdiv={custom ? 'true' : 'false'}
                aria-label={
                  accentEdit
                    ? `Beat ${beat + 1}, ${LEVEL_NAME[level]}`
                    : `Beat ${beat + 1}, select subdivision`
                }
                aria-pressed={selected}
                {...activateOnPointer(() => (accentEdit ? onCycleAccent(beat) : onSelectBeat(beat)))}
                className={cn(
                  'relative flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-full border text-sm font-bold tabular-nums sm:size-11',
                  accentTone(level),
                  selected && 'ring-2 ring-[#E9D5FF] ring-offset-2 ring-offset-[#0B0F1A]',
                  accentEdit && 'ring-1 ring-[#A855F7]/50',
                  now && 'omni-beat-pulse',
                )}
              >
                {beat + 1}
                {custom ? (
                  <span
                    aria-hidden
                    className="absolute bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-current opacity-80"
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
