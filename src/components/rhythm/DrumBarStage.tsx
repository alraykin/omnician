import { memo, useEffect, useRef, useState } from 'react'

import { DrumGrid, DrumInputChips } from '@/components/rhythm/DrumGrid'
import { type TransportClock } from '@/hooks/useRhythmEngine'
import { type InputDivision } from '@/lib/beat-boxes'
import { type RhythmBar, type VoiceId } from '@/lib/rhythm'

export const DrumBarStage = memo(function DrumBarStage({
  bars,
  barIndex,
  playing,
  getClock,
  input,
  onInput,
  onToggle,
  onToggleSoft,
  onMoveHit,
  onPreviewVoice,
}: {
  bars: readonly RhythmBar[]
  barIndex: number
  playing: boolean
  getClock: () => TransportClock
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
  onToggleSoft: (barIndex: number, voice: VoiceId, beat: number, slot: number) => void
  onMoveHit: (
    barIndex: number,
    fromVoice: VoiceId,
    fromBeat: number,
    fromSlot: number,
    toVoice: VoiceId,
    toBeat: number,
    toSlot: number,
  ) => void
  onPreviewVoice: (voice: VoiceId) => void
}) {
  const barIndexRef = useRef(barIndex)
  barIndexRef.current = barIndex
  const [viewBar, setViewBar] = useState(barIndex)

  useEffect(() => {
    if (!playing) setViewBar(barIndex)
  }, [playing, barIndex])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = Number.NaN
    const tick = () => {
      const clock = getClock()
      const next = clock.playing && !clock.precount ? clock.barIndex : barIndexRef.current
      if (next !== last) {
        last = next
        setViewBar(next)
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [getClock, playing])

  const active = Math.min(Math.max(0, playing ? viewBar : barIndex), Math.max(0, bars.length - 1))
  const bar = bars[active] ?? bars[0]
  if (!bar) return null

  return (
    <div data-bar-stage data-bar-slide={active} className="min-h-0">
      <DrumInputChips value={input} beatUnit={bar.beatUnit} onChange={onInput} className="mb-1.5" />
      <DrumGrid
        beats={bar.beats}
        pattern={bar.pattern}
        input={input}
        getClock={getClock}
        barIndex={active}
        playing={playing}
        onToggle={(voice, beat, slot, on, preview) => onToggle(active, voice, beat, slot, on, preview)}
        onToggleSoft={(voice, beat, slot) => onToggleSoft(active, voice, beat, slot)}
        onMoveHit={(fromVoice, fromBeat, fromSlot, toVoice, toBeat, toSlot) =>
          onMoveHit(active, fromVoice, fromBeat, fromSlot, toVoice, toBeat, toSlot)
        }
        onPreview={onPreviewVoice}
      />
      <p className="mt-1.5 hidden text-center text-[0.6rem] leading-4 text-slate-500 min-[741px]:block">
        <span className="mr-3 inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full bg-[#A855F7]" />
          hit
        </span>
        <span className="mr-3 inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full bg-[#6D28D9]/50" />
          soft
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full border border-dashed border-white/30" />
          empty
        </span>
      </p>
    </div>
  )
})
