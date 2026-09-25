import { memo, useEffect, useRef } from 'react'

import { DrumGrid } from '@/components/rhythm/DrumGrid'
import { type PlayheadStore } from '@/hooks/useRhythmEngine'
import { patternToGrid, stepsPerBeat, type RhythmBar, type VoiceId } from '@/lib/rhythm'
import { cn } from '@/lib/utils'

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
  const scrollerRef = useRef<HTMLDivElement>(null)
  const lastScrolled = useRef(-1)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const go = (index: number, smooth: boolean) => {
      const slide = scroller.querySelector<HTMLElement>(`[data-bar-slide="${index}"]`)
      if (!slide) return
      lastScrolled.current = index
      const left = slide.offsetLeft
      scroller.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' })
    }

    const smooth = lastScrolled.current >= 0

    if (!playing) {
      go(barIndex, smooth)
      return
    }

    const live = playheadStore.getSnapshot().bar
    go(live >= 0 ? live : 0, smooth)
    return playheadStore.subscribe(() => {
      const next = playheadStore.getSnapshot().bar
      if (next < 0 || next === lastScrolled.current) return
      go(next, true)
    })
  }, [playheadStore, playing, barIndex, bars.length])

  return (
    <div
      ref={scrollerRef}
      data-bar-stage
      className={cn(
        'grid grid-flow-col auto-cols-[100%] snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        playing ? 'overflow-x-hidden' : 'scroll-smooth',
      )}
    >
      {bars.map((bar, index) => (
        <div
          key={`slide-${index}`}
          data-bar-slide={index}
          className="min-w-0 snap-start overflow-hidden"
        >
          <DrumGrid
            beats={bar.beats}
            subdivisionSteps={stepsPerBeat(bar.subdivision)}
            pattern={patternToGrid(bar.pattern, bar.beats, bar.subdivision)}
            playheadStore={playheadStore}
            barIndex={index}
            playing={playing}
            onPaint={(voice, step, on, preview) => onPaint(index, voice, step, on, preview)}
            onPreview={onPreviewVoice}
          />
        </div>
      ))}
    </div>
  )
})
