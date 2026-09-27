import { Minus, Plus } from 'lucide-react'

import { BpmWheel } from '@/components/rhythm/BpmWheel'
import { SpeedBuilderPanel } from '@/components/rhythm/SpeedBuilderPanel'
import { Button } from '@/components/ui/button'
import { type SpeedBuilder } from '@/lib/speed-builder'
import { activateOnPointer } from '@/lib/utils'

export function RhythmTempoCard({
  bpm,
  liveBpm,
  playing,
  pulse,
  speedBuilder,
  onSpeedBuilder,
  onBpm,
  onTap,
}: {
  bpm: number
  liveBpm: number
  playing: boolean
  pulse: string
  speedBuilder: SpeedBuilder
  onSpeedBuilder: (next: SpeedBuilder) => void
  onBpm: (next: number, tick?: boolean) => void
  onTap: () => void
}) {
  const showLive = playing && speedBuilder.enabled

  return (
    <section
      data-tempo-card
      className="relative isolate z-0 overflow-hidden rounded-2xl border border-white/10 bg-[#141A28]/80 px-2 pb-2 pt-3 sm:px-4"
    >
      <div className="flex items-start gap-2">
        <SpeedBuilderPanel value={speedBuilder} baseBpm={bpm} onChange={onSpeedBuilder} />
        <div className="flex w-[7.6rem] shrink-0 flex-col items-center pt-0.5 sm:w-[10.5rem] lg:w-[13.5rem]">
          <BpmWheel
            compact
            value={bpm}
            faceBpm={showLive ? liveBpm : undefined}
            onChange={(next) => onBpm(next, true)}
          />
          <p className="relative z-20 mt-0.5 text-center text-[0.58rem] leading-4 text-slate-500">
            {pulse}
            {showLive && liveBpm !== bpm ? (
              <span className="block tabular-nums text-slate-600">base {bpm}</span>
            ) : null}
          </p>
          <div className="relative z-20 mt-1 flex items-center gap-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Slower by 5"
              className="h-7 px-1.5 text-[0.7rem] touch-manipulation"
              {...activateOnPointer(() => onBpm(bpm - 5, true))}
            >
              <Minus className="size-3" />
              5
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[0.7rem] touch-manipulation"
              {...activateOnPointer(onTap)}
            >
              Tap
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Faster by 5"
              className="h-7 px-1.5 text-[0.7rem] touch-manipulation"
              {...activateOnPointer(() => onBpm(bpm + 5, true))}
            >
              <Plus className="size-3" />
              5
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
