import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

import { DEFAULT_INTENSITY_STYLE, DEFAULT_KIT_INTENSITY, type HitRole, type KitIntensity } from '@/lib/kit-intensity'
import { realizeDrumBar } from '@/lib/kit-intensity-play'
import { DEFAULT_KIT_MIX, DEFAULT_MASTER_VOLUME_DB, type KitMix } from '@/lib/kit-mix'
import { noteTransportStop, onCaptureStarting } from '@/lib/audio-context'
import { claimListenPreview } from '@/lib/listen-preview'
import {
  LOOKAHEAD_MS,
  START_LEAD_SEC,
  createClockWatch,
  noteStartTime,
  rebaseNoteTime,
  scheduleHorizon,
  watchClock,
  type ClockWatch,
} from '@/lib/lookahead-scheduler'
import { captureAudioTime } from '@/lib/drum-recorder'
import { getOrCreateRhythmKit, type RhythmKit } from '@/lib/rhythm-audio'
import {
  barDurationSec,
  beatAccentAt,
  beatDurationSec,
  beatIndexForStep,
  clickPulsesInBar,
  hitTimeInBar,
  isBeatStep,
  LIVE_COMMIT_SEC,
  planLiveTempoRetarget,
  stepDurationSec,
  stepsInBar,
  type AccentLevel,
  type ClickSoundId,
  type RhythmBar,
  type RhythmMode,
  type VoiceId,
} from '@/lib/rhythm'
import type { RhythmStyleId } from '@/lib/rhythm-presets'
import {
  DEFAULT_SPEED_BUILDER,
  nextSbPct,
  sbBpm,
  shouldStartPrecount,
  shouldStepAfterRepeats,
  type SpeedBuilder,
  type SpeedBuilderCue,
} from '@/lib/speed-builder'

export type Playhead = {
  bar: number
  step: number
  beat: number
  accent: AccentLevel
  subdivision: boolean
  precount: boolean
}

export type TransportClock = {
  audioTime: number
  captureTime: number
  barStart: number
  barDur: number
  barIndex: number
  precount: boolean
  playing: boolean
  outputLatency: number
}

