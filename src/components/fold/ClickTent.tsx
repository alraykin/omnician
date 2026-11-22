import { Minus, Plus } from 'lucide-react'

import { ClickPendulum } from '@/components/fold/ClickPendulum'
import { FoldShell } from '@/components/fold/FoldShell'
import { type PlayheadStore, type TransportClock } from '@/hooks/useRhythmEngine'
import { beatAccentAt, meterLabel, type RhythmBar } from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

export function ClickTent({
  bpm,
  liveBpm,
  playing,
  bar,
  playheadStore,
  getClock,
  onTogglePlay,
  onBpm,
}: {
  bpm: number
  liveBpm: number
  playing: boolean
  bar: RhythmBar
  playheadStore: PlayheadStore
  getClock: () => TransportClock
  onTogglePlay: () => void
  onBpm: (next: number, tick?: boolean) => void
}) {
  const shownBpm = Math.round(liveBpm || bpm)

  return (
    <FoldShell layout="tent">
      <div
        data-fold-tent
        className="flex h-full min-h-0 w-full flex-col"
        style={{
          paddingTop: 'max(0.75rem, calc(var(--fold-safe-top) + 0.5rem))',
          paddingLeft: 'max(0.75rem, var(--fold-safe-left))',
          paddingRight: 'max(6.25rem, calc(var(--fold-status-right) + 0.75rem))',
          paddingBottom: 'max(0.75rem, var(--fold-safe-bottom))',
        }}
      >
        <div className="flex shrink-0 items-start gap-2">
          <div className="min-w-0 flex-1 px-2 text-center">
            <p
              data-fold-tent-bpm-label
              className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#C084FC]"
            >
              BPM
            </p>
            <p
              data-fold-tent-bpm
              className="text-[clamp(1.6rem,7dvh,3rem)] font-extrabold leading-none tabular-nums text-white"
            >
              {shownBpm}
            </p>
            <p
              data-fold-tent-caption
              className="mt-1.5 text-[0.72rem] leading-4 text-slate-500"
            >
              {meterLabel(bar.beats, bar.beatUnit)} · tap pendulum to {playing ? 'stop' : 'start'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Slower by 5"
            data-fold-tent-minus
            {...activateOnPointer(() => onBpm(bpm - 5, true))}
            className="flex h-10 min-h-10 min-w-10 items-center justify-center gap-0.5 rounded-full border border-white/14 px-2 text-[0.78rem] font-semibold text-slate-100 touch-manipulation"
          >
            <Minus className="size-3.5" />
            5
          </button>
          <button
            type="button"
            aria-label="Faster by 5"
            data-fold-tent-plus
            {...activateOnPointer(() => onBpm(bpm + 5, true))}
            className="flex h-10 min-h-10 min-w-10 items-center justify-center gap-0.5 rounded-full border border-white/14 px-2 text-[0.78rem] font-semibold text-slate-100 touch-manipulation"
          >
            <Plus className="size-3.5" />
            5
          </button>
        </div>

        <ClickPendulum
          playing={playing}
          bar={bar}
          bpm={liveBpm || bpm}
          playheadStore={playheadStore}
          getClock={getClock}
          onTogglePlay={onTogglePlay}
          className="mt-2"
        />

        <div
          className="flex min-h-10 shrink-0 items-center justify-center gap-3 pt-1"
          data-fold-tent-accents
        >
          {Array.from({ length: bar.beats }, (_, beat) => {
            const level = beatAccentAt(bar.beatAccents, beat)
            return (
              <span
                key={beat}
                data-accent-beat={beat}
                className={cn(
                  'block size-4 rounded-full',
                  level === 2 ? 'bg-[#A855F7]' : level === 1 ? 'bg-[#C4B5FD]' : 'bg-white/25',
                )}
              />
            )
          })}
        </div>
      </div>
    </FoldShell>
  )
}
