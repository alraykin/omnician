import { usePlayhead, type PlayheadStore } from '@/hooks/useRhythmEngine'
import {
  beatAccentAt,
  stepsPerBeat,
  subdivAccentAt,
  type AccentLevel,
  type BeatAccent,
  type SubdivAccent,
  type SubdivisionId,
} from '@/lib/rhythm'
import { cn } from '@/lib/utils'

type ClickAccentGridProps = {
  beats: number
  subdivision: SubdivisionId
  beatAccents: readonly BeatAccent[]
  subdivAccents: readonly SubdivAccent[]
  playheadStore: PlayheadStore
  barIndex: number
  playing: boolean
  onCycleBeat: (beat: number) => void
  onCycleSubdiv: (slot: number) => void
}

function accentTone(level: AccentLevel, outer: boolean) {
  if (level === 2) return 'border-[#A855F7] bg-[#A855F7] text-white'
  if (level === 1) return 'border-[#C4B5FD] bg-[#C4B5FD] text-[#2E1064]'
  return outer
    ? 'border-white/18 bg-white/8 text-slate-100'
    : 'border-white/10 bg-[#0B0F1A] text-slate-400'
}

const LEVEL_NAME = ['unaccented', 'soft accent', 'strong accent'] as const

export function ClickAccentGrid({
  beats,
  subdivision,
  beatAccents,
  subdivAccents,
  playheadStore,
  barIndex,
  playing,
  onCycleBeat,
  onCycleSubdiv,
}: ClickAccentGridProps) {
  const playhead = usePlayhead(playheadStore)
  const steps = stepsPerBeat(subdivision)
  const live = playing && playhead.bar === barIndex
  const liveBeat = playhead.beat
  const liveStep = playhead.step
  const liveSlot = live && liveStep >= 0 ? liveStep % Math.max(1, steps) : -1

  return (
    <div data-section="accents" className="space-y-2">
      <div>
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Beats
        </p>
        <div className="-mx-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          <div className="flex w-max min-w-full justify-center gap-1.5 px-1">
            {Array.from({ length: beats }, (_, beat) => {
              const level = beatAccentAt(beatAccents, beat)
              const now = live && liveBeat === beat
              return (
                <button
                  key={`beat-${beat}`}
                  type="button"
                  data-accent-row="beat"
                  data-beat={beat}
                  data-level={level}
                  aria-label={`Beat ${beat + 1}, ${LEVEL_NAME[level]}`}
                  onClick={() => onCycleBeat(beat)}
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold tabular-nums sm:size-11 lg:size-12',
                    accentTone(level, true),
                    now && 'omni-beat-pulse',
                  )}
                >
                  {beat + 1}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Within beat
        </p>
        <div className="-mx-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          <div className="flex w-max min-w-full justify-center gap-1.5 px-1">
            {Array.from({ length: steps }, (_, slot) => {
              const inner = subdivAccentAt(subdivAccents, slot, steps)
              const now = live && liveSlot === slot
              return (
                <button
                  key={`sub-${slot}`}
                  type="button"
                  data-accent-row="subdiv"
                  data-slot={slot}
                  data-level={inner}
                  aria-label={`Within beat, step ${slot + 1}, ${LEVEL_NAME[inner]}`}
                  onClick={() => onCycleSubdiv(slot)}
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold tabular-nums sm:size-9',
                    accentTone(inner, false),
                    now && 'omni-beat-pulse',
                  )}
                >
                  {slot + 1}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
