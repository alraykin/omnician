import { Minus, Plus, Mic } from 'lucide-react'

import { BpmWheel } from '@/components/rhythm/BpmWheel'
import { VolumeFader } from '@/components/rhythm/KitFaders'
import { SpeedBuilderPanel, SpeedBuilderToggles } from '@/components/rhythm/SpeedBuilderPanel'
import { Button } from '@/components/ui/button'
import { type SpeedBuilder } from '@/lib/speed-builder'
import { activateOnPointer } from '@/lib/utils'

export function RhythmTempoCard({
  bpm,
  liveBpm,
  playing,
  speedBuilder,
  volumeDb,
  onSpeedBuilder,
  onBpm,
  onTap,
  onListen,
  onVolume,
  precountAlways = false,
}: {
  bpm: number
  liveBpm: number
  playing: boolean
  speedBuilder: SpeedBuilder
  volumeDb: number
  onSpeedBuilder: (next: SpeedBuilder) => void
  onBpm: (next: number, tick?: boolean) => void
  onTap: () => void
  onListen: () => void
  onVolume: (db: number) => void
  precountAlways?: boolean
}) {
  const showLive = playing && speedBuilder.enabled

  return (
    <section
      data-tempo-card
      className="relative isolate z-0 overflow-hidden rounded-2xl border border-white/10 bg-[#141A28]/80 pl-2 sm:pl-4"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_9.25rem] items-start gap-x-1.5 gap-y-1.5 pt-6 pr-7 pb-2 sm:gap-x-2 sm:pt-5 sm:pr-8">
        <div className="flex min-w-0 items-start">
          <div className="w-max min-w-0 max-w-[calc(100%-2.35rem)]">
            <SpeedBuilderPanel value={speedBuilder} baseBpm={bpm} onChange={onSpeedBuilder} />
            <SpeedBuilderToggles
              className="mt-1.5 w-full"
              value={speedBuilder}
              onChange={onSpeedBuilder}
              precountAlways={precountAlways}
            />
          </div>
          <div className="relative z-20 flex min-h-full min-w-[2.15rem] flex-1 items-center justify-center self-stretch px-0.5">
            <VolumeFader db={volumeDb} onChange={onVolume} />
          </div>
        </div>
        <div className="relative z-10 flex w-[9.25rem] max-w-full flex-col gap-1.5 justify-self-end">
          <BpmWheel
            compact
            value={bpm}
            faceBpm={showLive ? liveBpm : undefined}
            onChange={(next) => onBpm(next, true)}
          />
          <div
            data-tempo-taps
            className="relative z-20 flex w-full flex-col gap-0.5 self-end"
          >
            <div className="grid w-full grid-cols-3 gap-0.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Slower by 5"
                className="h-7 w-full min-w-0 px-1 text-[0.7rem] touch-manipulation"
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
                className="h-7 w-full min-w-0 px-1 text-[0.7rem] touch-manipulation"
                {...activateOnPointer(onTap)}
              >
                Tap
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Faster by 5"
                className="h-7 w-full min-w-0 px-1 text-[0.7rem] touch-manipulation"
                {...activateOnPointer(() => onBpm(bpm + 5, true))}
              >
                <Plus className="size-3" />
                5
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-listen
              aria-label="Listen for tempo"
              className="h-7 w-full min-w-0 gap-1 px-1.5 text-[0.7rem] touch-manipulation"
              {...activateOnPointer(onListen)}
            >
              <Mic className="size-3" />
              Listen
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
