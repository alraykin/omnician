import { memo } from 'react'

import { DrumGrid, DrumInputChips } from '@/components/rhythm/DrumGrid'
import { usePlayhead, type PlayheadStore } from '@/hooks/useRhythmEngine'
import { type InputDivision } from '@/lib/beat-boxes'
import { type RhythmBar, type VoiceId } from '@/lib/rhythm'

export const DrumBarStage = memo(function DrumBarStage({
  bars,
  barIndex,
  playing,
  playheadStore,
  input,
  onInput,
  onToggle,
  onPreviewVoice,
}: {
  bars: readonly RhythmBar[]
  barIndex: number
  playing: boolean
  playheadStore: PlayheadStore
  input: InputDivision
  onInput: (next: InputDivision) => void
  onToggle: (
    barIndex: number,
    voice: VoiceId,
    beat: number,
    slot: number,
    on: boolean,
    preview: boolean,
  ) => void
  onPreviewVoice: (voice: VoiceId) => void
}) {
  const playhead = usePlayhead(playheadStore)
  const active = playing && !playhead.precount && playhead.bar >= 0 ? playhead.bar : barIndex
  const bar = bars[active] ?? bars[0]
  if (!bar) return null

  return (
    <div data-bar-stage data-bar-slide={active} className="min-h-0">
      <DrumInputChips value={input} onChange={onInput} className="mb-2" />
      <DrumGrid
        beats={bar.beats}
        pattern={bar.pattern}
        input={input}
        playheadStore={playheadStore}
        barIndex={active}
        playing={playing}
        onToggle={(voice, beat, slot, on, preview) => onToggle(active, voice, beat, slot, on, preview)}
        onPreview={onPreviewVoice}
      />
      <p className="mt-1.5 hidden text-center text-[0.6rem] leading-4 text-slate-500 min-[741px]:block">
        <span className="mr-3 inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3.5 rounded-full bg-[#A855F7]" />
          slots follow the beat
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3.5 rounded-full border border-dashed border-white/30" />
          empty uses Input
        </span>
      </p>
    </div>
  )
})
