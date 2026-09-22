export const VOICES = [
  'kick',
  'snare',
  'closedHat',
  'openHat',
  'highTom',
  'midTom',
  'floorTom',
  'ride',
  'crash',
] as const

export type VoiceId = (typeof VOICES)[number]

export const VOICE_LABELS: Record<VoiceId, string> = {
  kick: 'Kick',
  snare: 'Snare',
  closedHat: 'Closed hat',
  openHat: 'Open hat',
  highTom: 'High tom',
  midTom: 'Mid tom',
  floorTom: 'Floor tom',
  ride: 'Ride',
  crash: 'Crash',
}

export type RhythmMode = 'click' | 'drums'
export type BeatUnit = 2 | 4 | 8 | 16 | 32

export const BEAT_UNITS: BeatUnit[] = [2, 4, 8, 16, 32]
export const MIN_BEATS = 1
export const MAX_BEATS = 30
export const MIN_BARS = 1
export const MAX_BARS = 8
export const MIN_BPM = 30
export const MAX_BPM = 300
export const DEFAULT_BPM = 120

/** Steps per beat — Cubase-style density. Quarter = 1 through septuplets = 7. */
export const SUBDIVISIONS = [1, 2, 3, 4, 5, 6, 7] as const
export type SubdivisionId = (typeof SUBDIVISIONS)[number]
export const DEFAULT_SUBDIVISION: SubdivisionId = 2

export const SUBDIVISION_LABELS: Record<SubdivisionId, string> = {
  1: 'Quarter note',
  2: 'Eighth notes',
  3: 'Triplets',
  4: 'Sixteenth notes',
  5: 'Quintuplets',
  6: 'Sextuplets',
  7: 'Septuplets',
}

const LEGACY_SUBDIVISION: Record<string, SubdivisionId> = {
  quarters: 1,
  quarter: 1,
  eighths: 2,
  triplets: 3,
  sixteenths: 4,
  quintuplets: 5,
  sextuplets: 6,
  septuplets: 7,
}

export const CLICK_SOUNDS = ['woodblock', 'clave', 'digital', 'rim', 'tick'] as const

export type ClickSoundId = (typeof CLICK_SOUNDS)[number]
export const DEFAULT_CLICK_SOUND: ClickSoundId = 'woodblock'

export const CLICK_SOUND_LABELS: Record<ClickSoundId, string> = {
  woodblock: 'Woodblock',
  clave: 'Clave',
  digital: 'Digital',
  rim: 'Rim',
  tick: 'Soft tick',
}

/** A hit locked to an exact place in the bar: beat + num/den of that beat. */
export type HitPos = {
  beat: number
  num: number
  den: number
}

export type Pattern = Record<VoiceId, HitPos[]>

export type RhythmBar = {
  beats: number
  beatUnit: BeatUnit
  subdivision: SubdivisionId
  accents: number[]
  pattern: Pattern
}

export const UNIT_LABELS: Record<BeatUnit, string> = {
  2: 'Half',
  4: 'Quarter',
  8: 'Eighth',
  16: '16th',
  32: '32nd',
}

export function clampBeats(value: number): number {
  if (!Number.isFinite(value)) return 4
  return Math.round(Math.min(MAX_BEATS, Math.max(MIN_BEATS, value)))
}

export function clampBpm(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BPM
  return Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, value)))
}

export function isBeatUnit(value: unknown): value is BeatUnit {
  return value === 2 || value === 4 || value === 8 || value === 16 || value === 32
}

export function normalizeSubdivision(value: unknown): SubdivisionId {
  if (value === 8 || value === 'thirtyseconds' || value === 'thirty-seconds') {
    return 4
  }
  if (typeof value === 'number' && (SUBDIVISIONS as readonly number[]).includes(value)) {
    return value as SubdivisionId
  }
  if (typeof value === 'string' && value in LEGACY_SUBDIVISION) {
    return LEGACY_SUBDIVISION[value]
  }
  return DEFAULT_SUBDIVISION
}

export function isSubdivision(value: unknown): value is SubdivisionId {
  return typeof value === 'number' && (SUBDIVISIONS as readonly number[]).includes(value)
}

