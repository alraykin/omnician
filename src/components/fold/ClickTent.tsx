import { useEffect, useRef } from 'react'

import { FoldModeButton } from '@/components/fold/FoldModePicker'
import { FoldShell } from '@/components/fold/FoldShell'
import { type PlayheadStore, type TransportClock } from '@/hooks/useRhythmEngine'
import { fracInBar } from '@/lib/editor-playhead'
import {
  pendulumAtExtreme,
  pendulumBeatIndex,
  pendulumNorm,
} from '@/lib/fold-mode'
import { beatAccentAt, meterLabel, type RhythmBar } from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

const MAX_DEG = 28

export function ClickTent({
  bpm,
  liveBpm,
  playing,
  bar,
  getClock,
  onTogglePlay,
}: {
  bpm: number
  liveBpm: number
  playing: boolean
  bar: RhythmBar
  playheadStore: PlayheadStore
  getClock: () => TransportClock
  onTogglePlay: () => void
}) {
  const shownBpm = Math.round(liveBpm || bpm)

  return (
    <FoldShell layout="tent">
      <div
        data-fold-face="a"
        className="absolute inset-x-0 top-0 h-1/2 overflow-hidden pt-4"
      >
        <TentFace
          face="a"
          bpm={shownBpm}
          playing={playing}
          bar={bar}
          getClock={getClock}
          onTogglePlay={onTogglePlay}
        />
        <div className="pointer-events-auto absolute right-[232px] top-4 z-30">
          <FoldModeButton always />
        </div>
      </div>
      <div
        data-fold-face="b"
        className="absolute inset-x-0 top-1/2 h-1/2 origin-center overflow-hidden"
        style={{ transform: 'rotate(180deg)' }}
      >
        <div className="h-full pt-4">
          <TentFace
            face="b"
            bpm={shownBpm}
            playing={playing}
            bar={bar}
            getClock={getClock}
            onTogglePlay={onTogglePlay}
          />
        </div>
      </div>
    </FoldShell>
  )
}

function TentFace({
  face,
  bpm,
  playing,
  bar,
  getClock,
  onTogglePlay,
}: {
  face: 'a' | 'b'
  bpm: number
  playing: boolean
  bar: RhythmBar
  getClock: () => TransportClock
  onTogglePlay: () => void
}) {
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
        bob.classList.toggle('shadow-[0_0_22px_rgba(168,85,247,0.85)]', extreme && accent === 2)
        bob.classList.toggle('ring-2', extreme)
        bob.classList.toggle('ring-white', extreme)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <button
      type="button"
      data-fold-tent-face={face}
      aria-label={playing ? 'Stop' : 'Play'}
      {...activateOnPointer(onTogglePlay)}
        className="relative flex h-full w-full flex-col items-center px-4 pb-6 text-left touch-manipulation"
      >
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#C084FC]">BPM</p>
      <p data-fold-tent-bpm className="text-[3.4rem] font-extrabold leading-none tabular-nums text-white">
        {bpm}
      </p>
      <p className="mt-0.5 text-[0.78rem] text-slate-400">{meterLabel(bar.beats, bar.beatUnit)}</p>
      <p className="mt-1 text-[0.72rem] font-medium text-slate-500">Tap to {playing ? 'stop' : 'start'}</p>

      <div className="relative mt-1 flex min-h-0 flex-1 w-full items-start justify-center overflow-hidden pb-2">
        <div className="relative h-[14.5rem] w-[16rem]">
          <span className="absolute left-1/2 top-1 z-10 size-3 -translate-x-1/2 rounded-full bg-[#C084FC]" />
          <div
            ref={rodRef}
            data-fold-pendulum
            className="absolute left-1/2 top-2 z-0 h-[12.5rem] w-[3px] origin-top -translate-x-1/2 bg-gradient-to-b from-[#C084FC] to-[#A855F7]"
          >
            <span
              ref={bobRef}
              data-fold-pendulum-bob
              className="absolute bottom-0 left-1/2 size-11 -translate-x-1/2 translate-y-1/2 rounded-full bg-white"
            />
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-end justify-center gap-3 pb-1" data-fold-tent-accents>
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
    </button>
  )
}
