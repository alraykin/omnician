import {
  clonePattern,
  emptyPattern,
  hitFraction,
  hitSlot,
  hitTimeInBar,
  isHitSoft,
  makeBar,
  reduceHit,
  sameHit,
  type HitPos,
  type Pattern,
  type RhythmBar,
  type VoiceId,
} from '@/lib/rhythm'

/** 48 ticks per beat: exact 8ths, 16ths, 8th-triplets, 16th-triplets, and 12-slot mixes. */
export const TICKS_PER_BEAT = 48

export const INPUT_DIVISIONS = [2, 3, 4, 6] as const
export type InputDivision = (typeof INPUT_DIVISIONS)[number]

export const INPUT_CHIPS: ReadonlyArray<{ id: InputDivision; label: string }> = [
  { id: 2, label: '1/8' },
  { id: 3, label: '1/8T' },
  { id: 4, label: '1/16' },
  { id: 6, label: '1/16T' },
]

export const DEFAULT_DRUM_INPUT: InputDivision = 4

/** Coarsest display grids, then the 16th+triplet mix (12). */
export const DISPLAY_DIVISIONS = [1, 2, 3, 4, 6, 12] as const
export type DisplayDivision = (typeof DISPLAY_DIVISIONS)[number]

export function isInputDivision(value: unknown): value is InputDivision {
  return value === 2 || value === 3 || value === 4 || value === 6
}

export function normalizeDrumInput(value: unknown): InputDivision {
  return isInputDivision(value) ? value : DEFAULT_DRUM_INPUT
}

export function hitsInBeat(hits: readonly HitPos[], beat: number): HitPos[] {
  return hits.filter((hit) => hit.beat === beat)
}

/** True when every hit lands exactly on this many equal slots. */
export function fitsDivision(hits: readonly HitPos[], division: number): boolean {
  if (division < 1) return false
  return hits.every((hit) => hitSlot(hit, division) !== null)
}

/**
 * Coarsest exact slot count for this beat (snap / MIDI, not grid display).
 * Empty → 0. Mixed 16ths + triplets → 12. Anything else (5, 7, off-grid) → -1.
 */
export function coarsestDivision(hits: readonly HitPos[]): number {
  if (hits.length === 0) return 0
  for (const division of DISPLAY_DIVISIONS) {
    if (fitsDivision(hits, division)) return division
  }
  return -1
}

export function isTripletDivision(division: number): boolean {
  return division === 3 || division === 6
}

export function inputSlotFromX(x: number, width: number, input: InputDivision): number {
  if (!(width > 0)) return 0
  const slot = Math.floor((x / width) * input)
  return Math.min(input - 1, Math.max(0, slot))
}

/** Beats 1–6 stay on the first Kick→China block; 7+ start another full kit underneath. */
export const KIT_BLOCK_BEATS = 6

export type KitBeatBlock = {
  index: number
  start: number
  count: number
}

export function kitBeatBlocks(beats: number): KitBeatBlock[] {
  const n = Math.max(1, Math.floor(beats) || 1)
  const blocks: KitBeatBlock[] = []
  for (let start = 0, index = 0; start < n; start += KIT_BLOCK_BEATS, index += 1) {
    blocks.push({ index, start, count: Math.min(KIT_BLOCK_BEATS, n - start) })
  }
  return blocks
}

/** Column count so a leftover 7th beat keeps the same width as beats 1–6. */
export function kitBlockColumns(beats: number): number {
  const n = Math.max(1, Math.floor(beats) || 1)
  return Math.min(n, KIT_BLOCK_BEATS)
}

export function hitForInputSlot(beat: number, slot: number, input: InputDivision): HitPos {
  return reduceHit(beat, slot, input)
}

export function beatHasHit(hits: readonly HitPos[], target: HitPos): boolean {
  return hits.some((hit) => sameHit(hit, target))
}

export type BeatBoxSlot = {
  slot: number
  filled: boolean
  soft: boolean
  start: number
  end: number
}

export type BeatBoxView = {
  beat: number
  division: number
  empty: boolean
  triplet: boolean
  dots: boolean
  slots: BeatBoxSlot[]
  dotsAt: number[]
  dotsSoft: boolean[]
}

