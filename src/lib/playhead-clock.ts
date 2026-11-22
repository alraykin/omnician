/**
 * Visual playhead from the same audio-clock schedule as the hits.
 * Count-in is not bar 1: park until grooveStart, then step from scheduled
 * note times vs currentTime + outputLatency.
 */

export type ScheduledStep = {
  time: number
  bar: number
  step: number
  beat: number
  accent: 0 | 1 | 2
  subdivision: boolean
  precount: boolean
}

export type VisualPlayhead = {
  bar: number
  step: number
  beat: number
  accent: 0 | 1 | 2
  subdivision: boolean
  precount: boolean
}

export const PARKED_STEP = -1

/** No count-in: visuals may follow the groove immediately. */
export const NO_COUNT_IN = Number.NEGATIVE_INFINITY

export function audibleNow(audioTime: number, outputLatency = 0): number {
  const lat = Number.isFinite(outputLatency) && outputLatency > 0 ? outputLatency : 0
  return audioTime + lat
}

export function isCountInSounding(audible: number, countUntil: number): boolean {
  return Number.isFinite(countUntil) && audible < countUntil - 1e-9
}

export function contextOutputLatency(ctx: {
  outputLatency?: number
  baseLatency?: number
} | null | undefined): number {
  if (!ctx) return 0
  if (typeof ctx.outputLatency === 'number' && ctx.outputLatency > 0) return ctx.outputLatency
  if (typeof ctx.baseLatency === 'number' && ctx.baseLatency > 0) return ctx.baseLatency
  return 0
}

function parked(bar: number, countBeat: number): VisualPlayhead {
  return {
    bar,
    step: PARKED_STEP,
    beat: countBeat,
    accent: 0,
    subdivision: false,
    precount: true,
  }
}

/**
 * Latest scheduled pattern step that has already sounded.
 * During count-in the cursor stays at the start of bar 1 (step -1);
 * count-in beats are only for the optional "count N" indicator.
 */
export function visualPlayheadFromSchedule(opts: {
  cues: readonly ScheduledStep[]
  audioTime: number
  outputLatency?: number
  countUntil: number
  startBar?: number
}): VisualPlayhead {
  const now = audibleNow(opts.audioTime, opts.outputLatency)
  const startBar = opts.startBar ?? 0
  if (isCountInSounding(now, opts.countUntil)) {
    let countBeat = PARKED_STEP
    for (const cue of opts.cues) {
      if (!cue.precount) continue
      if (cue.time > now) break
      countBeat = cue.beat
    }
    return parked(startBar, countBeat)
  }
  let latest: ScheduledStep | null = null
  for (const cue of opts.cues) {
    if (cue.precount) continue
    if (cue.time > now) break
    latest = cue
  }
  if (!latest) {
    return {
      bar: startBar,
      step: PARKED_STEP,
      beat: PARKED_STEP,
      accent: 0,
      subdivision: false,
      precount: false,
    }
  }
  return {
    bar: latest.bar,
    step: latest.step,
    beat: latest.beat,
    accent: latest.accent,
    subdivision: latest.subdivision,
    precount: false,
  }
}

/** Audible step index — must match visualPlayheadFromSchedule across count-in and wrap. */
export function audibleStepIndex(opts: {
  cues: readonly ScheduledStep[]
  audioTime: number
  outputLatency?: number
  countUntil: number
  startBar?: number
}): { bar: number; step: number; precount: boolean } {
  const visual = visualPlayheadFromSchedule(opts)
  return { bar: visual.bar, step: visual.step, precount: visual.precount }
}

export function pruneHeardCues(cues: ScheduledStep[], audible: number, keepBehindSec = 8): ScheduledStep[] {
  const cut = audible - keepBehindSec
  if (!(cut > 0) || cues.length === 0) return cues
  let i = 0
  while (i < cues.length && cues[i]!.time < cut) i += 1
  return i === 0 ? cues : cues.slice(i)
}
