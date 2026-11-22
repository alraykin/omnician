import { FoldCrease, FoldHalf, FoldShell } from '@/components/fold/FoldShell'
import { SettingSwitch } from '@/components/SettingsChrome'
import { A4ReferenceControl } from '@/components/tuner/A4ReferenceControl'
import { Headstock } from '@/components/tuner/Headstock'
import { LayoutStylePill } from '@/components/tuner/InlineHeadstock'
import { InputPicker } from '@/components/tuner/InputPicker'
import { TunerTarget } from '@/components/tuner/TunerTarget'
import type { TunerLayoutMode } from '@/lib/custom-presets'
import { formatTenths } from '@/lib/feel'
import { isTwelveString } from '@/lib/headstock'
import { formatHz, type InstrumentString } from '@/lib/notes'
import type { InstrumentId } from '@/lib/presets'
import { cn } from '@/lib/utils'

export function TunerLaptop({
  a4Hz,
  onA4,
  cents,
  inTune,
  live,
  noteName,
  octave,
  targetHz,
  detectedHz,
  instrumentLabel,
  presetName,
  presetNotes,
  onChangePreset,
  autoString,
  onAutoString,
  layoutMode,
  onToggleLayout,
  strings,
  instrumentId,
  selectedId,
  tunedIds,
  playingId,
  onPeg,
  onReset,
}: {
  a4Hz: number
  onA4: (hz: number) => void
  cents: number | null
  inTune: boolean
  live: boolean
  noteName: string | null
  octave: number | null
  targetHz: number | null
  detectedHz: number | null
  instrumentLabel: string
  presetName: string
  presetNotes: string
  onChangePreset: () => void
  autoString: boolean
  onAutoString: (on: boolean) => void
  layoutMode: TunerLayoutMode
  onToggleLayout: () => void
  strings: readonly InstrumentString[]
  instrumentId: InstrumentId
  selectedId: string | null
  tunedIds: ReadonlySet<string>
  playingId: string | null
  onPeg: (string: InstrumentString) => void
  onReset: () => void
}) {
  const letter = noteName?.replace(/\d+$/, '') ?? '—'

  return (
    <FoldShell layout="laptop">
      <FoldHalf
        side="top"
        className="flex flex-col items-center justify-between px-6 pb-2 pt-4"
        style={{ paddingTop: 'max(0.5rem, var(--fold-safe-top))' }}
      >
        <div className="flex w-full max-w-2xl flex-col items-center pt-2">
        <div className="flex w-full items-end justify-center gap-2">
          <span
            data-fold-note-letter
            className={cn(
              'text-[clamp(6.2rem,24dvh,9.5rem)] font-extrabold leading-none tracking-tight',
              inTune && live ? 'text-emerald-300' : live ? 'text-white' : 'text-white/30',
            )}
          >
            {letter}
          </span>
          <span
            data-fold-note-octave
            className={cn(
              'mb-3 text-[clamp(2rem,7dvh,3.2rem)] font-semibold',
              inTune && live ? 'text-emerald-300/80' : 'text-slate-400',
            )}
          >
            {octave ?? ''}
          </span>
        </div>
        <p className="font-mono text-base tabular-nums text-slate-400">
          {detectedHz ? <span data-detected-hz>{formatHz(detectedHz)}</span> : null}
          {detectedHz && targetHz ? <span className="text-slate-600"> · </span> : null}
          {targetHz ? <span data-target-hz>{detectedHz ? `target ${formatHz(targetHz)}` : formatHz(targetHz)}</span> : null}
        </p>
        <p
          className={cn(
            'text-lg font-semibold tabular-nums',
            live && inTune && 'text-emerald-300',
            live && !inTune && cents != null && cents < 0 && 'text-sky-300',
            live && !inTune && cents != null && cents > 0 && 'text-orange-300',
            !live && 'text-slate-500',
          )}
        >
          {live && cents != null ? `${formatTenths(cents)} cents` : '— cents'}
        </p>
        </div>
        <div className="w-full max-w-3xl px-1 pb-1">
          <TunerTarget cents={cents} inTune={inTune} active={live} />
        </div>
      </FoldHalf>
      <FoldCrease axis="horizontal" />
      <FoldHalf
        side="bottom"
        scroll
        className="px-4 pt-2"
        style={{ paddingBottom: 'max(0.6rem, var(--fold-safe-bottom))' }}
      >
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <A4ReferenceControl a4Hz={a4Hz} onChange={onA4} />
            <button
              type="button"
              data-tuner-reset
              onClick={onReset}
              className="rounded-full border border-white/15 bg-[#0C1220] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-300"
            >
              Reset
            </button>
          </div>
          <button
            type="button"
            data-tuning-change
            onClick={onChangePreset}
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#141A28] px-3 py-2 text-left"
          >
            <span>
              <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-[#C084FC]">
                {instrumentLabel}
              </span>
              <span className="block text-sm font-semibold text-white">{presetName}</span>
              <span className="block font-mono text-[0.7rem] text-slate-500">{presetNotes}</span>
            </span>
            <span className="text-xs font-semibold text-slate-400">Change</span>
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              Auto strings
              <SettingSwitch label="Auto strings" on={autoString} onChange={onAutoString} />
            </label>
            {isTwelveString(instrumentId, strings.length) ? (
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-slate-500">Split</p>
            ) : (
              <LayoutStylePill layoutMode={layoutMode} onToggle={onToggleLayout} />
            )}
          </div>
          <InputPicker alwaysShow className="mt-0" />
          <Headstock
            strings={strings}
            config={instrumentId}
            selectedId={selectedId}
            tunedIds={tunedIds}
            inTune={inTune}
            live={live}
            playingId={playingId}
            onTapPeg={onPeg}
            layoutMode={layoutMode}
          />
        </div>
      </FoldHalf>
    </FoldShell>
  )
}
