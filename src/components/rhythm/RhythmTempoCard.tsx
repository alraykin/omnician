import { Minus, Plus } from 'lucide-react'

import { BpmWheel } from '@/components/rhythm/BpmWheel'
import { SpeedBuilderPanel } from '@/components/rhythm/SpeedBuilderPanel'
import { Button } from '@/components/ui/button'
import { type RhythmMode } from '@/lib/rhythm'
import { type SpeedBuilder } from '@/lib/speed-builder'
import { activateOnPointer } from '@/lib/utils'

export function RhythmTempoCard({
  bpm,
  liveBpm,
  playing,
  mode,
  speedBuilder,
  onSpeedBuilder,
  onBpm,
  onTap,
}: {
  bpm: number
  liveBpm: number
  playing: boolean
  mode: RhythmMode
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
      <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-stretch gap-x-2 pt-3 pr-3 pb-2 sm:gap-x-3 sm:pt-4 sm:pr-4">
        <SpeedBuilderPanel
          value={speedBuilder}
          baseBpm={bpm}
          onChange={onSpeedBuilder}
          precountAlways={mode === 'drums'}
        />
        <div className="relative z-10 flex h-full min-h-0 w-[8.5rem] max-w-full flex-col items-center justify-self-end">
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <BpmWheel
              compact
              value={bpm}
              faceBpm={showLive ? liveBpm : undefined}
              onChange={(next) => onBpm(next, true)}
            />
          </div>
          <div
            data-tempo-taps
            className="relative z-20 mt-auto grid w-full grid-cols-3 gap-0.5"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Slower by 5"
              className="h-8 w-full min-w-0 px-1 text-[0.7rem] touch-manipulation"
              {...activateOnPointer(() => onBpm(bpm - 5, true))}
            >
              <Minus className="size-3" />
              5
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-tap
              className="h-8 w-full min-w-0 px-1 text-[0.7rem] touch-manipulation"
              {...activateOnPointer(onTap)}
            >
              Tap
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Faster by 5"
              className="h-8 w-full min-w-0 px-1 text-[0.7rem] touch-manipulation"
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
