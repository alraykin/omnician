import { SubdivIcon } from '@/components/rhythm/SubdivIcons'
import { usePlayhead, type PlayheadStore } from '@/hooks/useRhythmEngine'
import {
  beatAccentAt,
  beatSubdivisionAt,
  type AccentLevel,
  type RhythmBar,
  type SubdivisionId,
} from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

type ClickAccentGridProps = {
  bar: RhythmBar
  playheadStore: PlayheadStore
  barIndex: number
  playing: boolean
  editBeat: number | null
  onCycleBeat: (beat: number) => void
  onEditBeatSubdiv: (beat: number) => void
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
  editBeat,
  onCycleBeat,
  onEditBeatSubdiv,
}: ClickAccentGridProps) {
  const playhead = usePlayhead(playheadStore)
  const live = playing && playhead.bar === barIndex
  const liveBeat = playhead.beat

  return (
    <div data-section="accents" className="space-y-1.5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Beats
      </p>
      <div className="-mx-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
        <div className="flex w-max min-w-full justify-center gap-1.5 px-1">
          {Array.from({ length: bar.beats }, (_, beat) => {
            const level = beatAccentAt(bar.beatAccents, beat)
            const subdiv = beatSubdivisionAt(bar, beat)
            const now = live && liveBeat === beat
            const editing = editBeat === beat
            return (
              <div key={`beat-${beat}`} className="flex w-10 shrink-0 flex-col items-center gap-1 sm:w-11">
                <button
                  type="button"
                  data-accent-row="beat"
                  data-beat={beat}
                  data-level={level}
                  aria-label={`Beat ${beat + 1}, ${LEVEL_NAME[level]}`}
                  {...activateOnPointer(() => onCycleBeat(beat))}
                  className={cn(
                    'flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-full border text-sm font-bold tabular-nums sm:size-11',
                    accentTone(level),
                    now && 'omni-beat-pulse',
                  )}
                >
                  {beat + 1}
                </button>
                <button
                  type="button"
                  data-beat-subdiv={beat}
                  data-subdivision={subdiv}
                  aria-label={`Beat ${beat + 1} subdivision, ${labelFor(subdiv)}`}
                  aria-pressed={editing}
                  {...activateOnPointer(() => onEditBeatSubdiv(beat))}
                  className={cn(
                    'flex h-7 w-full touch-manipulation items-center justify-center rounded-md border',
                    editing
                      ? 'border-[#A855F7] bg-[#A855F7] text-white'
                      : 'border-white/10 bg-white/4 text-slate-200',
                  )}
                >
                  <SubdivIcon steps={subdiv} compact />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function labelFor(steps: SubdivisionId): string {
  if (steps === 1) return 'quarter notes'
  if (steps === 2) return 'eighth notes'
  if (steps === 3) return 'triplets'
  if (steps === 4) return 'sixteenth notes'
  return `${steps}-note tuplets`
}
