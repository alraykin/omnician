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
  speedBuilder,
  onSpeedBuilder,
  onBpm,
  onTap,
}: {
  bpm: number
  liveBpm: number
  playing: boolean
  speedBuilder: SpeedBuilder
  onSpeedBuilder: (next: SpeedBuilder) => void
  onBpm: (next: number, tick?: boolean) => void
  onTap: () => void
}) {
  const showLive = playing && speedBuilder.enabled

  return (
    <section
      data-tempo-card
      className="relative isolate z-0 overflow-hidden rounded-2xl border border-white/10 bg-[#141A28]/80 pb-2 pl-2 sm:pl-4"
    >
      <div className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1 pt-3.5">
          <SpeedBuilderPanel value={speedBuilder} baseBpm={bpm} onChange={onSpeedBuilder} />
        </div>
        <div className="flex w-[7.25rem] shrink-0 flex-col items-center pt-3.5 pr-3.5 sm:w-[152px] sm:pt-4 sm:pr-4 lg:w-[188px]">
          <BpmWheel
            compact
            value={bpm}
            faceBpm={showLive ? liveBpm : undefined}
            baseHint={showLive && liveBpm !== bpm ? bpm : undefined}
            onChange={(next) => onBpm(next, true)}
          />
          <div className="relative z-20 mt-auto flex items-center gap-0.5 pb-0.5">
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