export function beatBoxView(
  hits: readonly HitPos[],
  beat: number,
  input: InputDivision,
): BeatBoxView {
  const inBeat = hitsInBeat(hits, beat)
  const filled = new Set(
    inBeat.map((hit) => hitSlot(hit, input)).filter((slot): slot is number => slot !== null),
  )
  const soft = new Set(
    inBeat
      .filter(isHitSoft)
      .map((hit) => hitSlot(hit, input))
      .filter((slot): slot is number => slot !== null),
  )
  const offGrid = inBeat.filter((hit) => hitSlot(hit, input) === null)
  const dotsAt = offGrid
    .map((hit) => hit.num / hit.den)
    .filter((frac) => frac >= 0 && frac < 1)
  const dotsSoft = offGrid
    .filter((hit) => hit.num / hit.den >= 0 && hit.num / hit.den < 1)
    .map(isHitSoft)
  return {
    beat,
    division: input,
    empty: inBeat.length === 0,
    triplet: isTripletDivision(input),
    dots: dotsAt.length > 0,
    slots: Array.from({ length: input }, (_, slot) => ({
      slot,
      filled: filled.has(slot),
      soft: soft.has(slot),
      start: slot / input,
      end: (slot + 1) / input,
    })),
    dotsAt,
    dotsSoft,
  }
}

export function snapBeatFraction(frac: number): { beatDelta: number; hit: HitPos } {
  if (!Number.isFinite(frac)) return { beatDelta: 0, hit: reduceHit(0, 0, 1) }
  let extraBeats = Math.floor(frac)
  let phase = frac - extraBeats
  if (phase < 0) {
    extraBeats -= 1
    phase += 1
  }

  let bestNum = 0
  let bestDen = 1
  let bestErr = Number.POSITIVE_INFINITY
  let bestWrap = 0
  for (const den of DISPLAY_DIVISIONS) {
    const raw = phase * den
    let num = Math.round(raw)
    let wrap = 0
    if (num >= den) {
      num = 0
      wrap = 1
    }
    if (num < 0) num = 0
    const placed = wrap === 1 ? 1 : num / den
    const err = Math.abs(phase - placed)
    if (err < bestErr - 1e-9 || (Math.abs(err - bestErr) < 1e-9 && den < bestDen)) {
      bestErr = err
      bestNum = num
      bestDen = den
      bestWrap = wrap
    }
  }
  return { beatDelta: extraBeats + bestWrap, hit: reduceHit(0, bestNum, bestDen) }
}

export function hitFromBarOffset(
  offsetSec: number,
  barDur: number,
  beats: number,
): HitPos {
  if (!(barDur > 0) || beats < 1) return reduceHit(0, 0, 1)
  let phase = offsetSec / barDur
  phase -= Math.floor(phase)
  if (phase < 0) phase += 1
  const totalBeats = phase * beats
  let beat = Math.floor(totalBeats + 1e-12)
  const frac = totalBeats - beat
  const snapped = snapBeatFraction(frac)
  beat += snapped.beatDelta
  if (beat >= beats) beat = 0
  if (beat < 0) beat = 0
  return reduceHit(beat, snapped.hit.num, snapped.hit.den)
}

export function mergeVoiceHit(pattern: Pattern, voice: VoiceId, hit: HitPos): Pattern {
  const next = clonePattern(pattern)
  const index = next[voice].findIndex((item) => sameHit(item, hit))
  if (index < 0) {
    next[voice].push(hit)
    return next
  }
  if (isHitSoft(hit) && !isHitSoft(next[voice][index]!)) {
    next[voice][index] = { ...next[voice][index]!, soft: true }
  }
  return next
}

/** Concept C mockup bar — used for screenshots and timing checks. */
export function makeBeatBoxesExampleBar(): RhythmBar {
  const pattern = emptyPattern()
  const add = (voice: VoiceId, beat: number, num: number, den: number) => {
    pattern[voice].push(reduceHit(beat, num, den))
  }

  add('kick', 0, 0, 1)
  add('kick', 1, 1, 2)
  add('kick', 2, 3, 4)

  add('snare', 1, 0, 1)
  add('snare', 2, 2, 3)
  add('snare', 3, 0, 1)

  for (const beat of [0, 1, 2]) {
    add('closedHat', beat, 0, 2)
    add('closedHat', beat, 1, 2)
  }
  for (let slot = 0; slot < 4; slot += 1) add('closedHat', 3, slot, 4)

  add('highTom', 3, 0, 3)
  add('midTom', 3, 1, 3)
  add('floorTom', 3, 2, 3)

  return makeBar(4, 4, 4, pattern)
}

export function exampleBarHitSeconds(bpm = 120): { voice: VoiceId; sec: number }[] {
  const bar = makeBeatBoxesExampleBar()
  const times: { voice: VoiceId; sec: number }[] = []
  for (const voice of Object.keys(bar.pattern) as VoiceId[]) {
    for (const hit of bar.pattern[voice]) {
      times.push({ voice, sec: hitTimeInBar(hit, bpm, bar.beatUnit) })
    }
  }
  return times.sort((a, b) => a.sec - b.sec || a.voice.localeCompare(b.voice))
}

export function playheadBeat(step: number, beats: number, subdivisionSteps: number): number {
  if (step < 0 || beats < 1 || subdivisionSteps < 1) return -1
  return Math.floor(step / subdivisionSteps) % beats
}

export { hitFraction }
