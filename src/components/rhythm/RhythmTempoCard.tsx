import { Minus, Plus } from 'lucide-react'

import { BpmWheel } from '@/components/rhythm/BpmWheel'
import { VolumeFader } from '@/components/rhythm/KitFaders'
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
  volumeDb,
  onSpeedBuilder,
  onBpm,
  onTap,
  onVolume,
}: {
  bpm: number
  liveBpm: number
  playing: boolean
  mode: RhythmMode
  speedBuilder: SpeedBuilder
  volumeDb: number
  onSpeedBuilder: (next: SpeedBuilder) => void
  onBpm: (next: number, tick?: boolean) => void
  onTap: () => void
  onVolume: (db: number) => void
}) {
  const showLive = playing && speedBuilder.enabled

  return (
    <section
      data-tempo-card
      className="relative isolate z-0 overflow-hidden rounded-2xl border border-white/10 bg-[#141A28]/80 pl-2 sm:pl-4"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_7.25rem] items-start gap-x-1.5 gap-y-1.5 pt-3 pr-3 pb-2 sm:gap-x-2 sm:pt-4 sm:pr-4">
        <div className="flex min-w-0 items-stretch">
          <div className="w-max min-w-0 max-w-[calc(100%-2.6rem)]">
            <SpeedBuilderPanel
              value={speedBuilder}
              baseBpm={bpm}
              onChange={onSpeedBuilder}
              precountAlways={mode === 'drums'}
            />
          </div>
          <div className="relative z-20 ml-2 flex min-w-[2.15rem] flex-1 items-stretch justify-end self-stretch pr-0.5 sm:ml-3">
            <VolumeFader db={volumeDb} onChange={onVolume} />
          </div>
        </div>
        <div className="relative z-10 flex w-[7.25rem] max-w-full flex-col items-center gap-1.5 justify-self-end">
          <BpmWheel
            compact
            value={bpm}
            faceBpm={showLive ? liveBpm : undefined}
            onChange={(next) => onBpm(next, true)}
          />
          <div
            data-tempo-taps
            className="relative z-20 grid w-full grid-cols-3 gap-0.5"
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
