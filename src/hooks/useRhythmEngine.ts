import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { DEFAULT_KIT_INTENSITY, snareHitRole, type HitRole, type KitIntensity } from '@/lib/kit-intensity'
import { DEFAULT_KIT_MIX, type KitMix } from '@/lib/kit-mix'
import { getOrCreateRhythmKit, type RhythmKit } from '@/lib/rhythm-audio'
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
/** Paint the step a frame early so React/DOM land with the audible hit. */
const VISUAL_LEAD = 0.02

const IDLE_PLAYHEAD: Playhead = { bar: 0, step: -1, beat: -1, accent: 0, subdivision: false }

export type PlayheadStore = {
  getSnapshot: () => Playhead
  subscribe: (onStoreChange: () => void) => () => void
}

type PlayheadWriter = PlayheadStore & { set: (next: Playhead) => void }

function createPlayheadStore(): PlayheadWriter {
  let snapshot = IDLE_PLAYHEAD
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => {
        listeners.delete(onStoreChange)
      }
    },
    set: (next) => {
      if (
        snapshot.bar === next.bar &&
        snapshot.step === next.step &&
        snapshot.beat === next.beat &&
        snapshot.accent === next.accent &&
        snapshot.subdivision === next.subdivision
      ) {
        return
      }
      snapshot = next
      for (const listener of listeners) listener()
    },
  }
}

export function usePlayhead(store: PlayheadStore): Playhead {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

export function usePlayheadBar(store: PlayheadStore): number {
  return useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().bar,
    () => store.getSnapshot().bar,
  )
}

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
  kitIntensity = DEFAULT_KIT_INTENSITY,
}: {
  playing: boolean
  bpm: number
  mode: RhythmMode
  bars: readonly RhythmBar[]
  clickSound: ClickSoundId
  kitMix?: KitMix
  kitIntensity?: KitIntensity
}) {
  const [holdUntilCycle, setHoldUntilCycle] = useState(false)
  const playheadStoreRef = useRef<PlayheadWriter | null>(null)
  if (!playheadStoreRef.current) playheadStoreRef.current = createPlayheadStore()
  const playheadStore = playheadStoreRef.current

  const kitRef = useRef<RhythmKit | null>(null)
  const timerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const cuesRef = useRef<Array<Playhead & { time: number }>>([])
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
  const intensityRef = useRef(kitIntensity)

  playingRef.current = playing
  bpmRef.current = bpm
  clickRef.current = clickSound
  pendingModeRef.current = mode
  pendingBarsRef.current = bars
  kitMixRef.current = kitMix
  intensityRef.current = kitIntensity

  if (!playing || liveModeRef.current !== mode) {
    liveModeRef.current = mode
    liveBarsRef.current = bars
  }

  const clearVisuals = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    cuesRef.current = []
  }, [])

  const grabKit = useCallback(() => {
    const kit = getOrCreateRhythmKit()
    if (!kit) return null
    kit.setMix(kitMixRef.current)
    kit.setIntensity(intensityRef.current)
    kitRef.current = kit
    return kit
  }, [])

  const ensureKit = useCallback(async () => {
    const kit = grabKit()
    if (!kit) return null
    await kit.unlock()
    return kit
  }, [grabKit])

  const preview = useCallback(
    (voice: VoiceId, role: HitRole = 'backbeat') => {
      const kit = grabKit()
      if (!kit) return
      kit.previewVoice(voice, role)
    },
    [grabKit],
  )

  const previewClick = useCallback(
    (sound: ClickSoundId, level: AccentLevel = 2, onBeat = true) => {
      const kit = grabKit()
      if (!kit) return
      kit.previewClick(sound, level, onBeat)
    },
    [grabKit],
  )

  const previewBar = useCallback(
    (bar: RhythmBar) => {
      const kit = grabKit()
      if (!kit || playingRef.current) return
      void kit.unlock()
      kit.stopAll()
      const start = kit.ctx.currentTime
      const tempo = bpmRef.current
      for (const voice of VOICES) {
        for (const hit of bar.pattern[voice] ?? []) {
          if (hit.beat < 0 || hit.beat >= bar.beats) continue
          kit.hit(voice, start + hitTimeInBar(hit, tempo), voice === 'snare' ? snareHitRole(hit) : 'normal')
        }
      }
    },
    [grabKit],
  )

  const previewClickBar = useCallback(
    (bar: RhythmBar) => {
      const kit = grabKit()
      if (!kit || playingRef.current) return
      void kit.unlock()
      kit.stopAll()
      const start = kit.ctx.currentTime
      const stepSec = stepDurationSec(bpmRef.current, bar.subdivision)
      const length = Math.max(1, stepsInBar(bar))
      const steps = stepsPerBeat(bar.subdivision)
      for (let step = 0; step < length; step += 1) {
        const beat = beatIndexForStep(step, bar.beats, bar.subdivision)
        const onBeat = isBeatStep(step, bar.subdivision)
        const slot = step % Math.max(1, steps)
        const accent = nestAccent(
          beatAccentAt(bar.beatAccents, beat),
          subdivAccentAt(bar.subdivAccents, slot, steps),
        )
        kit.click(start + step * stepSec, accent, clickRef.current, onBeat)
      }
    },
    [grabKit],
  )

  const stopScheduler = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    clearVisuals()
    kitRef.current?.stopAll()
    playheadStore.set(IDLE_PLAYHEAD)
    setHoldUntilCycle(false)
    stepRef.current = 0
    barRef.current = 0
    armedBarRef.current = null
  }, [clearVisuals])

  useEffect(() => {
    void ensureKit()
  }, [ensureKit])

  useEffect(() => {
    kitRef.current?.setMix(kitMix)
  }, [kitMix])

  useEffect(() => {
    kitRef.current?.setIntensity(kitIntensity)
  }, [kitIntensity])

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
            kit.hit(voice, barStart + hitTimeInBar(hit, bpmRef.current), voice === 'snare' ? snareHitRole(hit) : 'normal')
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

        cuesRef.current.push({
          time,
          bar: barIndex,
          step,
          beat,
          accent,
          subdivision: !onBeat,
        })
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

      const pumpVisuals = () => {
        if (!playingRef.current) return
        const due = kit.ctx.currentTime + VISUAL_LEAD
        const queue = cuesRef.current
        let latest: (Playhead & { time: number }) | null = null
        let count = 0
        for (const cue of queue) {
          if (cue.time > due) break
          latest = cue
          count += 1
        }
        if (count > 0) queue.splice(0, count)
        if (latest) {
          playheadStore.set({
            bar: latest.bar,
            step: latest.step,
            beat: latest.beat,
            accent: latest.accent,
            subdivision: latest.subdivision,
          })
        }
        rafRef.current = window.requestAnimationFrame(pumpVisuals)
      }

      tick()
      timerRef.current = window.setInterval(tick, LOOKAHEAD_MS)
      rafRef.current = window.requestAnimationFrame(pumpVisuals)
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
      kitRef.current = null
    }
  }, [stopScheduler])

  return {
    playheadStore,
    preview,
    previewClick,
    previewBar,
    previewClickBar,
    ensureKit,
    holdUntilCycle,
    halt: stopScheduler,
  }
}
