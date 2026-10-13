import { InlineHeadstock } from '@/components/tuner/InlineHeadstock'
import { SplitHeadstock } from '@/components/tuner/SplitHeadstock'
import { isTwelveString } from '@/lib/headstock'
import type { TunerLayoutMode } from '@/lib/custom-presets'
import type { InstrumentString } from '@/lib/notes'
import type { InstrumentId } from '@/lib/presets'

type HeadstockProps = {
  strings: readonly InstrumentString[]
  config: InstrumentId
  selectedId: string | null
  tunedIds: ReadonlySet<string>
  inTune: boolean
  live: boolean
  onTapPeg: (string: InstrumentString) => void
  layoutMode: TunerLayoutMode
  playingId?: string | null
}

export function Headstock({
  strings,
  config,
  selectedId,
  tunedIds,
  inTune,
  live,
  onTapPeg,
  layoutMode,
  playingId = null,
}: HeadstockProps) {
  const twelveString = isTwelveString(config, strings.length)
  const effectiveLayout = twelveString ? 'headstock' : layoutMode

  return (
    <div className="w-full" data-twelve-inline={twelveString ? 'off' : 'ok'}>
      <div
        data-headstock-stage
        data-headstock-layout={effectiveLayout}
        className="relative mx-auto h-[17.75rem] w-full max-w-[16rem] overflow-visible sm:h-[20rem] sm:max-w-[18rem] wide:h-[22.5rem] wide:max-w-[20rem]"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {effectiveLayout === 'inline' ? (
            <InlineHeadstock
              strings={strings}
              config={config}
              selectedId={selectedId}
              tunedIds={tunedIds}
              inTune={inTune}
              live={live}
              onTapPeg={onTapPeg}
              playingId={playingId}
            />
          ) : (
            <SplitHeadstock
              strings={strings}
              config={config}
              selectedId={selectedId}
              tunedIds={tunedIds}
              inTune={inTune}
              live={live}
              onTapPeg={onTapPeg}
              playingId={playingId}
            />
          )}
        </div>
      </div>
      <p className="mt-1.5 hidden text-center text-[0.65rem] leading-4 text-slate-500 sm:block">
        Tap a peg to play its pitch like a tuning fork — tap again to stop. Hold a
        string in tune to lock it green. It stays green until you tap Reset or
        change the instrument or tuning.
      </p>
    </div>
  )
}
