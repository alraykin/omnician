import { Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { FoldShell } from '@/components/fold/FoldShell'
import { type PlayheadStore, type TransportClock } from '@/hooks/useRhythmEngine'
import { fracInBar } from '@/lib/editor-playhead'
import { pendulumAtExtreme, pendulumBeatIndex, pendulumNorm } from '@/lib/fold-mode'
import { beatAccentAt, meterLabel, type RhythmBar } from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

const MAX_DEG = 32
const BOB_R = 22

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
  const stageRef = useRef<HTMLDivElement>(null)
  const [rodPx, setRodPx] = useState(180)
  const playingRef = useRef(playing)
  const barRef = useRef(bar)
  const getClockRef = useRef(getClock)
  playingRef.current = playing
  barRef.current = bar
  getClockRef.current = getClock

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const fit = () => {
      const w = node.clientWidth
      const h = node.clientHeight
      const sin = Math.sin((MAX_DEG * Math.PI) / 180)
      const maxFromWidth = (w / 2 - BOB_R - 8) / sin
      const maxFromHeight = h - BOB_R - 12
      setRodPx(Math.max(72, Math.min(maxFromWidth, maxFromHeight)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

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
        className="flex h-full min-h-0 w-full flex-col"
        style={{
          paddingTop: 'max(0.75rem, calc(var(--fold-safe-top) + 0.5rem))',
          paddingLeft: 'max(0.75rem, var(--fold-safe-left))',
          paddingRight: 'max(6.25rem, calc(var(--fold-status-right) + 0.75rem))',
          paddingBottom: 'max(0.75rem, var(--fold-safe-bottom))',
        }}
      >
        <div className="flex shrink-0 items-start gap-2">
          <div className="min-w-0 flex-1 px-2 text-center">
            <p
              data-fold-tent-bpm-label
              className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#C084FC]"
            >
              BPM
            </p>
            <p
              data-fold-tent-bpm
              className="text-[clamp(1.6rem,7dvh,3rem)] font-extrabold leading-none tabular-nums text-white"
            >
              {shownBpm}
            </p>
            <p
              data-fold-tent-caption
              className="mt-1.5 text-[0.72rem] leading-4 text-slate-500"
            >
              {meterLabel(bar.beats, bar.beatUnit)} · tap pendulum to {playing ? 'stop' : 'start'}
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

        <button
          type="button"
          data-fold-pendulum-hit
          aria-label={playing ? 'Stop' : 'Play'}
          {...activateOnPointer(onTogglePlay)}
          className="relative mt-2 flex min-h-0 min-w-10 flex-1 touch-manipulation flex-col items-center justify-center overflow-visible"
        >
          <div ref={stageRef} className="relative h-full w-full max-w-[min(100%,36rem)] overflow-visible">
            <span
              className="absolute left-1/2 z-10 size-3 -translate-x-1/2 rounded-full bg-[#C084FC]"
              style={{ top: 0 }}
            />
            <div
              ref={rodRef}
              data-fold-pendulum
              className="absolute left-1/2 top-[6px] z-0 w-[3px] origin-top -translate-x-1/2 bg-gradient-to-b from-[#C084FC] to-[#A855F7]"
              style={{ height: rodPx }}
            >
              <span
                ref={bobRef}
                data-fold-pendulum-bob
                className="absolute bottom-0 left-1/2 size-11 min-h-10 min-w-10 -translate-x-1/2 translate-y-1/2 rounded-full bg-white"
              />
            </div>
          </div>
        </button>

        <div
          className="flex min-h-10 shrink-0 items-center justify-center gap-3 pt-1"
          data-fold-tent-accents
        >
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
