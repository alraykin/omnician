import { useEffect, useRef, useState } from 'react'

import { type PlayheadStore, type TransportClock } from '@/hooks/useRhythmEngine'
import {
  easePendulumToCenter,
  pendulumAtExtreme,
  pendulumBeatIndexFromPhase,
  pendulumBeatPhase,
  pendulumNormFromBeatPhase,
  rebasePendulumClock,
} from '@/lib/fold-mode'
import { beatAccentAt, beatDurationSec, type RhythmBar } from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

const MAX_DEG = 32
const BOB_R = 22

type PendulumClock = {
  originAudioTime: number
  originBeatPhase: number
  beatSec: number
  armed: boolean
}

export function ClickPendulum({
  playing,
  bar,
  bpm,
  getClock,
  onTogglePlay,
  className,
}: {
  playing: boolean
  bar: RhythmBar
  bpm: number
  playheadStore?: PlayheadStore
  getClock: () => TransportClock
  onTogglePlay: () => void
  className?: string
}) {
  const rodRef = useRef<HTMLDivElement>(null)
  const bobRef = useRef<HTMLSpanElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [rodPx, setRodPx] = useState(180)
  const playingRef = useRef(playing)
  const barRef = useRef(bar)
  const bpmRef = useRef(bpm)
  const getClockRef = useRef(getClock)
  const displayRef = useRef(0)
  const wallRef = useRef(0)
  const swingRef = useRef<PendulumClock>({
    originAudioTime: 0,
    originBeatPhase: 0,
    beatSec: 0.5,
    armed: false,
  })
  playingRef.current = playing
  barRef.current = bar
  bpmRef.current = bpm
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
      setRodPx(Math.max(64, Math.min(maxFromWidth, maxFromHeight)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let raf = 0
    const paint = (norm: number, accent: number, extreme: boolean) => {
      const rod = rodRef.current
      const bob = bobRef.current
      if (rod) {
        rod.style.transform = `rotate(${(-norm * MAX_DEG).toFixed(3)}deg)`
        rod.dataset.norm = norm.toFixed(4)
        rod.dataset.extreme = extreme ? '1' : '0'
      }
      if (bob) {
        bob.dataset.accent = String(accent)
        bob.dataset.extreme = extreme ? '1' : '0'
        bob.classList.toggle('bg-[#A855F7]', accent === 2)
        bob.classList.toggle('bg-[#C084FC]', accent === 1)
        bob.classList.toggle('bg-white', accent === 0)
        bob.classList.toggle('shadow-[0_0_22px_rgba(168,85,247,0.9)]', extreme && accent >= 1)
        bob.classList.toggle('ring-2', extreme)
        bob.classList.toggle('ring-white', extreme)
      }
    }
    const tick = () => {
      const clock = getClockRef.current()
      const beats = Math.max(1, barRef.current.beats)
      const beatSec = beatDurationSec(bpmRef.current, barRef.current.beatUnit)
      const swing = swingRef.current
      const nowWall = performance.now()
      const dt = wallRef.current ? Math.min(0.08, (nowWall - wallRef.current) / 1000) : 0
      wallRef.current = nowWall

      let norm = displayRef.current
      if (playingRef.current && clock.playing && beatSec > 0) {
        if (!swing.armed) {
          const start =
            clock.barStart > 0 && clock.audioTime + 1 >= clock.barStart
              ? clock.barStart
              : clock.audioTime
          swing.originAudioTime = start
          swing.originBeatPhase = 0
          swing.beatSec = beatSec
          swing.armed = true
        } else if (Math.abs(beatSec - swing.beatSec) > 1e-9) {
          const next = rebasePendulumClock(
            clock.audioTime,
            swing.originAudioTime,
            swing.originBeatPhase,
            swing.beatSec,
            beatSec,
          )
          swing.originAudioTime = next.originAudioTime
          swing.originBeatPhase = next.originBeatPhase
          swing.beatSec = next.beatSec
        }
        const phase = pendulumBeatPhase(
          clock.audioTime,
          swing.originAudioTime,
          swing.originBeatPhase,
          swing.beatSec,
        )
        norm = pendulumNormFromBeatPhase(phase)
        const beat = pendulumBeatIndexFromPhase(Math.max(0, phase), beats)
        const accent = beatAccentAt(barRef.current.beatAccents, beat)
        const extreme = pendulumAtExtreme(norm)
        paint(norm, accent, extreme)
      } else {
        swing.armed = false
        norm = easePendulumToCenter(displayRef.current, dt)
        paint(norm, 0, false)
      }
      displayRef.current = norm
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <button
      type="button"
      data-fold-pendulum-hit
      aria-label={playing ? 'Stop' : 'Play'}
      {...activateOnPointer(onTogglePlay)}
      className={cn(
        'relative flex min-h-0 min-w-10 flex-1 touch-manipulation flex-col items-center justify-center overflow-visible',
        className,
      )}
    >
      <div ref={stageRef} className="relative h-full w-full max-w-[min(100%,36rem)] overflow-visible">
        <span
          className="absolute left-1/2 z-10 size-3 -translate-x-1/2 rounded-full bg-[#C084FC]"
          style={{ top: 0 }}
        />
        <div
          className="absolute left-1/2 top-[6px] z-0 w-[3px] -translate-x-1/2"
          style={{ height: rodPx }}
        >
          <div
            ref={rodRef}
            data-fold-pendulum
            className="h-full w-full origin-top bg-gradient-to-b from-[#C084FC] to-[#A855F7]"
          >
            <span
              ref={bobRef}
              data-fold-pendulum-bob
              className="absolute bottom-0 left-1/2 size-11 min-h-10 min-w-10 -translate-x-1/2 translate-y-1/2 rounded-full bg-white"
            />
          </div>
        </div>
      </div>
    </button>
  )
}
