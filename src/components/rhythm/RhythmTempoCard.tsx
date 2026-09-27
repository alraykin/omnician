import { Minus, Plus } from 'lucide-react'

import { BpmWheel } from '@/components/rhythm/BpmWheel'
import { SpeedBuilderPanel, SpeedBuilderToggles } from '@/components/rhythm/SpeedBuilderPanel'
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
      className="relative isolate z-0 overflow-hidden rounded-2xl border border-white/10 bg-[#141A28]/80 pl-2 sm:pl-4"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1.5 pt-6 pr-6 pb-2 sm:pt-5 sm:pr-5">
        <SpeedBuilderPanel value={speedBuilder} baseBpm={bpm} onChange={onSpeedBuilder} />
        <div className="w-[9.25rem] justify-self-end sm:w-[152px] lg:w-[188px]">
          <BpmWheel
            compact
            value={bpm}
            faceBpm={showLive ? liveBpm : undefined}
            onChange={(next) => onBpm(next, true)}
          />
        </div>
        <SpeedBuilderToggles value={speedBuilder} onChange={onSpeedBuilder} />
        <div
          data-tempo-taps
          className="relative z-20 grid w-[9.25rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-0.5 justify-self-end self-center sm:w-[152px] lg:w-[188px]"
        >
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Slower by 5"
              className="h-7 min-w-0 px-1.5 text-[0.7rem] touch-manipulation"
              {...activateOnPointer(() => onBpm(bpm - 5, true))}
            >
              <Minus className="size-3" />
              5
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-tap
            className="h-7 min-w-0 px-1.5 text-[0.7rem] touch-manipulation"
            {...activateOnPointer(onTap)}
          >
            Tap
          </Button>
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Faster by 5"
              className="h-7 min-w-0 px-1.5 text-[0.7rem] touch-manipulation"
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