export function isClickSound(value: unknown): value is ClickSoundId {
  return typeof value === 'string' && (CLICK_SOUNDS as readonly string[]).includes(value)
}

export function stepsPerBeat(subdivision: SubdivisionId): number {
  return subdivision
}

export function stepsInBar(bar: Pick<RhythmBar, 'beats' | 'subdivision'>): number {
  return bar.beats * stepsPerBeat(bar.subdivision)
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const next = x % y
    x = y
    y = next
  }
  return x || 1
}

export function reduceHit(beat: number, num: number, den: number): HitPos {
  const safeDen = den === 0 ? 1 : den
  const g = gcd(num, safeDen)
  return { beat, num: num / g, den: safeDen / g }
}

export function sameHit(a: HitPos, b: HitPos): boolean {
  return a.beat === b.beat && a.num * b.den === b.num * a.den
}

export function hitSlot(hit: HitPos, steps: number): number | null {
  if (hit.den === 0) return null
  const num = hit.num * steps
  if (num % hit.den !== 0) return null
  const slot = num / hit.den
  if (slot < 0 || slot >= steps) return null
  return slot
}

export function emptyPattern(): Pattern {
  return Object.fromEntries(VOICES.map((voice) => [voice, []])) as unknown as Pattern
}

export function clonePattern(pattern: Pattern): Pattern {
  return Object.fromEntries(
    VOICES.map((voice) => [voice, (pattern[voice] ?? []).map((hit) => ({ ...hit }))]),
  ) as Pattern
}

export function filterPatternBeats(pattern: Pattern, beats: number): Pattern {
  const next = emptyPattern()
  for (const voice of VOICES) {
    next[voice] = (pattern[voice] ?? []).filter((hit) => hit.beat >= 0 && hit.beat < beats)
  }
  return next
}

export function patternToGrid(
  pattern: Pattern,
  beats: number,
  subdivision: SubdivisionId,
): Record<VoiceId, boolean[]> {
  const steps = stepsPerBeat(subdivision)
  const length = clampBeats(beats) * steps
  const grid = Object.fromEntries(
    VOICES.map((voice) => [voice, Array.from({ length }, () => false)]),
  ) as Record<VoiceId, boolean[]>
  for (const voice of VOICES) {
    for (const hit of pattern[voice] ?? []) {
      if (hit.beat < 0 || hit.beat >= beats) continue
      const slot = hitSlot(hit, steps)
      if (slot === null) continue
      grid[voice][hit.beat * steps + slot] = true
    }
  }
  return grid
}

export function toggleHit(
  pattern: Pattern,
  voice: VoiceId,
  step: number,
  beats: number,
  subdivision: SubdivisionId,
): Pattern {
  const steps = stepsPerBeat(subdivision)
  const beat = Math.floor(step / steps)
  const slot = step % steps
  if (beat < 0 || beat >= beats || slot < 0 || slot >= steps) return clonePattern(pattern)
  const target = reduceHit(beat, slot, steps)
  const next = clonePattern(pattern)
  const row = next[voice]
  const index = row.findIndex((hit) => sameHit(hit, target))
  if (index >= 0) row.splice(index, 1)
  else row.push(target)
  return next
}

export function patternsEqual(a: Pattern, b: Pattern): boolean {
  return VOICES.every((voice) => {
    const left = [...(a[voice] ?? [])].sort(compareHits)
    const right = [...(b[voice] ?? [])].sort(compareHits)
    return left.length === right.length && left.every((hit, index) => sameHit(hit, right[index]))
  })
}

function compareHits(a: HitPos, b: HitPos): number {
  if (a.beat !== b.beat) return a.beat - b.beat
  return a.num / a.den - b.num / b.den
}

export function defaultAccents(beats: number, beatUnit: BeatUnit): number[] {
  const count = clampBeats(beats)
  if (beatUnit === 8 && count % 3 === 0) {
    return Array.from({ length: count / 3 }, (_, index) => index * 3)
  }
  if (count === 5) return [0, 3]
  if (count === 7) return [0, 2, 4]
  if (count === 11) return [0, 3, 6, 8]
  if (count === 13) return [0, 3, 6, 8, 11]
  return [0]
}

