import { FoldShell } from '@/components/fold/FoldShell'
import { duoOuterPreview } from '@/lib/duo-layout'
import { A4ReferenceControl } from '@/components/tuner/A4ReferenceControl'
import { Headstock } from '@/components/tuner/Headstock'
import { TunerTarget } from '@/components/tuner/TunerTarget'
import type { TunerLayoutMode } from '@/lib/custom-presets'
import { formatTenths } from '@/lib/feel'
import { formatHz, type InstrumentString } from '@/lib/notes'
import type { InstrumentId } from '@/lib/presets'
import { cn } from '@/lib/utils'

/** Phone / outer-cover landscape tuner: readout left, headstock right. */
export function TunerLandscape({
  a4Hz,
  onA4,
  cents,
  inTune,
  live,
  noteName,
  octave,
  targetHz,
  detectedHz,
  strings,
  instrumentId,
  selectedId,
  tunedIds,
  playingId,
  onPeg,
  onReset,
  layoutMode,
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
  strings: readonly InstrumentString[]
  instrumentId: InstrumentId
  selectedId: string | null
  tunedIds: ReadonlySet<string>
  playingId: string | null
  onPeg: (string: InstrumentString) => void
  onReset: () => void
  layoutMode: TunerLayoutMode
}) {
  const letter = noteName?.replace(/\d+$/, '') ?? '—'

  return (
    <FoldShell layout="book">
      <div
        data-tuner-landscape
        className="flex h-full min-h-0 w-full items-stretch gap-3 px-4"
        style={{
          paddingTop: 'max(0.35rem, var(--fold-safe-top))',
          paddingBottom: 'max(0.35rem, var(--fold-safe-bottom))',
          paddingLeft: 'max(0.7rem, var(--fold-safe-left))',
          paddingRight: duoOuterPreview()
            ? 'max(0.8rem, var(--safe-right), 4.25rem)'
            : 'max(0.8rem, var(--fold-safe-right))',
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="mb-1">
            <A4ReferenceControl a4Hz={a4Hz} onChange={onA4} />
          </div>
          <div className="flex items-end gap-2">
            <span
              data-fold-note-letter
              className={cn(
                'text-[clamp(3.6rem,22dvh,6.2rem)] font-extrabold leading-none tracking-tight',
                inTune && live ? 'text-emerald-300' : live ? 'text-white' : 'text-white/30',
              )}
            >
              {letter}
            </span>
            <span className="mb-1 text-xl font-semibold text-slate-400">{octave ?? ''}</span>
          </div>
          <p className="mt-1 font-mono text-sm tabular-nums text-slate-400">
            {detectedHz ? formatHz(detectedHz) : null}
            {detectedHz && targetHz ? ' · ' : null}
            {targetHz ? (detectedHz ? `target ${formatHz(targetHz)}` : formatHz(targetHz)) : null}
          </p>
          <p
            className={cn(
              'text-sm font-semibold tabular-nums',
              live && cents != null ? 'text-slate-200' : 'text-slate-500',
            )}
          >
            {live && cents != null ? `${formatTenths(cents)} cents` : '— cents'}
          </p>
          <div className="mt-2 w-full max-w-md">
            <TunerTarget cents={cents} inTune={inTune} active={live} />
          </div>
        </div>
        <div className="flex w-[min(20rem,46%)] shrink-0 flex-col items-center justify-center">
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
          <button
            type="button"
            data-tuner-reset
            onClick={onReset}
            className="mt-1 rounded-full border border-white/15 bg-[#0C1220] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-300"
          >
            Reset
          </button>
        </div>
      </div>
    </FoldShell>
  )
}
