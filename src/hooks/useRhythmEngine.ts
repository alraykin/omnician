import { useCallback, useEffect, useRef, useState } from 'react'

import { getAudioCtor, RhythmKit } from '@/lib/rhythm-audio'
import {
  VOICES,
  beatIndexForStep,
  isBeatStep,
  stepDurationSec,
  stepsInBar,
  type ClickSoundId,
  type RhythmBar,
  type RhythmMode,
  type VoiceId,
} from '@/lib/rhythm'

export type Playhead = {
  bar: number
  step: number
  beat: number
  accent: boolean
  subdivision: boolean
}

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.12

export function useRhythmEngine({
  playing,
  bpm,
  mode,
  bars,
  clickSound,
}: {
  playing: boolean
  bpm: number
  mode: RhythmMode
  bars: readonly RhythmBar[]
  clickSound: ClickSoundId
}) {
  const [playhead, setPlayhead] = useState<Playhead>({
    bar: 0,
    step: -1,
    beat: -1,
    accent: false,
    subdivision: false,
  })

  const kitRef = useRef<RhythmKit | null>(null)
  const kitPromiseRef = useRef<Promise<RhythmKit | null> | null>(null)
  const timerRef = useRef<number | null>(null)
  const visualRef = useRef<number[]>([])
  const nextTimeRef = useRef(0)
  const stepRef = useRef(0)
  const barRef = useRef(0)
  const playingRef = useRef(playing)
  const bpmRef = useRef(bpm)
  const modeRef = useRef(mode)
  const barsRef = useRef(bars)
  const clickRef = useRef(clickSound)

  playingRef.current = playing
  bpmRef.current = bpm
  modeRef.current = mode
  barsRef.current = bars
  clickRef.current = clickSound

  const clearVisuals = useCallback(() => {
    for (const id of visualRef.current) window.clearTimeout(id)
    visualRef.current = []
  }, [])

  const ensureKit = useCallback(async () => {
    if (kitRef.current) {
      await kitRef.current.unlock()
      return kitRef.current
    }
    if (!kitPromiseRef.current) {
      const Ctor = getAudioCtor()
      if (!Ctor) return null
      kitPromiseRef.current = (async () => {
        try {
          const kit = await RhythmKit.create(new Ctor())
          kitRef.current = kit
          return kit
        } catch {
          kitPromiseRef.current = null
          return null
        }
      })()
    }
    const kit = await kitPromiseRef.current
    if (kit) await kit.unlock()
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

  const previewClick = useCallback(
    async (sound: ClickSoundId) => {
      const kit = await ensureKit()
      if (!kit) return
      kit.previewClick(sound, true)
    },
    [ensureKit],
  )

  const stopScheduler = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    clearVisuals()
    setPlayhead({ bar: 0, step: -1, beat: -1, accent: false, subdivision: false })
    stepRef.current = 0
    barRef.current = 0
  }, [clearVisuals])

  useEffect(() => {
    if (mode === 'drums') void ensureKit()
  }, [mode, ensureKit])

  const structureKey = bars.map((bar) => `${bar.beats}/${bar.beatUnit}/${bar.subdivision}`).join('|')

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
      barRef.current = 0
      nextTimeRef.current = kit.ctx.currentTime + 0.05

      const scheduleStep = (barIndex: number, step: number, time: number) => {
        const sequence = barsRef.current
        const bar = sequence[barIndex] ?? sequence[0]
        if (!bar) return
        const beat = beatIndexForStep(step, bar.beats, bar.subdivision)
        const onBeat = isBeatStep(step, bar.subdivision)
        const accent = onBeat && bar.accents.includes(beat)
        if (modeRef.current === 'click') {
          if (onBeat) kit.click(time, accent, clickRef.current, 1)
          else kit.click(time, false, clickRef.current, 0.32)
        } else {
          const grid = bar.pattern
          const open = grid.openHat[step]
          for (const voice of VOICES) {
            if (voice === 'closedHat' && open) continue
            if (grid[voice]?.[step]) kit.hit(voice, time, accent)
          }
        }

        const delay = Math.max(0, (time - kit.ctx.currentTime) * 1000)
        const id = window.setTimeout(() => {
          if (!playingRef.current) return
          setPlayhead({
            bar: barIndex,
            step,
            beat,
            accent,
            subdivision: !onBeat,
          })
        }, delay)
        visualRef.current.push(id)
      }

      const tick = () => {
        if (!playingRef.current) return
        const sequence = barsRef.current
        if (sequence.length === 0) return
        while (nextTimeRef.current < kit.ctx.currentTime + SCHEDULE_AHEAD) {
          const barIndex = ((barRef.current % sequence.length) + sequence.length) % sequence.length
          const bar = sequence[barIndex]
          const length = Math.max(1, stepsInBar(bar))
          const step = stepRef.current
          scheduleStep(barIndex, step, nextTimeRef.current)
          nextTimeRef.current += stepDurationSec(bpmRef.current, bar.subdivision)
          const nextStep = step + 1
          if (nextStep >= length) {
            stepRef.current = 0
            barRef.current = (barIndex + 1) % sequence.length
          } else {
            stepRef.current = nextStep
          }
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
  }, [ensureKit, playing, stopScheduler, clearVisuals, structureKey])

  useEffect(() => {
    return () => {
      stopScheduler()
      const kit = kitRef.current
      kitRef.current = null
      kitPromiseRef.current = null
      if (kit) {
        window.setTimeout(() => {
          void kit.ctx.close()
        }, 200)
      }
    }
  }, [stopScheduler])

  return { playhead, preview, previewClick, ensureKit }
}
