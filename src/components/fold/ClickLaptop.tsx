import { ClickPendulum } from '@/components/fold/ClickPendulum'
import { FoldCrease, FoldHalf, FoldShell } from '@/components/fold/FoldShell'
import { FoldPlayButton, FoldTempoColumn } from '@/components/fold/FoldTempoColumn'
import { ClickBeatCircles } from '@/components/rhythm/ClickBeatCircles'
import { ClickPresetChip } from '@/components/rhythm/ClickPresets'
import { ClickSoundPicker } from '@/components/rhythm/ClickSoundPicker'
import { CompactMeter } from '@/components/rhythm/CompactMeter'
import { SubdivIcon } from '@/components/rhythm/SubdivIcons'
import { usePlayhead, type PlayheadStore, type TransportClock } from '@/hooks/useRhythmEngine'
import {
  SUBDIVISIONS,
  meterLabel,
  subdivisionLabel,
  type BeatUnit,
  type ClickSoundId,
  type RhythmBar,
  type SubdivisionId,
} from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

export function ClickLaptop({
  bpm,
  liveBpm,
  playing,
  bar,
  barIndex,
  clickSound,
  presetName,
  playheadStore,
  getClock,
  onTogglePlay,
  onMeter,
  onBpm,
  onTap,
  onSound,
  onSubdivision,
  onCycleAccent,
  onOpenPresets,
}: {
  bpm: number
  liveBpm: number
  playing: boolean
  bar: RhythmBar
  barIndex: number
  clickSound: ClickSoundId
  presetName: string
  playheadStore: PlayheadStore
  getClock: () => TransportClock
  onTogglePlay: () => void
  onMeter: (beats: number, beatUnit: BeatUnit) => void
  onBpm: (next: number, tick?: boolean) => void
  onTap: () => void
  onSound: (id: ClickSoundId) => void
  onSubdivision: (steps: SubdivisionId) => void
  onCycleAccent: (beat: number) => void
  onOpenPresets: () => void
}) {
  const playhead = usePlayhead(playheadStore)
  const live = playing && !playhead.precount && playhead.bar === barIndex
  const count =
    playing && playhead.precount && playhead.beat >= 0
      ? String(playhead.beat + 1)
      : !live || playhead.beat < 0
        ? '—'
        : playhead.subdivision
          ? `${playhead.beat + 1}·${playhead.step + 1}`
          : String(playhead.beat + 1)
  const shownBpm = Math.round(liveBpm || bpm)

  return (
    <FoldShell layout="laptop">
      <FoldHalf side="top" className="flex flex-col px-5 pt-3">
        <div className="flex shrink-0 items-end justify-between gap-3">
          <div>
            <p data-fold-click-bpm className="text-[clamp(2.8rem,9dvh,4.2rem)] font-extrabold leading-none tabular-nums text-white">
              {shownBpm}
            </p>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">BPM</p>
            <p className="text-[0.72rem] text-slate-400">
              {meterLabel(bar.beats, bar.beatUnit)} · {clickSound}
              {live ? ` · ${count}` : ''}
            </p>
          </div>
        </div>
        <ClickPendulum
          playing={playing}
          bar={bar}
          bpm={liveBpm || bpm}
          playheadStore={playheadStore}
          getClock={getClock}
          onTogglePlay={onTogglePlay}
          className="mt-1 min-h-0 flex-1"
        />
      </FoldHalf>
      <FoldCrease axis="horizontal" />
      <FoldHalf side="bottom" scroll className="relative flex flex-col px-4 pt-2">
        <div className="flex h-11 shrink-0 items-center gap-2">
          <ClickPresetChip name={presetName} onOpen={onOpenPresets} />
          <div className="min-w-0 flex-1">
            <CompactMeter beats={bar.beats} beatUnit={bar.beatUnit} onChange={onMeter} />
          </div>
        </div>
        <div className="mt-2 flex min-h-0 flex-1 gap-3 pb-2">
          <FoldTempoColumn bpm={bpm} liveBpm={liveBpm} onBpm={onBpm} onTap={onTap} className="h-full" />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="h-11">
              <ClickSoundPicker value={clickSound} onChange={onSound} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
              role="group"
              aria-label="Subdivision"
              className="mt-2 flex flex-wrap gap-1"
              data-section="subdivision"
            >
              {SUBDIVISIONS.map((steps) => {
                const selected = bar.beatSubdivisions.every((item) => item === steps)
                return (
                  <button
                    key={steps}
                    type="button"
                    data-subdivision={steps}
                    aria-pressed={selected}
                    {...activateOnPointer(() => onSubdivision(steps))}
                    className={cn(
                      'flex h-10 min-h-10 min-w-0 flex-1 basis-[calc(12.5%-0.25rem)] items-center justify-center rounded-lg',
                      selected ? 'bg-[#A855F7] text-white' : 'border border-white/10 bg-white/4 text-slate-100',
                    )}
                    aria-label={subdivisionLabel(steps, bar.beatUnit)}
                  >
                    <SubdivIcon steps={steps} beatUnit={bar.beatUnit} compact />
                  </button>
                )
              })}
            </div>
            <div className="mt-2" data-fold-click-accent-edit>
              <ClickBeatCircles
                bar={bar}
                barIndex={barIndex}
                playing={playing}
                playheadStore={playheadStore}
                onCycleAccent={onCycleAccent}
              />
            </div>
            </div>
            <div className="shrink-0 pb-3 pt-2">
              <FoldPlayButton playing={playing} onToggle={onTogglePlay} />
            </div>
          </div>
        </div>
      </FoldHalf>
    </FoldShell>
  )
}
