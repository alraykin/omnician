import {
  cloneBar,
  clonePattern,
  emptyPattern,
  reduceHit,
  setBarSubdivision,
  setHit,
  stepsInBar,
  stepsPerBeat,
  type HitPos,
  type Pattern,
  type RhythmBar,
  type SubdivisionId,
  type VoiceId,
} from '@/lib/rhythm'

export const RECORD_TIP_KEY = 'omnician.drums.record-tip.v1'
export const RECORD_CLICK_KEY = 'omnician.drums.record-click.v1'

export type QuantizeId = 'smart' | '8' | '16' | '8t' | '16t' | 'off'

export const QUANTIZE_CHIPS: ReadonlyArray<{ id: QuantizeId; label: string }> = [
  { id: 'smart', label: 'Smart' },
  { id: '8', label: '1/8' },
  { id: '16', label: '1/16' },
  { id: '8t', label: '1/8T' },
  { id: '16t', label: '1/16T' },
  { id: 'off', label: 'Off' },
]

export type RecordMode = 'overdub' | 'replace'

export type PadKeyCap = string | readonly string[]

export type DrumPadSpec = {
  voice: VoiceId
  label: string
  wide?: boolean
  key: PadKeyCap
}

/** 4×4 pad grid from the approved mockup. Kick and Snare are double-width. */
export const DRUM_PADS: readonly DrumPadSpec[] = [
  { voice: 'crash', label: 'Crash', key: 'E' },
  { voice: 'splash', label: 'Splash', key: 'W' },
  { voice: 'china', label: 'China', key: 'Q' },
  { voice: 'stack', label: 'Catch', key: 'A' },
  { voice: 'highTom', label: 'Tom 1', key: 'K' },
  { voice: 'midTom', label: 'Tom 2', key: 'L' },
  { voice: 'floorTom', label: 'Fl Tom', key: ';' },
  { voice: 'rideBell', label: 'Ride Bell', key: 'U' },
  { voice: 'openHat', label: 'HH Open', key: 'S' },
  { voice: 'closedHat', label: 'HH Closed', key: 'D' },
  { voice: 'rim', label: 'Rimshot', key: 'G' },
  { voice: 'ride', label: 'Ride', key: 'H' },
  { voice: 'kick', label: 'Kick', wide: true, key: 'Space' },
  { voice: 'snare', label: 'Snare', wide: true, key: ['F', 'J'] },
]

const KEY_TO_VOICE: Record<string, VoiceId> = {
  Space: 'kick',
  ' ': 'kick',
  KeyF: 'snare',
  KeyJ: 'snare',
  f: 'snare',
  j: 'snare',
  KeyD: 'closedHat',
  d: 'closedHat',
  KeyS: 'openHat',
  s: 'openHat',
  KeyG: 'rim',
  g: 'rim',
  KeyH: 'ride',
  h: 'ride',
  KeyU: 'rideBell',
  u: 'rideBell',
  KeyK: 'highTom',
  k: 'highTom',
  KeyL: 'midTom',
  l: 'midTom',
  Semicolon: 'floorTom',
  ';': 'floorTom',
  KeyE: 'crash',
  e: 'crash',
  KeyW: 'splash',
  w: 'splash',
  KeyQ: 'china',
  q: 'china',
  KeyA: 'stack',
  a: 'stack',
}

export function voiceForRecorderKey(event: KeyboardEvent): VoiceId | null {
  if (event.repeat) return null
  if (event.metaKey || event.ctrlKey || event.altKey) return null
  const fromCode = KEY_TO_VOICE[event.code]
  if (fromCode) return fromCode
  return KEY_TO_VOICE[event.key] ?? null
}

