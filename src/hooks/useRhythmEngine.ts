import { useCallback, useEffect, useRef, useState } from 'react'

import { DEFAULT_KIT_MIX, type KitMix } from '@/lib/kit-mix'
import { getAudioCtor, RhythmKit } from '@/lib/rhythm-audio'
import {
  VOICES,
  beatAccentAt,
  beatIndexForStep,
  hitTimeInBar,
  isBeatStep,
  nestAccent,
  stepDurationSec,
  stepsInBar,
  stepsPerBeat,
  subdivAccentAt,
  type AccentLevel,
  type ClickSoundId,
  type RhythmBar,
  type RhythmMode,
  type VoiceId,
} from '@/lib/rhythm'

export type Playhead = {
  bar: number
  step: number
  beat: number
  accent: AccentLevel
  subdivision: boolean
}

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.12

function cycleSignature(mode: RhythmMode, bars: readonly RhythmBar[]): string {
  return [
    mode,
    String(bars.length),
    ...bars.map(
      (bar) =>
        `${bar.beats}/${bar.beatUnit}/${bar.subdivision}:${JSON.stringify(bar.beatAccents)}:${JSON.stringify(bar.subdivAccents)}`,
    ),
  ].join('|')
}

export function useRhythmEngine({
  playing,
  bpm,
  mode,
  bars,
  clickSound,
  kitMix = DEFAULT_KIT_MIX,
}: {
  playing: boolean
  bpm: number
  mode: RhythmMode
  bars: readonly RhythmBar[]
  clickSound: ClickSoundId
  kitMix?: KitMix
}) {
  const [playhead, setPlayhead] = useState<Playhead>({
    bar: 0,
    step: -1,
    beat: -1,
    accent: 0,
    subdivision: false,
  })
  const [holdUntilCycle, setHoldUntilCycle] = useState(false)

  const kitRef = useRef<RhythmKit | null>(null)
  const kitPromiseRef = useRef<Promise<RhythmKit | null> | null>(null)
  const timerRef = useRef<number | null>(null)
  const visualRef = useRef<number[]>([])
  const nextTimeRef = useRef(0)
  const stepRef = useRef(0)
  const barRef = useRef(0)
  const playingRef = useRef(playing)
  const bpmRef = useRef(bpm)
  const clickRef = useRef(clickSound)
  const armedBarRef = useRef<number | null>(null)
  const pendingModeRef = useRef(mode)
  const pendingBarsRef = useRef(bars)
  const liveModeRef = useRef(mode)
  const liveBarsRef = useRef(bars)
  const kitMixRef = useRef(kitMix)

  playingRef.current = playing
  bpmRef.current = bpm
  clickRef.current = clickSound
  pendingModeRef.current = mode
  pendingBarsRef.current = bars
  kitMixRef.current = kitMix

  if (!playing) {
    liveModeRef.current = mode
    liveBarsRef.current = bars
  }

  const clearVisuals = useCallback(() => {
    for (const id of visualRef.current) window.clearTimeout(id)
    visualRef.current = []
  }, [])

  const ensureKit = useCallback(async () => {
    if (kitRef.current) {
      kitRef.current.setMix(kitMixRef.current)
      await kitRef.current.unlock()
      return kitRef.current
    }
    if (!kitPromiseRef.current) {
      const Ctor = getAudioCtor()
      if (!Ctor) return null
      kitPromiseRef.current = (async () => {
        try {
          const kit = await RhythmKit.create(new Ctor())
          kit.setMix(kitMixRef.current)
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
    async (sound: ClickSoundId, level: AccentLevel = 2, onBeat = true) => {
      const kit = await ensureKit()
      if (!kit) return
      kit.previewClick(sound, level, onBeat)
    },
    [ensureKit],
  )

  const stopScheduler = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    clearVisuals()
    setPlayhead({ bar: 0, step: -1, beat: -1, accent: 0, subdivision: false })
    setHoldUntilCycle(false)
    stepRef.current = 0
    barRef.current = 0
    armedBarRef.current = null
  }, [clearVisuals])

  useEffect(() => {
    if (mode === 'drums' || pendingModeRef.current === 'drums') void ensureKit()
  }, [mode, ensureKit])

  useEffect(() => {
    kitRef.current?.setMix(kitMix)
  }, [kitMix])

  useEffect(() => {
    if (!playing) {
      setHoldUntilCycle(false)
      return
    }
    const queued =
      cycleSignature(liveModeRef.current, liveBarsRef.current) !==
      cycleSignature(pendingModeRef.current, pendingBarsRef.current)
    setHoldUntilCycle(queued)
  }, [bars, mode, playing])

  useEffect(() => {
    if (!playing) {
      stopScheduler()
      return
    }

    let cancelled = false

    const start = async () => {
      const kit = await ensureKit()
      if (!kit || cancelled || !playingRef.current) return

      liveModeRef.current = pendingModeRef.current
      liveBarsRef.current = pendingBarsRef.current
      setHoldUntilCycle(false)
      stepRef.current = 0
      barRef.current = 0
      armedBarRef.current = null
      nextTimeRef.current = kit.ctx.currentTime + 0.05

      const commitPendingCycle = () => {
        liveModeRef.current = pendingModeRef.current
        liveBarsRef.current = pendingBarsRef.current
        armedBarRef.current = null
        setHoldUntilCycle(false)
      }

      const playbackBar = (index: number): RhythmBar | undefined => {
        const liveSeq = liveBarsRef.current
        const live = liveSeq[index] ?? liveSeq[0]
        if (!live) return pendingBarsRef.current[index]
        const pending = pendingBarsRef.current[index]
        if (
          pending &&
          pending.beats === live.beats &&
          pending.beatUnit === live.beatUnit &&
          pending.subdivision === live.subdivision
        ) {
          return { ...live, pattern: pending.pattern }
        }
        return live
      }

      const armDrumBar = (barIndex: number, barStart: number) => {
        if (liveModeRef.current !== 'drums') return
        if (armedBarRef.current === barIndex && stepRef.current !== 0) return
        armedBarRef.current = barIndex
        const bar = playbackBar(barIndex)
        if (!bar) return
        for (const voice of VOICES) {
          for (const hit of bar.pattern[voice] ?? []) {
            if (hit.beat < 0 || hit.beat >= bar.beats) continue
            kit.hit(voice, barStart + hitTimeInBar(hit, bpmRef.current), false)
          }
        }
      }

      const scheduleStep = (barIndex: number, step: number, time: number) => {
        const bar = playbackBar(barIndex)
        if (!bar) return
        const beat = beatIndexForStep(step, bar.beats, bar.subdivision)
        const onBeat = isBeatStep(step, bar.subdivision)
        const steps = stepsPerBeat(bar.subdivision)
        const slot = step % Math.max(1, steps)
        const accent = nestAccent(
          beatAccentAt(bar.beatAccents, beat),
          subdivAccentAt(bar.subdivAccents, slot, steps),
        )
        if (step === 0) armDrumBar(barIndex, time)
        if (liveModeRef.current === 'click') {
          kit.click(time, accent, clickRef.current, onBeat)
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
        while (nextTimeRef.current < kit.ctx.currentTime + SCHEDULE_AHEAD) {
          const sequence = liveBarsRef.current
          if (sequence.length === 0) return
          const barIndex = ((barRef.current % sequence.length) + sequence.length) % sequence.length
          const bar = playbackBar(barIndex)
          if (!bar) return
          const length = Math.max(1, stepsInBar(bar))
          const step = stepRef.current
          scheduleStep(barIndex, step, nextTimeRef.current)
          nextTimeRef.current += stepDurationSec(bpmRef.current, bar.subdivision)
          const nextStep = step + 1
          if (nextStep >= length) {
            const wrapped = (barIndex + 1) % sequence.length
            stepRef.current = 0
            if (wrapped === 0) {
              commitPendingCycle()
              barRef.current = 0
            } else {
              barRef.current = wrapped
            }
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
  }, [ensureKit, playing, stopScheduler, clearVisuals])

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

  return { playhead, preview, previewClick, ensureKit, holdUntilCycle }
}
