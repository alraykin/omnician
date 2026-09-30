import { InlineHeadstock, LayoutStylePill } from '@/components/tuner/InlineHeadstock'
import { SplitHeadstock } from '@/components/tuner/SplitHeadstock'
import { isTwelveString } from '@/lib/headstock'
import type { TunerLayoutMode } from '@/lib/custom-presets'
import type { InstrumentString } from '@/lib/notes'
import type { InstrumentId } from '@/lib/presets'
import { cn } from '@/lib/utils'

type HeadstockProps = {
  strings: readonly InstrumentString[]
  config: InstrumentId
  selectedId: string | null
  tunedIds: ReadonlySet<string>
  inTune: boolean
  live: boolean
  autoString: boolean
  onAutoChange: (value: boolean) => void
  onTapPeg: (string: InstrumentString) => void
  layoutMode: TunerLayoutMode
  onLayoutChange: (value: TunerLayoutMode) => void
}

export function Headstock({
  strings,
  config,
  selectedId,
  tunedIds,
  inTune,
  live,
  autoString,
  onAutoChange,
  onTapPeg,
  layoutMode,
  onLayoutChange,
}: HeadstockProps) {
  const twelveString = isTwelveString(config, strings.length)
  const effectiveLayout = twelveString ? 'headstock' : layoutMode

  return (
    <div className="w-full" data-twelve-inline={twelveString ? 'off' : 'ok'}>
      <div className="mb-1 flex items-center justify-between gap-3">
        {twelveString ? (
          <span data-layout-toggle-hidden="twelve" />
        ) : (
          <LayoutStylePill
            layoutMode={layoutMode}
            onToggle={() =>
              onLayoutChange(layoutMode === 'inline' ? 'headstock' : 'inline')
            }
          />
        )}
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          Auto strings
          <AutoSwitch on={autoString} onChange={onAutoChange} />
        </label>
      </div>

      {effectiveLayout === 'inline' ? (
        <InlineHeadstock
          strings={strings}
          config={config}
          selectedId={selectedId}
          tunedIds={tunedIds}
          inTune={inTune}
          live={live}
          onTapPeg={onTapPeg}
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
        />
      )}
      <p className="mt-2 text-center text-[0.65rem] leading-4 text-slate-500">
        Tap a peg to hear its pitch and set the target. Hold a string in tune to
        lock it green — it stays green until you tap that peg or change the tuning.
      </p>
    </div>
  )
}

function AutoSwitch({
  on,
  onChange,
}: {
  on: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Auto strings"
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors',
        on ? 'justify-end bg-[#A855F7]' : 'justify-start bg-white/15',
      )}
    >
      <span className="block size-6 shrink-0 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.45)]" />
    </button>
  )
}
