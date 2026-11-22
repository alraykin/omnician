import { ClickPendulum } from '@/components/fold/ClickPendulum'
import { FoldCrease, FoldHalf, FoldShell } from '@/components/fold/FoldShell'
import { FoldPlayButton, FoldTempoColumn } from '@/components/fold/FoldTempoColumn'
import { ClickPresetChip } from '@/components/rhythm/ClickPresets'
import { ClickSoundPicker } from '@/components/rhythm/ClickSoundPicker'
import { CompactMeter } from '@/components/rhythm/CompactMeter'
import { SubdivIcon } from '@/components/rhythm/SubdivIcons'
import { usePlayhead, type PlayheadStore, type TransportClock } from '@/hooks/useRhythmEngine'
import {
  SUBDIVISIONS,
  beatAccentAt,
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
            <div
              role="group"
              aria-label="Subdivision"
              className="mt-2 flex h-11 gap-1"
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
                      'flex h-10 min-h-10 min-w-0 flex-1 items-center justify-center rounded-lg',
                      selected ? 'bg-[#A855F7] text-white' : 'border border-white/10 bg-white/4 text-slate-100',
                    )}
                    aria-label={subdivisionLabel(steps, bar.beatUnit)}
                  >
                    <SubdivIcon steps={steps} beatUnit={bar.beatUnit} compact />
                  </button>
                )
              })}
            </div>
            <div className="mt-2 flex h-11 items-center gap-1" data-fold-click-accent-edit>
              {Array.from({ length: bar.beats }, (_, beat) => {
                const level = beatAccentAt(bar.beatAccents, beat)
                return (
                  <button
                    key={beat}
                    type="button"
                    data-accent-beat={beat}
                    {...activateOnPointer(() => onCycleAccent(beat))}
                    className={cn(
                      'flex h-10 min-h-10 min-w-10 flex-1 items-center justify-center rounded-full text-[0.82rem] font-semibold',
                      level === 2
                        ? 'bg-[#A855F7] text-white'
                        : level === 1
                          ? 'bg-[#C4B5FD] text-[#2E1064]'
                          : 'border border-white/14 bg-white/6 text-slate-200',
                    )}
                  >
                    {beat + 1}
                  </button>
                )
              })}
            </div>
            <div className="mt-auto pb-3">
              <FoldPlayButton playing={playing} onToggle={onTogglePlay} />
            </div>
          </div>
        </div>
      </FoldHalf>
    </FoldShell>
  )
}
