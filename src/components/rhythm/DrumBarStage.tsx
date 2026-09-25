import { memo, useEffect, useRef } from 'react'

import { DrumGrid } from '@/components/rhythm/DrumGrid'
import { type PlayheadStore } from '@/hooks/useRhythmEngine'
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
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const lastIndex = useRef(-1)

  useEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const layout = () => {
      const width = viewport.clientWidth
      for (const slide of track.querySelectorAll<HTMLElement>('[data-bar-slide]')) {
        slide.style.flex = `0 0 ${width}px`
        slide.style.width = `${width}px`
      }
    }

    const go = (index: number, smooth: boolean) => {
      const safe = Math.min(bars.length - 1, Math.max(0, index))
      lastIndex.current = safe
      const width = viewport.clientWidth
      track.style.transition = smooth
        ? 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)'
        : 'none'
      track.style.transform = `translate3d(-${safe * width}px, 0, 0)`
    }

    layout()
    const smooth = lastIndex.current >= 0
    if (!playing) {
      go(barIndex, smooth)
    } else {
      const live = playheadStore.getSnapshot().bar
      go(live >= 0 ? live : 0, false)
    }

    const observer = new ResizeObserver(() => {
      layout()
      go(lastIndex.current, false)
    })
    observer.observe(viewport)

    if (!playing) {
      return () => observer.disconnect()
    }

    const unsub = playheadStore.subscribe(() => {
      const next = playheadStore.getSnapshot().bar
      if (next < 0 || next === lastIndex.current) return
      go(next, true)
    })
    return () => {
      observer.disconnect()
      unsub()
    }
  }, [playheadStore, playing, barIndex, bars.length])

  return (
    <div ref={viewportRef} data-bar-stage className="w-full overflow-hidden">
      <div ref={trackRef} className="flex will-change-transform">
        {bars.map((bar, index) => (
          <div key={`slide-${index}`} data-bar-slide={index} className="min-w-0 overflow-hidden">
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
    </div>
  )
})
