import { accentLevelAt, stepsPerBeat, type AccentLevel, type AccentPos, type SubdivisionId } from '@/lib/rhythm'
import { cn } from '@/lib/utils'

type ClickAccentGridProps = {
  beats: number
  subdivision: SubdivisionId
  accents: readonly AccentPos[]
  liveBeat: number
  liveStep: number
  live: boolean
  onCycle: (beat: number, slot: number) => void
}

function accentTone(level: AccentLevel, downbeat: boolean) {
  if (level === 2) {
    return 'border-[#A855F7] bg-[#A855F7] text-white'
  }
  if (level === 1) {
    return 'border-[#C4B5FD] bg-[#C4B5FD] text-[#2E1064]'
  }
  return downbeat
    ? 'border-white/18 bg-white/8 text-slate-100'
    : 'border-white/10 bg-[#0B0F1A] text-slate-400'
}

const LEVEL_NAME = ['unaccented', 'soft accent', 'strong accent'] as const

export function ClickAccentGrid({
  beats,
  subdivision,
  accents,
  liveBeat,
  liveStep,
  live,
  onCycle,
}: ClickAccentGridProps) {
  const steps = stepsPerBeat(subdivision)
  const liveSlot = live && liveStep >= 0 ? liveStep % Math.max(1, steps) : -1

  return (
    <div data-section="accents">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Accents · tap to cycle
        </p>
        <p className="flex items-center gap-2 text-[0.65rem] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-[#C4B5FD]" />
            Soft
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-[#A855F7]" />
            Strong
          </span>
        </p>
      </div>
      <div className="-mx-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
        <div className="flex w-max min-w-full justify-between gap-2 px-1 sm:gap-3">
          {Array.from({ length: beats }, (_, beat) => (
            <div
              key={`beat-${beat}`}
              className="flex min-w-[3.25rem] flex-1 flex-col items-center gap-1"
              data-accent-beat={beat}
            >
              <p className="text-[0.7rem] font-bold tabular-nums text-slate-400">{beat + 1}</p>
              <div className="flex items-end justify-center gap-0.5">
                {Array.from({ length: steps }, (_, slot) => {
                  const level = accentLevelAt(accents, beat, slot, steps)
                  const now = live && liveBeat === beat && liveSlot === slot
                  const downbeat = slot === 0
                  return (
                    <button
                      key={`${beat}-${slot}`}
                      type="button"
                      data-beat={beat}
                      data-slot={slot}
                      data-level={level}
                      aria-label={`Beat ${beat + 1}, inner ${slot + 1}, ${LEVEL_NAME[level]}`}
                      onClick={() => onCycle(beat, slot)}
                      className={cn(
                        'flex items-center justify-center rounded-lg border text-xs font-bold tabular-nums transition',
                        downbeat ? 'size-9 text-sm sm:size-10' : 'size-8 sm:size-9',
                        accentTone(level, downbeat),
                        now && 'omni-beat-pulse',
                      )}
                    >
                      {slot + 1}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
