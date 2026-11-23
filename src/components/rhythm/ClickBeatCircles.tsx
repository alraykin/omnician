import { usePlayhead, type PlayheadStore } from '@/hooks/useRhythmEngine'
import { beatAccentAt, type AccentLevel, type RhythmBar } from '@/lib/rhythm'
import { activateOnPointer, CLICK_BEATS_PER_ROW, cn } from '@/lib/utils'

const LEVEL_NAME = ['unaccented', 'soft accent', 'strong accent'] as const

export function clickBeatCircleClass(level: AccentLevel, live: boolean): string {
  if (live) {
    return level > 0
      ? 'border-[#A855F7] bg-[#A855F7] text-white'
      : 'border-white bg-white text-[#0B0F1A]'
  }
  if (level === 2) {
    return 'border-[#C084FC] bg-[#3B0764] text-[#E9D5FF]'
  }
  if (level === 1) {
    return 'border-[#A855F7] bg-[#1E1433] text-[#C4B5FD]'
  }
  return 'border-white/20 bg-[#0F1422] text-slate-400'
}

export function ClickBeatCircles({
  bar,
  playheadStore,
  barIndex,
  playing,
  onCycleAccent,
  className,
}: {
  bar: RhythmBar
  playheadStore: PlayheadStore
  barIndex: number
  playing: boolean
  onCycleAccent: (beat: number) => void
  className?: string
}) {
  const playhead = usePlayhead(playheadStore)
  const live =
    playing && !playhead.precount && playhead.bar === barIndex && playhead.beat >= 0
  const columns = Math.min(CLICK_BEATS_PER_ROW, Math.max(1, bar.beats))

  return (
    <div className={cn('flex w-full justify-center', className)}>
      <div
        data-click-beat-circles
        data-beat-wrap="true"
        data-beat-count={bar.beats}
        data-beat-row-size={CLICK_BEATS_PER_ROW}
        className="grid w-full justify-items-center gap-x-1.5 gap-y-1.5"
        style={{
          maxWidth: `min(100%, ${columns * 2.75}rem)`,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: bar.beats }, (_, beat) => {
          const level = beatAccentAt(bar.beatAccents, beat)
          const now = live && playhead.beat === beat
          return (
            <button
              key={beat}
              type="button"
              data-accent-beat={beat}
              data-level={level}
              data-live={now ? 'true' : 'false'}
              aria-label={`Beat ${beat + 1}, ${LEVEL_NAME[level]}. Tap to change accent.`}
              {...activateOnPointer(() => onCycleAccent(beat))}
              className={cn(
                'flex size-10 min-h-10 min-w-0 max-w-10 items-center justify-center rounded-full border text-sm font-bold tabular-nums touch-manipulation',
                clickBeatCircleClass(level, now),
                now && 'omni-beat-pulse',
              )}
            >
              {beat + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