export function clampAccents(accents: number[], beats: number): number[] {
  const next = accents
    .filter((beat) => Number.isInteger(beat) && beat >= 0 && beat < beats)
    .sort((a, b) => a - b)
  return next.length > 0 ? [...new Set(next)] : [0]
}

export function toggleAccent(accents: number[], beat: number, beats: number): number[] {
  if (beat < 0 || beat >= beats) return accents
  const has = accents.includes(beat)
  const next = has ? accents.filter((item) => item !== beat) : [...accents, beat]
  return clampAccents(next, beats)
}

export function patternFromHits(
  beats: number,
  subdivision: SubdivisionId,
  hits: Partial<Record<VoiceId, number[]>>,
): Pattern {
  const steps = stepsPerBeat(subdivision)
  const next = emptyPattern()
  const safeBeats = clampBeats(beats)
  for (const voice of VOICES) {
    for (const step of hits[voice] ?? []) {
      const beat = Math.floor(step / steps)
      const slot = step % steps
      if (beat >= 0 && beat < safeBeats && slot >= 0 && slot < steps) {
        next[voice].push(reduceHit(beat, slot, steps))
      }
    }
  }
  return next
}

export function makeBar(
  beats = 4,
  beatUnit: BeatUnit = 4,
  subdivision: SubdivisionId = DEFAULT_SUBDIVISION,
  pattern?: Pattern,
  accents?: number[],
): RhythmBar {
  const safeBeats = clampBeats(beats)
  const sub = normalizeSubdivision(subdivision)
  return {
    beats: safeBeats,
    beatUnit,
    subdivision: sub,
    accents: clampAccents(accents ?? defaultAccents(safeBeats, beatUnit), safeBeats),
    pattern: filterPatternBeats(pattern ?? emptyPattern(), safeBeats),
  }
}

export function cloneBar(bar: RhythmBar): RhythmBar {
  return {
    beats: bar.beats,
    beatUnit: bar.beatUnit,
    subdivision: bar.subdivision,
    accents: [...bar.accents],
    pattern: clonePattern(bar.pattern),
  }
}

export function updateBarMeter(
  bar: RhythmBar,
  beats: number,
  beatUnit: BeatUnit,
  subdivision = bar.subdivision,
): RhythmBar {
  const safeBeats = clampBeats(beats)
  const meterChanged = safeBeats !== bar.beats || beatUnit !== bar.beatUnit
  return {
    beats: safeBeats,
    beatUnit,
    subdivision: normalizeSubdivision(subdivision),
    accents: meterChanged
      ? defaultAccents(safeBeats, beatUnit)
      : clampAccents(bar.accents, safeBeats),
    pattern: filterPatternBeats(bar.pattern, safeBeats),
  }
}

export function setBarSubdivision(bar: RhythmBar, subdivision: SubdivisionId): RhythmBar {
  return {
    ...cloneBar(bar),
    subdivision: normalizeSubdivision(subdivision),
  }
}

export function meterLabel(beats: number, beatUnit: BeatUnit): string {
  return `${beats}/${beatUnit}`
}

export function pulseLabel(beatUnit: BeatUnit): string {
  return `${UNIT_LABELS[beatUnit]} notes`
}

export function stepDurationSec(bpm: number, subdivision: SubdivisionId): number {
  const tempo = Math.max(MIN_BPM, bpm)
  return 60 / tempo / stepsPerBeat(subdivision)
}

export function beatDurationSec(bpm: number): number {
  return 60 / Math.max(MIN_BPM, bpm)
}

export function hitTimeInBar(hit: HitPos, bpm: number): number {
  return (hit.beat + hit.num / hit.den) * beatDurationSec(bpm)
}

export function beatIndexForStep(step: number, beats: number, subdivision: SubdivisionId): number {
  const per = stepsPerBeat(subdivision)
  return Math.floor(step / per) % Math.max(1, beats)
}

export function isBeatStep(step: number, subdivision: SubdivisionId): boolean {
  return step % stepsPerBeat(subdivision) === 0
}

export function beatUnitNote(beatUnit: BeatUnit): string {
  return UNIT_LABELS[beatUnit].toLowerCase()
}