export function loadRecordTipDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(RECORD_TIP_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissRecordTip(): void {
  try {
    localStorage.setItem(RECORD_TIP_KEY, '1')
  } catch {
    // Private mode.
  }
}

/** Recorder guide click: default on. Stored on this device only. */
export function loadRecordClick(): boolean {
  if (typeof localStorage === 'undefined') return true
  try {
    const raw = localStorage.getItem(RECORD_CLICK_KEY)
    if (raw == null) return true
    return raw !== '0'
  } catch {
    return true
  }
}

export function saveRecordClick(on: boolean): void {
  try {
    localStorage.setItem(RECORD_CLICK_KEY, on ? '1' : '0')
  } catch {
    // Private mode.
  }
}

/** Finest even grid the drums page can show without tuplets: 4 steps per beat. */
export function finestEvenSubdivision(current: SubdivisionId): SubdivisionId {
  if (current === 5 || current === 6 || current === 7) return current
  return 4
}

export function tripletSubdivision(current: SubdivisionId): SubdivisionId {
  if (current === 4 || current === 6 || current === 7) return 6
  return 3
}

export function subdivisionForQuantize(mode: QuantizeId, bar: Pick<RhythmBar, 'subdivision'>): SubdivisionId {
  if (mode === '8') return 2
  if (mode === '16') return 4
  if (mode === '8t') return 3
  if (mode === '16t') return 6
  if (mode === 'off') return finestEvenSubdivision(bar.subdivision)
  return bar.subdivision
}

/**
 * Snap a time in the bar to a step.
 * Round (half-or-more late goes to the next step). Times at/after the loop
 * wrap to step 0 (beat 1, first slot).
 */
export function quantizeToStep(offsetSec: number, barDur: number, steps: number): number {
  if (!(barDur > 0) || steps < 1) return 0
  let phase = offsetSec / barDur
  phase -= Math.floor(phase)
  if (phase < 0) phase += 1
  let step = Math.round(phase * steps)
  if (step < 0) step = 0
  if (step >= steps) return 0
  return step
}

export function stepError(offsetSec: number, barDur: number, steps: number): number {
  if (!(barDur > 0) || steps < 1) return 0
  let phase = offsetSec / barDur
  phase -= Math.floor(phase)
  if (phase < 0) phase += 1
  const raw = phase * steps
  const nearest = Math.round(raw)
  const wrapped = nearest >= steps ? 0 : nearest
  const err = wrapped === 0 && raw > steps - 0.5 ? steps - raw : Math.abs(raw - nearest)
  return err * (barDur / steps)
}

export function totalQuantizeError(
  offsets: readonly number[],
  barDur: number,
  steps: number,
): number {
  return offsets.reduce((sum, offset) => sum + stepError(offset, barDur, steps), 0)
}

/** Triplets win only when they are clearly closer, not a coin-flip. */
export function tripletsClearlyBetter(
  offsets: readonly number[],
  barDur: number,
  currentSteps: number,
  tripletSteps: number,
): boolean {
  if (offsets.length === 0) return false
  if (currentSteps === tripletSteps) return false
  const currentErr = totalQuantizeError(offsets, barDur, currentSteps)
  const tripletErr = totalQuantizeError(offsets, barDur, tripletSteps)
  const perHitGap = (currentErr - tripletErr) / offsets.length
  return tripletErr < currentErr * 0.78 && perHitGap > 0.008
}

export type SmartQuantizeResult = {
  subdivision: SubdivisionId
  steps: number
  offerTriplets: boolean
  tripletSubdivision: SubdivisionId
}

export function isTupletSubdivision(sub: SubdivisionId): boolean {
  return sub === 3 || sub === 5 || sub === 6 || sub === 7
}

/** Change the bar grid only when the snap grid cannot be shown on the current one. */
export function shouldUpgradeSubdivision(current: SubdivisionId, target: SubdivisionId): boolean {
  if (target === current) return false
  if (isTupletSubdivision(current) !== isTupletSubdivision(target)) return true
  return target > current
}

/** Map a step from one subdivision onto another, wrapping the last slot to beat 1. */
export function stepInSubdivision(
  step: number,
  fromSub: SubdivisionId,
  toSub: SubdivisionId,
  beats: number,
): number {
  if (fromSub === toSub) {
    const per = stepsPerBeat(toSub)
    const total = beats * per
    if (total < 1) return 0
    if (step < 0) return 0
    if (step >= total) return 0
    return step
  }
  const fromPer = stepsPerBeat(fromSub)
  const toPer = stepsPerBeat(toSub)
  const beat = Math.min(beats - 1, Math.max(0, Math.floor(step / fromPer)))
  const slot = step - beat * fromPer
  const mapped = Math.round((slot * toPer) / fromPer)
  if (mapped >= toPer) {
    const nextBeat = beat + 1
    if (nextBeat >= beats) return 0
    return nextBeat * toPer
  }
  return beat * toPer + Math.max(0, mapped)
}

export function smartQuantizePlan(
  offsets: readonly number[],
  bar: Pick<RhythmBar, 'beats' | 'subdivision'>,
  barDur: number,
): SmartQuantizeResult {
  const currentSub = bar.subdivision
  const currentSteps = stepsInBar(bar)
  const tripSub = tripletSubdivision(currentSub)
  const tripSteps = bar.beats * stepsPerBeat(tripSub)
  const offer = tripletsClearlyBetter(offsets, barDur, currentSteps, tripSteps)
  return {
    subdivision: currentSub,
    steps: currentSteps,
    offerTriplets: offer && tripSub !== currentSub,
    tripletSubdivision: tripSub,
  }
}

export function placeQuantizedHit(
  bar: RhythmBar,
  offsetSec: number,
  barDur: number,
  quantize: QuantizeId,
  voice: VoiceId,
  recordMode: RecordMode,
  voicesTouched: ReadonlySet<VoiceId>,
  passOffsets: readonly number[],
): {
  bar: RhythmBar
  hit: PassHit
  voicesTouched: Set<VoiceId>
  offerTriplets: boolean
  tripletSubdivision: SubdivisionId
} {
  const smart = quantize === 'smart' ? smartQuantizePlan(passOffsets, bar, barDur) : undefined
  const snapped = quantizeHit(offsetSec, bar, barDur, quantize, smart)
  let nextBar = bar
  let step = snapped.step
  if (snapped.subdivision !== bar.subdivision) {
    if (shouldUpgradeSubdivision(bar.subdivision, snapped.subdivision)) {
      nextBar = setBarSubdivision(bar, snapped.subdivision)
    } else {
      step = stepInSubdivision(snapped.step, snapped.subdivision, bar.subdivision, bar.beats)
    }
  }
  const hit: PassHit = {
    voice,
    offsetSec,
    step,
    subdivision: nextBar.subdivision,
  }
  const applied = applyPassHit(nextBar.pattern, nextBar, hit, recordMode, voicesTouched)
  return {
    bar: { ...nextBar, pattern: applied.pattern },
    hit,
    voicesTouched: applied.voicesTouched,
    offerTriplets: Boolean(smart?.offerTriplets),
    tripletSubdivision: smart?.tripletSubdivision ?? tripletSubdivision(bar.subdivision),
  }
}

export function requantizePassTo(
  start: RhythmBar,
  hits: readonly Pick<PassHit, 'voice' | 'offsetSec'>[],
  barDur: number,
  subdivision: SubdivisionId,
  recordMode: RecordMode,
): { bar: RhythmBar; hits: PassHit[] } {
  let bar = setBarSubdivision(cloneBar(start), subdivision)
  let touched = new Set<VoiceId>()
  const placed: PassHit[] = []
  for (const raw of hits) {
    const step = quantizeToStep(raw.offsetSec, barDur, stepsInBar(bar))
    const hit: PassHit = {
      voice: raw.voice,
      offsetSec: raw.offsetSec,
      step,
      subdivision,
    }
    const applied = applyPassHit(bar.pattern, bar, hit, recordMode, touched)
    touched = applied.voicesTouched
    bar = { ...bar, pattern: applied.pattern }
    placed.push(hit)
  }
  return { bar, hits: placed }
}

export function quantizeHit(
  offsetSec: number,
  bar: Pick<RhythmBar, 'beats' | 'subdivision'>,
  barDur: number,
  mode: QuantizeId,
  smartPlan?: SmartQuantizeResult,
): { step: number; subdivision: SubdivisionId } {
  const subdivision =
    mode === 'smart'
      ? (smartPlan?.subdivision ?? bar.subdivision)
      : subdivisionForQuantize(mode, bar)
  const steps = bar.beats * stepsPerBeat(subdivision)
  return { step: quantizeToStep(offsetSec, barDur, steps), subdivision }
}

export function captureAudioTime(ctx: Pick<BaseAudioContext, 'currentTime'> & {
  outputLatency?: number
  baseLatency?: number
}): number {
  const latency =
    typeof ctx.outputLatency === 'number' && ctx.outputLatency > 0
      ? ctx.outputLatency
      : typeof ctx.baseLatency === 'number'
        ? ctx.baseLatency
        : 0
  return ctx.currentTime - latency
}

export function offsetInBar(captureTime: number, barStart: number, barDur: number): number {
  if (!(barDur > 0)) return 0
  let offset = captureTime - barStart
  offset -= Math.floor(offset / barDur) * barDur
  if (offset < 0) offset += barDur
  return offset
}

export type PassHit = {
  voice: VoiceId
  offsetSec: number
  step: number
  subdivision: SubdivisionId
  barIndex?: number
}

export function mergeHit(
  pattern: Pattern,
  voice: VoiceId,
  step: number,
  beats: number,
  subdivision: SubdivisionId,
): Pattern {
  return setHit(pattern, voice, step, beats, subdivision, true)
}

export function clearVoiceRow(pattern: Pattern, voice: VoiceId): Pattern {
  if ((pattern[voice] ?? []).length === 0) return pattern
  const next = clonePattern(pattern)
  next[voice] = []
  return next
}

export function applyPassHit(
  pattern: Pattern,
  bar: RhythmBar,
  hit: PassHit,
  mode: RecordMode,
  voicesTouched: ReadonlySet<VoiceId>,
): { pattern: Pattern; voicesTouched: Set<VoiceId> } {
  const touched = new Set(voicesTouched)
  let next = pattern
  if (mode === 'replace' && !touched.has(hit.voice)) {
    next = clearVoiceRow(next, hit.voice)
  }
  touched.add(hit.voice)
  next = mergeHit(next, hit.voice, hit.step, bar.beats, hit.subdivision)
  return { pattern: next, voicesTouched: touched }
}

export function usedVoices(pattern: Pattern, extra?: ReadonlySet<VoiceId>): VoiceId[] {
  const out: VoiceId[] = []
  const seen = new Set<VoiceId>()
  const consider = (voice: VoiceId) => {
    if (seen.has(voice)) return
    if ((pattern[voice] ?? []).length > 0 || extra?.has(voice)) {
      seen.add(voice)
      out.push(voice)
    }
  }
  // Mini-grid order follows the kit list (kick first) so the loop reads like the main grid.
  for (const voice of [
    'kick',
    'snare',
    'rim',
    'closedHat',
    'openHat',
    'highTom',
    'midTom',
    'floorTom',
    'ride',
    'rideBell',
    'crash',
    'stack',
    'splash',
    'china',
  ] as const) {
    consider(voice)
  }
  return out
}

export function hitsToStepSet(
  hits: readonly HitPos[],
  beats: number,
  subdivision: SubdivisionId,
): Set<number> {
  const per = stepsPerBeat(subdivision)
  const set = new Set<number>()
  for (const hit of hits) {
    if (hit.beat < 0 || hit.beat >= beats || hit.den === 0) continue
    const num = hit.num * per
    if (num % hit.den !== 0) continue
    const slot = num / hit.den
    if (slot < 0 || slot >= per) continue
    set.add(hit.beat * per + slot)
  }
  return set
}

export function emptyPassPattern(): Pattern {
  return emptyPattern()
}

export function hitPosAtStep(step: number, beats: number, subdivision: SubdivisionId): HitPos {
  const per = stepsPerBeat(subdivision)
  const beat = Math.floor(step / per)
  const slot = step % per
  return reduceHit(Math.max(0, Math.min(beats - 1, beat)), slot, per)
}