const IDLE_PLAYHEAD: Playhead = { bar: 0, step: -1, beat: -1, accent: 0, subdivision: false, precount: false }
/** Paint the step a frame early so React/DOM land with the audible hit. */
const VISUAL_LEAD = 0.02
/** Voices closer than this stay; we only cancel/reschedule what's still in the future. */
const COMMIT_SEC = LIVE_COMMIT_SEC

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
        snapshot.subdivision === next.subdivision &&
        snapshot.precount === next.precount
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
        `${bar.beats}/${bar.beatUnit}/${bar.subdivision}:${JSON.stringify(bar.beatAccents)}:${JSON.stringify(bar.beatSubdivisions)}`,
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
  volumeDb = DEFAULT_MASTER_VOLUME_DB,
  kitIntensity = DEFAULT_KIT_INTENSITY,
  kitStyle = DEFAULT_INTENSITY_STYLE,
  speedBuilder = DEFAULT_SPEED_BUILDER,
  onTempoCue,
  loopBarIndex = null,
  recordCycle = false,
  recordClick = false,
  forcePrecount,
  onBarLoop,
}: {
  playing: boolean
  bpm: number
  mode: RhythmMode
  bars: readonly RhythmBar[]
  clickSound: ClickSoundId
  kitMix?: KitMix
  volumeDb?: number
  kitIntensity?: KitIntensity
  kitStyle?: RhythmStyleId
  speedBuilder?: SpeedBuilder
  onTempoCue?: (cue: SpeedBuilderCue) => void
  /** When set, the scheduler stays on this bar (legacy 1-bar loop). */
  loopBarIndex?: number | null
  /** Recorder plays every bar in order, then loops from bar 1. */
  recordCycle?: boolean
  /** Metronome click on each beat while the recorder is looping (not written into the grid). */
  recordClick?: boolean
  /** Recorder count-in: true force on, false force off, undefined = existing Drums/SB rules. */
  forcePrecount?: boolean
  onBarLoop?: () => void
}) {
  const [holdUntilCycle, setHoldUntilCycle] = useState(false)
  const [liveBpm, setLiveBpm] = useState(bpm)
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
  const volumeDbRef = useRef(volumeDb)
  const intensityRef = useRef(kitIntensity)
  const styleRef = useRef(kitStyle)
  const speedBuilderRef = useRef(speedBuilder)
  const onTempoCueRef = useRef(onTempoCue)
  const loopBarRef = useRef(loopBarIndex)
  const recordCycleRef = useRef(recordCycle)
  const recordClickRef = useRef(recordClick)
  const forcePrecountRef = useRef(forcePrecount)
  const onBarLoopRef = useRef(onBarLoop)
  const playbackBpmRef = useRef(bpm)
  const sbPctRef = useRef(speedBuilder.fromPct)
  const sbPhaseRef = useRef<'pattern' | 'precount'>('pattern')
  const precountBeatRef = useRef(0)
  const sbSessionRef = useRef(false)
  const sbRepeatRef = useRef(0)
  const barStartRef = useRef(0)
  const barTempoRef = useRef(bpm)
  const retargetRef = useRef<(reason: 'tempo' | 'intensity') => void>(() => undefined)
  const clockWatchRef = useRef<ClockWatch>(createClockWatch(0, 0))
  const freezeResumeRef = useRef(false)

  playingRef.current = playing
  bpmRef.current = bpm
  clickRef.current = clickSound
  pendingModeRef.current = mode
  pendingBarsRef.current = bars
  kitMixRef.current = kitMix
  volumeDbRef.current = volumeDb
  intensityRef.current = kitIntensity
  styleRef.current = kitStyle
  speedBuilderRef.current = speedBuilder
  onTempoCueRef.current = onTempoCue
  loopBarRef.current = loopBarIndex
  recordCycleRef.current = recordCycle
  recordClickRef.current = recordClick
  forcePrecountRef.current = forcePrecount
  onBarLoopRef.current = onBarLoop

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
    kit.setMasterVolume(volumeDbRef.current)
    kit.setPerformance(styleRef.current, intensityRef.current)
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
      const realized = realizeDrumBar(bar, intensityRef.current)
      for (const ev of realized.hits) {
        if (ev.hit.beat < 0 || ev.hit.beat >= bar.beats) continue
        kit.hit(ev.voice, start + hitTimeInBar(ev.hit, tempo, bar.beatUnit), ev.role, {
          tier: ev.tier,
          blendTier: ev.blendTier,
          blendMix: ev.blendMix,
          vel: ev.vel,
          rimshot: ev.rimshot,
        })
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
      for (const pulse of clickPulsesInBar(bar, bpmRef.current)) {
        const accent = pulse.onBeat ? beatAccentAt(bar.beatAccents, pulse.beat) : 0
        kit.click(start + pulse.offsetSec, accent, clickRef.current, pulse.onBeat)
      }
    },
    [grabKit],
  )

  const stopScheduler = useCallback((reason = 'scheduler') => {
    const wasRunning = timerRef.current !== null
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (wasRunning) noteTransportStop(reason)
    clearVisuals()
    kitRef.current?.stopAll()
    playheadStore.set(IDLE_PLAYHEAD)
    setHoldUntilCycle(false)
    setLiveBpm(bpmRef.current)
    playbackBpmRef.current = bpmRef.current
    sbPhaseRef.current = 'pattern'
    precountBeatRef.current = 0
    sbSessionRef.current = false
    sbRepeatRef.current = 0
    stepRef.current = 0
    barRef.current = 0
    armedBarRef.current = null
    barStartRef.current = 0
    barTempoRef.current = bpmRef.current
    retargetRef.current = () => undefined
  }, [clearVisuals])

  useEffect(() => {
    void ensureKit()
  }, [ensureKit])

  useEffect(() => {
    kitRef.current?.setMix(kitMix)
  }, [kitMix])

  useEffect(() => {
    kitRef.current?.setMasterVolume(volumeDb)
  }, [volumeDb])

  useLayoutEffect(() => {
    kitRef.current?.setPerformance(kitStyle, kitIntensity)
    if (playing) retargetRef.current('intensity')
  }, [kitIntensity, kitStyle, playing])

  useLayoutEffect(() => {
    if (!playing) {
      setLiveBpm(bpm)
      return
    }
    retargetRef.current('tempo')
  }, [bpm, playing])

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
    return onCaptureStarting(() => {
      if (playingRef.current) stopScheduler('capture-starting')
    })
  }, [stopScheduler])

  useEffect(() => {
    if (!playing) {
      stopScheduler('playing-false')
      return
    }

    let cancelled = false

    const start = () => {
      claimListenPreview()
      const kit = grabKit()
      if (!kit || cancelled || !playingRef.current) return
      void kit.unlock()

      liveModeRef.current = pendingModeRef.current
      liveBarsRef.current = pendingBarsRef.current
      setHoldUntilCycle(false)
      stepRef.current = 0
      const loopStart = loopBarRef.current
      barRef.current = recordCycleRef.current ? 0 : (loopStart ?? 0)
      armedBarRef.current = null
      freezeResumeRef.current = false
      clockWatchRef.current = createClockWatch(kit.ctx.currentTime, performance.now())
      nextTimeRef.current = kit.ctx.currentTime + START_LEAD_SEC

      const sb = speedBuilderRef.current
      const looping = loopBarRef.current != null || recordCycleRef.current
      const sbStart = sb.enabled && !looping
      sbSessionRef.current = sbStart
      sbPctRef.current = sb.fromPct
      sbRepeatRef.current = 0
      playbackBpmRef.current = sbStart ? sbBpm(bpmRef.current, sb.fromPct) : bpmRef.current
      barStartRef.current = nextTimeRef.current
      barTempoRef.current = playbackBpmRef.current
      setLiveBpm(playbackBpmRef.current)
      if (sbStart) {
        onTempoCueRef.current?.({
          pct: sb.fromPct,
          bpm: playbackBpmRef.current,
          reason: sb.fromPct === sb.toPct ? 'goal' : 'start',
        })
        if (sb.announce) kit.announce(nextTimeRef.current, sb.fromPct)
      }
      const wantPrecount =
        forcePrecountRef.current === true
          ? true
          : forcePrecountRef.current === false
            ? false
            : shouldStartPrecount(liveModeRef.current, sb)
      sbPhaseRef.current = wantPrecount ? 'precount' : 'pattern'
      precountBeatRef.current = 0

      const commitPendingCycle = () => {
        liveModeRef.current = pendingModeRef.current
        liveBarsRef.current = pendingBarsRef.current
        armedBarRef.current = null
        setHoldUntilCycle(false)
      }

      const playbackBar = (index: number): RhythmBar | undefined => {
        if (loopBarRef.current != null || recordCycleRef.current) {
          return pendingBarsRef.current[index] ?? liveBarsRef.current[index]
        }
        const liveSeq = liveBarsRef.current
        const live = liveSeq[index] ?? liveSeq[0]
        if (!live) return pendingBarsRef.current[index]
        const pending = pendingBarsRef.current[index]
        if (
          pending &&
          pending.beats === live.beats &&
          pending.beatUnit === live.beatUnit &&
          pending.subdivision === live.subdivision &&
          JSON.stringify(pending.beatSubdivisions) === JSON.stringify(live.beatSubdivisions)
        ) {
          return { ...live, pattern: pending.pattern }
        }
        return live
      }

      const armDrumHitsFrom = (barIndex: number, barStart: number, afterTime: number) => {
        if (liveModeRef.current !== 'drums') return
        const bar = playbackBar(barIndex)
        if (!bar) return
        const tempo = playbackBpmRef.current
        const realized = realizeDrumBar(bar, intensityRef.current)
        for (const ev of realized.hits) {
          if (ev.hit.beat < 0 || ev.hit.beat >= bar.beats) continue
          const when = barStart + hitTimeInBar(ev.hit, tempo, bar.beatUnit)
          if (when <= afterTime) continue
          kit.hit(ev.voice, when, ev.role, {
            tier: ev.tier,
            blendTier: ev.blendTier,
            blendMix: ev.blendMix,
            vel: ev.vel,
            rimshot: ev.rimshot,
          })
        }
        armedBarRef.current = barIndex
      }

      const armDrumBar = (barIndex: number, barStart: number) => {
        if (liveModeRef.current !== 'drums') return
        if (armedBarRef.current === barIndex) return
        armDrumHitsFrom(barIndex, barStart, barStart - 0.001)
      }

      const scheduleDrumStep = (barIndex: number, step: number, time: number) => {
        const bar = playbackBar(barIndex)
        if (!bar) return
        const beat = beatIndexForStep(step, bar.beats, bar.subdivision)
        const onBeat = isBeatStep(step, bar.subdivision)
        if (step === 0) armDrumBar(barIndex, time)
        cuesRef.current.push({
          time,
          bar: barIndex,
          step,
          beat,
          accent: 0,
          subdivision: !onBeat,
          precount: false,
        })
      }

      const scheduleClickPulse = (
        barIndex: number,
        bar: RhythmBar,
        step: number,
        playTime: number,
        cueTime: number,
      ) => {
        const pulses = clickPulsesInBar(bar, playbackBpmRef.current)
        const pulse = pulses[step]
        if (!pulse) return
        const accent = pulse.onBeat ? beatAccentAt(bar.beatAccents, pulse.beat) : 0
        kit.click(playTime, accent, clickRef.current, pulse.onBeat)
        cuesRef.current.push({
          time: cueTime,
          bar: barIndex,
          step: pulse.slot,
          beat: pulse.beat,
          accent,
          subdivision: !pulse.onBeat,
          precount: false,
        })
      }

      const applyPlaybackBpm = () => {
        if (sbSessionRef.current && speedBuilderRef.current.enabled) {
          playbackBpmRef.current = sbBpm(bpmRef.current, sbPctRef.current)
        } else {
          playbackBpmRef.current = bpmRef.current
          sbSessionRef.current = false
        }
        const next = playbackBpmRef.current
        setLiveBpm((current) => (current === next ? current : next))
        return next
      }

      const currentBarIndex = () => {
        const locked = loopBarRef.current
        const sequence = liveBarsRef.current
        if (sequence.length === 0) return 0
        if (locked != null) {
          return ((locked % sequence.length) + sequence.length) % sequence.length
        }
        return ((barRef.current % sequence.length) + sequence.length) % sequence.length
      }

      let tick: () => void = () => undefined

      const retarget = (reason: 'tempo' | 'intensity') => {
        if (!playingRef.current) return
        const now = kit.ctx.currentTime
        const commit = now + COMMIT_SEC

        if (reason === 'intensity') {
          kit.cancelFuture(commit, 'drum')
          if (liveModeRef.current === 'drums' && sbPhaseRef.current === 'pattern') {
            armDrumHitsFrom(currentBarIndex(), barStartRef.current, commit)
          }
          return
        }

        const oldBpm = barTempoRef.current
        const newBpm = applyPlaybackBpm()
        if (Math.abs(oldBpm - newBpm) < 1e-6) return
        barTempoRef.current = newBpm
        kit.cancelFuture(commit)
        cuesRef.current = cuesRef.current.filter((cue) => cue.time <= now + VISUAL_LEAD)

        if (sbPhaseRef.current === 'precount') {
          const remaining = Math.max(0, nextTimeRef.current - now)
          nextTimeRef.current = now + remaining * (oldBpm / newBpm)
          tick()
          return
        }

        const sequence = liveBarsRef.current
        if (sequence.length === 0) return
        const barIndex = currentBarIndex()
        const bar = playbackBar(barIndex)
        if (!bar) return

        const clickMode = liveModeRef.current === 'click'
        const offsets = clickMode
          ? clickPulsesInBar(bar, newBpm).map((pulse) => pulse.offsetSec)
          : Array.from({ length: Math.max(1, stepsInBar(bar)) }, (_, step) => {
              return step * stepDurationSec(newBpm, bar.subdivision, bar.beatUnit)
            })
        const plan = planLiveTempoRetarget(
          now,
          barStartRef.current,
          oldBpm,
          newBpm,
          offsets,
          bar.beats,
          COMMIT_SEC,
          bar.beatUnit,
        )
        barStartRef.current = plan.newBarStart

        if (liveModeRef.current === 'drums') {
          armDrumHitsFrom(barIndex, plan.newBarStart, plan.commit)
        }

        if (plan.next.wrap) {
          const wrapped = (barIndex + 1) % sequence.length
          if (wrapped === 0) commitPendingCycle()
          barRef.current = wrapped
          stepRef.current = 0
          armedBarRef.current = null
          nextTimeRef.current = plan.next.time
          tick()
          return
        }

        stepRef.current = plan.next.index
        nextTimeRef.current = plan.next.time
        if (clickMode) armedBarRef.current = null
        tick()
      }

      const beginPrecount = () => {
        sbPhaseRef.current = 'precount'
        precountBeatRef.current = 0
        stepRef.current = 0
        barRef.current = 0
      }

      const advanceSpeedBuilder = (atTime: number) => {
        if (!sbSessionRef.current) return false
        const cfg = speedBuilderRef.current
        if (!cfg.enabled) {
          sbSessionRef.current = false
          applyPlaybackBpm()
          return false
        }
        const prev = sbPctRef.current
        const atGoal = prev === cfg.toPct
        sbRepeatRef.current += 1
        if (!shouldStepAfterRepeats(sbRepeatRef.current, cfg.repeats, atGoal)) return false
        sbRepeatRef.current = 0
        const next = nextSbPct(prev, cfg.fromPct, cfg.toPct, cfg.stepPct)
        sbPctRef.current = next
        applyPlaybackBpm()
        onTempoCueRef.current?.({
          pct: next,
          bpm: playbackBpmRef.current,
          reason: next === cfg.toPct ? 'goal' : 'step',
        })
        if (cfg.announce) kit.announce(atTime, next)
        if (cfg.precount) {
          beginPrecount()
          return true
        }
        return false
      }

      tick = () => {
        if (!playingRef.current) return
        const audioTime = kit.ctx.currentTime
        const observed = watchClock(clockWatchRef.current, audioTime, performance.now())
        if (observed.frozen && !freezeResumeRef.current) {
          freezeResumeRef.current = true
          void kit.ctx.resume().catch(() => undefined)
        }
        const now = observed.frozen ? observed.virtualNow : audioTime
        const rebased = rebaseNoteTime(nextTimeRef.current, now, START_LEAD_SEC, observed.frozen)
        if (rebased !== nextTimeRef.current) {
          nextTimeRef.current = rebased
          barStartRef.current = rebased
        }
        const horizon = scheduleHorizon(audioTime, observed.virtualNow, observed.frozen)
        while (nextTimeRef.current < horizon) {
          const tempo = applyPlaybackBpm()
          const sequence = liveBarsRef.current
          if (sequence.length === 0) return
          const slotTime = nextTimeRef.current
          const playTime = noteStartTime(slotTime, observed.frozen)

          if (sbPhaseRef.current === 'precount') {
            const locked = loopBarRef.current
            const first =
              playbackBar(locked ?? 0) ??
              sequence[locked ?? 0] ??
              sequence[0]
            if (!first) return
            const beat = precountBeatRef.current
            const strong = beat === 0
            kit.precount(playTime, strong)
            cuesRef.current.push({
              time: slotTime,
              bar: locked ?? 0,
              step: 0,
              beat,
              accent: strong ? 2 : 0,
              subdivision: false,
              precount: true,
            })
            nextTimeRef.current = slotTime + beatDurationSec(tempo, first.beatUnit)
            precountBeatRef.current = beat + 1
            if (precountBeatRef.current >= first.beats) {
              sbPhaseRef.current = 'pattern'
              stepRef.current = 0
              barRef.current = locked ?? 0
            }
            continue
          }

          const barIndex = currentBarIndex()
          const bar = playbackBar(barIndex)
          if (!bar) return
          const clickMode = liveModeRef.current === 'click'
          const pulses = clickMode ? clickPulsesInBar(bar, tempo) : []
          const length = clickMode ? Math.max(1, pulses.length) : Math.max(1, stepsInBar(bar))
          const step = stepRef.current
          const pulse = pulses[step]
          if (step === 0) {
            barStartRef.current = slotTime
            barTempoRef.current = tempo
          }

          if (clickMode) scheduleClickPulse(barIndex, bar, step, playTime, slotTime)
          else {
            scheduleDrumStep(barIndex, step, slotTime)
            if (
              recordCycleRef.current &&
              recordClickRef.current &&
              sbPhaseRef.current === 'pattern' &&
              isBeatStep(step, bar.subdivision)
            ) {
              const beat = beatIndexForStep(step, bar.beats, bar.subdivision)
              kit.click(playTime, beat === 0 ? 2 : 0, clickRef.current, true)
            }
          }

          const nextStep = step + 1
          if (nextStep >= length) {
            const locked = loopBarRef.current
            const wrapped = locked != null ? barIndex : (barIndex + 1) % sequence.length
            const barEnd = clickMode
              ? slotTime - (pulse?.offsetSec ?? 0) + barDurationSec(bar.beats, tempo, bar.beatUnit)
              : slotTime + stepDurationSec(tempo, bar.subdivision, bar.beatUnit)
            stepRef.current = 0
            if (locked != null) {
              commitPendingCycle()
              barRef.current = wrapped
              armedBarRef.current = null
              onBarLoopRef.current?.()
            } else if (wrapped === 0) {
              commitPendingCycle()
              barRef.current = 0
              if (recordCycleRef.current) {
                onBarLoopRef.current?.()
                if (forcePrecountRef.current === true) {
                  beginPrecount()
                  nextTimeRef.current = barEnd
                  continue
                }
              } else if (advanceSpeedBuilder(barEnd)) {
                nextTimeRef.current = barEnd
                continue
              }
            } else {
              barRef.current = wrapped
            }
            const nextBar = playbackBar(barRef.current)
            const nextTempo = playbackBpmRef.current
            if (liveModeRef.current === 'click' && nextBar) {
              const nextPulses = clickPulsesInBar(nextBar, nextTempo)
              nextTimeRef.current = barEnd + (nextPulses[0]?.offsetSec ?? 0)
            } else {
              nextTimeRef.current = barEnd
            }
          } else if (clickMode && pulse && pulses[nextStep]) {
            stepRef.current = nextStep
            nextTimeRef.current = slotTime + (pulses[nextStep].offsetSec - pulse.offsetSec)
          } else {
            stepRef.current = nextStep
            nextTimeRef.current = slotTime + stepDurationSec(tempo, bar.subdivision, bar.beatUnit)
          }
        }
      }

      retargetRef.current = retarget

      const pumpVisuals = () => {
        if (!playingRef.current) return
        const audioTime = kit.ctx.currentTime
        const observed = clockWatchRef.current
        const due = (observed.frozen ? observed.virtualNow : audioTime) + VISUAL_LEAD
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
            precount: latest.precount,
          })
        }
        rafRef.current = window.requestAnimationFrame(pumpVisuals)
      }

      tick()
      timerRef.current = window.setInterval(tick, LOOKAHEAD_MS)
      rafRef.current = window.requestAnimationFrame(pumpVisuals)
    }

    start()

    return () => {
      cancelled = true
      retargetRef.current = () => undefined
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

  const getTransportClock = useCallback((): TransportClock => {
    const kit = kitRef.current
    const ctx = kit?.ctx
    const audioTime = ctx?.currentTime ?? 0
    const captureTime = ctx ? captureAudioTime(ctx) : 0
    const locked = loopBarRef.current
    const sequence = pendingBarsRef.current
    const len = Math.max(1, sequence.length)
    const index =
      locked != null
        ? ((locked % len) + len) % len
        : ((barRef.current % len) + len) % len
    const bar = sequence[index] ?? sequence[0]
    const bpmNow = playbackBpmRef.current
    return {
      audioTime,
      captureTime,
      barStart: barStartRef.current,
      barDur: bar ? barDurationSec(bar.beats, bpmNow, bar.beatUnit) : 0,
      barIndex: index,
      precount: sbPhaseRef.current === 'precount',
      playing: playingRef.current,
      outputLatency:
        ctx && typeof ctx.outputLatency === 'number' && ctx.outputLatency > 0
          ? ctx.outputLatency
          : ctx?.baseLatency ?? 0,
    }
  }, [])

  return {
    playheadStore,
    preview,
    previewClick,
    previewBar,
    previewClickBar,
    ensureKit,
    holdUntilCycle,
    liveBpm,
    halt: stopScheduler,
    getTransportClock,
  }
}
