import { Minus, Plus, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { FoldModeButton } from '@/components/fold/FoldModePicker'
import { FoldShell } from '@/components/fold/FoldShell'
import { type PlayheadStore, type TransportClock } from '@/hooks/useRhythmEngine'
import { fracInBar } from '@/lib/editor-playhead'
import { pendulumAtExtreme, pendulumBeatIndex, pendulumNorm, saveFoldChoice } from '@/lib/fold-mode'
import { beatAccentAt, meterLabel, type RhythmBar } from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

const MAX_DEG = 32

export function ClickTent({
  bpm,
  liveBpm,
  playing,
  bar,
  getClock,
  onTogglePlay,
  onBpm,
}: {
  bpm: number
  liveBpm: number
  playing: boolean
  bar: RhythmBar
  playheadStore: PlayheadStore
  getClock: () => TransportClock
  onTogglePlay: () => void
  onBpm: (next: number, tick?: boolean) => void
}) {
  const shownBpm = Math.round(liveBpm || bpm)
  const rodRef = useRef<HTMLDivElement>(null)
  const bobRef = useRef<HTMLSpanElement>(null)
  const playingRef = useRef(playing)
  const barRef = useRef(bar)
  const getClockRef = useRef(getClock)
  playingRef.current = playing
  barRef.current = bar
  getClockRef.current = getClock

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const clock = getClockRef.current()
      const beats = Math.max(1, barRef.current.beats)
      const frac = playingRef.current
        ? fracInBar({
            audioTime: clock.audioTime,
            barStart: clock.barStart,
            barDur: clock.barDur,
            precount: clock.precount,
            playing: clock.playing,
            outputLatency: clock.outputLatency,
          })
        : 0
      const norm = playingRef.current ? pendulumNorm(frac, beats) : 1
      const beat = playingRef.current ? pendulumBeatIndex(frac, beats) : 0
      const accent = beatAccentAt(barRef.current.beatAccents, beat)
      const extreme = playingRef.current && pendulumAtExtreme(norm)
      const rod = rodRef.current
      const bob = bobRef.current
      if (rod) rod.style.transform = `rotate(${(-norm * MAX_DEG).toFixed(3)}deg)`
      if (bob) {
        bob.dataset.accent = String(accent)
        bob.dataset.extreme = extreme ? '1' : '0'
        bob.classList.toggle('bg-[#A855F7]', accent === 2)
        bob.classList.toggle('bg-[#C4B5FD]', accent === 1)
        bob.classList.toggle('bg-white', accent === 0)
        bob.classList.toggle('shadow-[0_0_22px_rgba(168,85,247,0.9)]', extreme && accent >= 1)
        bob.classList.toggle('ring-2', extreme)
        bob.classList.toggle('ring-white', extreme)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <FoldShell layout="tent">
      <div
        data-fold-tent
        className="safe-overlay flex h-full min-h-0 w-full flex-col"
      >
        <div className="flex h-11 shrink-0 items-center gap-2">
          <button
            type="button"
            data-fold-tent-exit
            aria-label="Exit tent"
            {...activateOnPointer(() => saveFoldChoice('off'))}
            className="flex size-10 min-h-10 min-w-10 items-center justify-center rounded-full border border-white/14 text-slate-200 touch-manipulation"
          >
            <X className="size-5" />
          </button>
          <FoldModeButton always menuAlign="start" />
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#C084FC]">BPM</p>
            <p
              data-fold-tent-bpm
              className="text-[clamp(1.8rem,10vh,3.4rem)] font-extrabold leading-none tabular-nums text-white"
            >
              {shownBpm}
            </p>
          </div>
          <button
            type="button"
            aria-label="Slower by 5"
            data-fold-tent-minus
            {...activateOnPointer(() => onBpm(bpm - 5, true))}
            className="flex h-10 min-h-10 min-w-10 items-center justify-center gap-0.5 rounded-full border border-white/14 px-2 text-[0.78rem] font-semibold text-slate-100 touch-manipulation"
          >
            <Minus className="size-3.5" />
            5
          </button>
          <button
            type="button"
            aria-label="Faster by 5"
            data-fold-tent-plus
            {...activateOnPointer(() => onBpm(bpm + 5, true))}
            className="flex h-10 min-h-10 min-w-10 items-center justify-center gap-0.5 rounded-full border border-white/14 px-2 text-[0.78rem] font-semibold text-slate-100 touch-manipulation"
          >
            <Plus className="size-3.5" />
            5
          </button>
        </div>
        <p className="mt-0.5 text-center text-[0.72rem] text-slate-500">
          {meterLabel(bar.beats, bar.beatUnit)} · tap pendulum to {playing ? 'stop' : 'start'}
        </p>

        <button
          type="button"
          data-fold-pendulum-hit
          aria-label={playing ? 'Stop' : 'Play'}
          {...activateOnPointer(onTogglePlay)}
          className="relative mt-1 flex min-h-0 min-w-10 flex-1 touch-manipulation flex-col items-center justify-start overflow-hidden"
        >
          <div className="relative h-full w-full max-w-[min(100%,28rem)]">
            <span className="absolute left-1/2 top-[4%] z-10 size-3 -translate-x-1/2 rounded-full bg-[#C084FC]" />
            <div
              ref={rodRef}
              data-fold-pendulum
              className="absolute left-1/2 top-[5%] z-0 h-[78%] w-[3px] origin-top -translate-x-1/2 bg-gradient-to-b from-[#C084FC] to-[#A855F7]"
            >
              <span
                ref={bobRef}
                data-fold-pendulum-bob
                className="absolute bottom-0 left-1/2 size-11 min-h-10 min-w-10 -translate-x-1/2 translate-y-1/2 rounded-full bg-white"
              />
            </div>
          </div>
        </button>

        <div className="flex h-10 shrink-0 items-center justify-center gap-3 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]" data-fold-tent-accents>
          {Array.from({ length: bar.beats }, (_, beat) => {
            const level = beatAccentAt(bar.beatAccents, beat)
            return (
              <span
                key={beat}
                data-accent-beat={beat}
                className={cn(
                  'block size-4 rounded-full',
                  level === 2 ? 'bg-[#A855F7]' : level === 1 ? 'bg-[#C4B5FD]' : 'bg-white/25',
                )}
              />
            )
          })}
        </div>
      </div>
    </FoldShell>
  )
}
