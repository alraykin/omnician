import { memo } from 'react'

import { DrumGrid } from '@/components/rhythm/DrumGrid'
import { usePlayhead, type PlayheadStore } from '@/hooks/useRhythmEngine'
import { patternToGrid, stepsPerBeat, type RhythmBar, type VoiceId } from '@/lib/rhythm'

export const DrumBarStage = memo(function DrumBarStage({
  bars,
  barIndex,
  playing,
  playheadStore,
  onPaint,
  onPreviewVoice,
}: {
  bars: readonly RhythmBar[]
  barIndex: number
  playing: boolean
  playheadStore: PlayheadStore
  onPaint: (barIndex: number, voice: VoiceId, step: number, on: boolean, preview: boolean) => void
  onPreviewVoice: (voice: VoiceId) => void
}) {
  const playhead = usePlayhead(playheadStore)
  const active = playing && playhead.bar >= 0 ? playhead.bar : barIndex
  const bar = bars[active] ?? bars[0]
  if (!bar) return null

  return (
    <div data-bar-stage data-bar-slide={active} className="min-h-0">
      <DrumGrid
        beats={bar.beats}
        subdivisionSteps={stepsPerBeat(bar.subdivision)}
        pattern={patternToGrid(bar.pattern, bar.beats, bar.subdivision)}
        playheadStore={playheadStore}
        barIndex={active}
        playing={playing}
        onPaint={(voice, step, on, preview) => onPaint(active, voice, step, on, preview)}
        onPreview={onPreviewVoice}
      />
    </div>
  )
})
