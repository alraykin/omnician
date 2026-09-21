import { useCallback, useEffect, useRef, useState } from 'react'

import { getAudioCtor, RhythmKit } from '@/lib/rhythm-audio'
import {
  VOICES,
  beatIndexForStep,
  isBeatStep,
  stepDurationSec,
  stepsPerBar,
  type Meter,
  type Pattern,
  type RhythmMode,
  type VoiceId,
} from '@/lib/rhythm'

export type Playhead = {
  step: number
  beat: number
  accent: boolean
}

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.12

export function useRhythmEngine({
  playing,
  bpm,
  meter,
  mode,
  accents,
  pattern,
}: {
  playing: boolean
  bpm: number
  meter: Meter
  mode: RhythmMode
  accents: readonly number[]
  pattern: Pattern
}) {
  const [playhead, setPlayhead] = useState<Playhead>({
    step: -1,
    beat: -1,
    accent: false,
  })

  const kitRef = useRef<RhythmKit | null>(null)
  const timerRef = useRef<number | null>(null)
  const visualRef = useRef<number[]>([])
  const nextTimeRef = useRef(0)
  const stepRef = useRef(0)
  const playingRef = useRef(playing)
  const bpmRef = useRef(bpm)
  const meterRef = useRef(meter)
  const modeRef = useRef(mode)
  const accentsRef = useRef(accents)
  const patternRef = useRef(pattern)

  playingRef.current = playing
  bpmRef.current = bpm
  meterRef.current = meter
  modeRef.current = mode
  accentsRef.current = accents
  patternRef.current = pattern

  const clearVisuals = useCallback(() => {
    for (const id of visualRef.current) window.clearTimeout(id)
    visualRef.current = []
  }, [])

  const ensureKit = useCallback(async () => {
    if (kitRef.current) {
      await kitRef.current.unlock()
      return kitRef.current
    }
    const Ctor = getAudioCtor()
    if (!Ctor) return null
    const kit = new RhythmKit(new Ctor())
    kitRef.current = kit
    await kit.unlock()
    return kit
  }, [])

  const preview = useCallback(
    async (voice: VoiceId) => {
      const kit = await ensureKit()
      if (!kit) return
      kit.hit(voice, kit.ctx.currentTime + 0.01, false)
    },
    [ensureKit],
  )

  const stopScheduler = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    clearVisuals()
    setPlayhead({ step: -1, beat: -1, accent: false })
    stepRef.current = 0
  }, [clearVisuals])

  useEffect(() => {
    if (!playing) {
      stopScheduler()
      return
    }

    let cancelled = false

    const start = async () => {
      const kit = await ensureKit()
      if (!kit || cancelled || !playingRef.current) return

      stepRef.current = 0
      nextTimeRef.current = kit.ctx.currentTime + 0.05

      const scheduleStep = (step: number, time: number) => {
        const currentMeter = meterRef.current
        const beat = beatIndexForStep(step, currentMeter)
        const accent = accentsRef.current.includes(beat)
        if (modeRef.current === 'click') {
          if (isBeatStep(step, currentMeter)) kit.click(time, accent)
        } else {
          const grid = patternRef.current
          const open = grid.openHat[step]
          for (const voice of VOICES) {
            if (voice === 'closedHat' && open) continue
            if (grid[voice][step]) kit.hit(voice, time, accent)
          }
        }

        const delay = Math.max(0, (time - kit.ctx.currentTime) * 1000)
        const id = window.setTimeout(() => {
          if (!playingRef.current) return
          setPlayhead({ step, beat, accent })
        }, delay)
        visualRef.current.push(id)
      }

      const tick = () => {
        if (!playingRef.current) return
        const currentMeter = meterRef.current
        const bar = Math.max(1, stepsPerBar(currentMeter))
        while (nextTimeRef.current < kit.ctx.currentTime + SCHEDULE_AHEAD) {
          const step = stepRef.current
          scheduleStep(step, nextTimeRef.current)
          nextTimeRef.current += stepDurationSec(bpmRef.current, currentMeter)
          stepRef.current = (step + 1) % bar
        }
      }

      tick()
      timerRef.current = window.setInterval(tick, LOOKAHEAD_MS)
    }

    void start()

    return () => {
      cancelled = true
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      clearVisuals()
    }
  }, [ensureKit, playing, stopScheduler, clearVisuals, meter.id])

  useEffect(() => {
    return () => {
      stopScheduler()
      const kit = kitRef.current
      kitRef.current = null
      if (kit) {
        window.setTimeout(() => {
          void kit.ctx.close()
        }, 200)
      }
    }
  }, [stopScheduler])

  return { playhead, preview, ensureKit }
}
