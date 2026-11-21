import { ChevronDown, Plus, Redo2, SlidersHorizontal, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'

import { FoldCrease, FoldHalf, FoldShell } from '@/components/fold/FoldShell'
import { FoldPlayButton, FoldTempoColumn } from '@/components/fold/FoldTempoColumn'
import { CompactMeter } from '@/components/rhythm/CompactMeter'
import { DrumEditorGrid } from '@/components/rhythm/DrumEditorGrid'
import { DrumInputChips } from '@/components/rhythm/DrumGrid'
import { IntensitySwitch } from '@/components/rhythm/IntensitySwitch'
import { KitMixerPanel } from '@/components/rhythm/KitMixerPanel'
import { type PlayheadStore, type TransportClock } from '@/hooks/useRhythmEngine'
import { type InputDivision } from '@/lib/beat-boxes'
import { type KitIntensity } from '@/lib/kit-intensity'
import { type KitGroupId, type KitMix } from '@/lib/kit-mix'
import { meterLabel, type BeatUnit, type RhythmBar, type VoiceId } from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

export function DrumsLaptop({
  beatName,
  bpm,
  liveBpm,
  playing,
  bars,
  barIndex,
  input,
  getClock,
  kitMix,
  kitIntensity,
  canAdd,
  onTogglePlay,
  onInput,
  onMeter,
  onSelectBar,
  onAddBar,
  onRemoveBar,
  onToggle,
  onToggleSoft,
  onMoveHit,
  onPreview,
  onMix,
  onIntensity,
  onOpenLibrary,
  onBpm,
  onTapTempo,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  beatName: string
  bpm: number
  liveBpm: number
  playing: boolean
  bars: readonly RhythmBar[]
  barIndex: number
  input: InputDivision
  playheadStore: PlayheadStore
  getClock: () => TransportClock
  kitMix: KitMix
  kitIntensity: KitIntensity
  canAdd: boolean
  onTogglePlay: () => void
  onInput: (next: InputDivision) => void
  onMeter: (beats: number, beatUnit: BeatUnit) => void
  onSelectBar: (index: number) => void
  onAddBar: () => void
  onRemoveBar: () => void
  onToggle: (barIndex: number, voice: VoiceId, beat: number, slot: number, on: boolean, preview: boolean) => void
  onToggleSoft: (barIndex: number, voice: VoiceId, beat: number, slot: number) => void
  onMoveHit: (
    fromBar: number,
    fromVoice: VoiceId,
    fromBeat: number,
    fromSlot: number,
    toVoice: VoiceId,
    toBeat: number,
    toSlot: number,
    toBar: number,
  ) => void
  onPreview: (voice: VoiceId) => void
  onMix: (group: KitGroupId, db: number) => void
  onIntensity: (next: KitIntensity) => void
  onOpenLibrary: () => void
  onBpm: (next: number, tick?: boolean) => void
  onTapTempo: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}) {
  const [mixerOpen, setMixerOpen] = useState(false)
  const viewBar = Math.min(Math.max(0, barIndex), Math.max(0, bars.length - 1))
  const current = bars[viewBar] ?? bars[0]
  const shownBpm = Math.round(liveBpm || bpm)

  return (
    <FoldShell layout="laptop">
      <FoldHalf
        side="top"
        className="flex flex-col px-3"
        style={{ paddingTop: 'max(0.2rem, var(--fold-safe-top))' }}
      >
        <div
          data-fold-drums-meta
          className="flex h-10 shrink-0 items-baseline gap-2"
          style={{ maxWidth: 'calc(100% - min(var(--fold-status-portrait), 38%))' }}
        >
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-[#C084FC]">Beat</p>
          <p className="min-w-0 truncate text-[1.02rem] font-semibold leading-none text-white">{beatName}</p>
          <p className="shrink-0 text-[0.78rem] font-medium tabular-nums text-slate-400">
            {shownBpm} BPM · {current ? meterLabel(current.beats, current.beatUnit) : ''}
          </p>
        </div>
        <div data-fold-drums-grid className="min-h-0 flex-1">
          <DrumEditorGrid
            bars={bars}
            barIndex={viewBar}
            input={input}
            playing={playing}
            getClock={getClock}
            canSwipe={!playing}
            onSelectBar={onSelectBar}
            onToggle={onToggle}
            onToggleSoft={onToggleSoft}
            onMoveHit={onMoveHit}
            onPreview={onPreview}
          />
        </div>
      </FoldHalf>
      <FoldCrease axis="horizontal" />
      <FoldHalf
        side="bottom"
        className="flex flex-col px-4 pt-2"
        style={{ paddingBottom: 'max(0.5rem, var(--fold-safe-bottom))' }}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-1">
            <button
              type="button"
              data-editor-beat-name
              {...activateOnPointer(onOpenLibrary)}
              className="flex h-10 min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-lg px-1 text-left"
            >
              <span className="text-[0.52rem] font-semibold uppercase tracking-[0.12em] text-slate-500">Beat</span>
              <span className="truncate text-[0.82rem] font-semibold">{beatName}</span>
              <ChevronDown className="size-3.5 shrink-0 text-slate-400" />
            </button>
            <button
              type="button"
              data-editor-undo
              aria-label="Undo"
              disabled={!canUndo}
              {...activateOnPointer(onUndo)}
              className="flex size-10 items-center justify-center rounded-full border border-white/14 disabled:opacity-30"
            >
              <Undo2 className="size-4" />
            </button>
            <button
              type="button"
              data-editor-redo
              aria-label="Redo"
              disabled={!canRedo}
              {...activateOnPointer(onRedo)}
              className="flex size-10 items-center justify-center rounded-full border border-white/14 disabled:opacity-30"
            >
              <Redo2 className="size-4" />
            </button>
          </div>
          <div className="mt-1 flex h-11 shrink-0 items-center gap-2">
            <IntensitySwitch value={kitIntensity} onChange={onIntensity} />
            <button
              type="button"
              data-editor-mixer
              aria-pressed={mixerOpen}
              {...activateOnPointer(() => setMixerOpen((open) => !open))}
              className={cn(
                'flex h-10 min-h-10 items-center gap-1 rounded-full px-3 text-[0.72rem] font-semibold',
                mixerOpen ? 'bg-[#A855F7] text-white' : 'border border-white/12 bg-white/4',
              )}
            >
              <SlidersHorizontal className="size-3.5" />
              Mixer
            </button>
            {current ? (
              <div className="ml-auto min-w-0">
                <CompactMeter compact beats={current.beats} beatUnit={current.beatUnit} onChange={onMeter} />
              </div>
            ) : (
              <p className="ml-auto text-[0.78rem] font-semibold tabular-nums text-slate-300">
                {shownBpm} BPM
              </p>
            )}
          </div>
          <div className="mt-1 flex min-h-0 flex-1 gap-3">
            <FoldTempoColumn bpm={bpm} liveBpm={liveBpm} onBpm={onBpm} onTap={onTapTempo} />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-12 min-w-0 items-center gap-1" data-fold-bar-pills>
                {bars.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    data-bar-pill={index}
                    {...activateOnPointer(() => onSelectBar(index))}
                    className={cn(
                      'flex h-10 min-h-10 min-w-0 flex-1 items-center justify-center rounded-lg px-0.5 text-[clamp(0.62rem,2.1vw,0.78rem)] font-semibold tabular-nums',
                      index === viewBar ? 'bg-[#A855F7] text-white' : 'border border-white/12 bg-white/4 text-slate-200',
                    )}
                  >
                    {index + 1}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Add bar"
                  data-bar-add
                  disabled={!canAdd}
                  {...activateOnPointer(onAddBar)}
                  className="flex h-10 w-8 min-w-8 shrink-0 items-center justify-center rounded-lg border border-white/12 disabled:opacity-30"
                >
                  <Plus className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Delete bar"
                  data-bar-delete
                  disabled={bars.length <= 1}
                  {...activateOnPointer(onRemoveBar)}
                  className="flex h-10 w-8 min-w-8 shrink-0 items-center justify-center rounded-lg border border-[#FF4D6D]/40 text-[#FF4D6D] disabled:opacity-30"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {current ? (
                <DrumInputChips
                  value={input}
                  beatUnit={current.beatUnit}
                  onChange={onInput}
                  className="mt-2 h-12"
                />
              ) : null}
              <div className="mt-auto pb-3">
                <FoldPlayButton playing={playing} onToggle={onTogglePlay} />
              </div>
            </div>
          </div>
        </div>
        {mixerOpen ? (
          <>
            <button
              type="button"
              data-mixer-dismiss
              aria-label="Hide mixer"
              className="absolute inset-0 z-30 bg-black/25"
              onClick={() => setMixerOpen(false)}
            />
            <aside
              data-mixer-panel
              className="absolute right-3 top-14 z-40 w-[min(16.5rem,70%)] overflow-hidden rounded-2xl border border-white/10 bg-[#101626] px-3 py-2.5"
            >
              <KitMixerPanel mix={kitMix} onChange={onMix} />
            </aside>
          </>
        ) : null}
      </FoldHalf>
    </FoldShell>
  )
}
