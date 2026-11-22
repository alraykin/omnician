/**
 * Shared metronome lookahead. Listen preview pre-schedules every click in
 * one tap, so it still works if AudioContext.currentTime later freezes.
 * Play used a 0.12s window — at 120 BPM that is one beat — so a stuck or
 * stale clock played exactly one click and then went silent.
 *
 * When currentTime is moving, notes are queued against the audio clock.
 * When it is frozen, each due beat fires immediately (start(0)), paced by
 * the wall clock, so Play keeps going after Listen preview.
 */

export const LOOKAHEAD_MS = 25
/** Drums keep a longer queue. Click stays near one scheduler tick so a
 *  subdivision tap can cancel already-queued pulses before the next beat. */
export const SCHEDULE_AHEAD_SEC = 1.5
export const CLICK_SCHEDULE_AHEAD_SEC = 0.12
export const START_LEAD_SEC = 0.05
export const STALE_BEHIND_SEC = 0.08
export const STALE_AHEAD_SEC = 2.5
export const FREEZE_AFTER_SEC = 0.11
export const FROZEN_HORIZON_SEC = 0.14
export const FROZEN_PLAY_WHEN = 0

export type ClockWatch = {
  lastAudio: number
  lastWallMs: number
  frozen: boolean
  virtualNow: number
  ticks: number
}

export type ClockObservation = {
  audioTime: number
  virtualNow: number
  frozen: boolean
  wallMs: number
}

export function createClockWatch(audioTime: number, wallMs: number): ClockWatch {
  return {
    lastAudio: audioTime,
    lastWallMs: wallMs,
    frozen: false,
    virtualNow: audioTime,
    ticks: 0,
  }
}

export function watchClock(watch: ClockWatch, audioTime: number, wallMs: number): ClockObservation {
  watch.ticks += 1
  if (audioTime > watch.lastAudio + 0.002) {
    watch.lastAudio = audioTime
    watch.lastWallMs = wallMs
    watch.frozen = false
    watch.virtualNow = audioTime
    return { audioTime, virtualNow: audioTime, frozen: false, wallMs }
  }
  const elapsed = Math.max(0, (wallMs - watch.lastWallMs) / 1000)
  const virtualNow = watch.lastAudio + elapsed
  watch.virtualNow = virtualNow
  if (elapsed >= FREEZE_AFTER_SEC) watch.frozen = true
  return { audioTime, virtualNow, frozen: watch.frozen, wallMs }
}

export function rebaseNoteTime(
  nextTime: number,
  now: number,
  lead = START_LEAD_SEC,
  frozen = false,
): number {
  if (!Number.isFinite(nextTime)) return now + (frozen ? 0 : lead)
  if (nextTime < now - STALE_BEHIND_SEC) return now
  if (nextTime > now + STALE_AHEAD_SEC) return now + (frozen ? 0 : lead)
  // A live lookahead burst can leave nextTime ~1.5s ahead. If the clock
  // then freezes, those audio times never arrive — snap to wall time.
  if (frozen && nextTime > now + FROZEN_HORIZON_SEC) return now
  return nextTime
}

export function scheduleHorizon(
  audioTime: number,
  virtualNow: number,
  frozen: boolean,
  aheadSec = SCHEDULE_AHEAD_SEC,
): number {
  return frozen ? virtualNow + FROZEN_HORIZON_SEC : audioTime + aheadSec
}

export function noteStartTime(nextTime: number, frozen: boolean): number {
  return frozen ? FROZEN_PLAY_WHEN : nextTime
}

/** ScriptProcessor callbacks keep scheduling when setInterval throttles in the background. */
export function armAudioClockPump(ctx: AudioContext, onTick: () => void): () => void {
  try {
    const Ctor = (
      ctx as AudioContext & {
        createScriptProcessor?: (size: number, ins: number, outs: number) => ScriptProcessorNode
      }
    ).createScriptProcessor
    if (typeof Ctor !== 'function') return () => {}
    const node = Ctor.call(ctx, 2048, 1, 1)
    const silent = ctx.createGain()
    silent.gain.value = 0
    node.onaudioprocess = () => {
      try {
        onTick()
      } catch {
        /* keep the processor alive */
      }
    }
    node.connect(silent)
    silent.connect(ctx.destination)
    return () => {
      node.onaudioprocess = null
      try {
        node.disconnect()
        silent.disconnect()
      } catch {
        /* already gone */
      }
    }
  } catch {
    return () => {}
  }
}

export function pumpClickScheduler(args: {
  nextTime: number
  remaining: number
  audioTime: number
  wallMs: number
  beatSec: number
  watch: ClockWatch
  emit: (when: number) => void
}): { nextTime: number; remaining: number; scheduled: number; frozen: boolean; virtualNow: number } {
  const observed = watchClock(args.watch, args.audioTime, args.wallMs)
  const now = observed.frozen ? observed.virtualNow : args.audioTime
  let nextTime = rebaseNoteTime(args.nextTime, now, START_LEAD_SEC, observed.frozen)
  const horizon = scheduleHorizon(args.audioTime, observed.virtualNow, observed.frozen)
  let remaining = args.remaining
  let scheduled = 0
  while (remaining > 0 && nextTime < horizon) {
    args.emit(noteStartTime(nextTime, observed.frozen))
    scheduled += 1
    remaining -= 1
    nextTime += args.beatSec
  }
  return {
    nextTime,
    remaining,
    scheduled,
    frozen: observed.frozen,
    virtualNow: observed.virtualNow,
  }
}
