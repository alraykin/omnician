export const VOICES = [
  'kick',
  'snare',
  'closedHat',
  'openHat',
  'crash',
] as const

export type VoiceId = (typeof VOICES)[number]

export const VOICE_LABELS: Record<VoiceId, string> = {
  kick: 'Kick',
  snare: 'Snare',
  closedHat: 'Closed hat',
  openHat: 'Open hat',
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
export const DEFAULT_BPM = 100

export const SUBDIVISIONS = [
  'eighths',
  'triplets',
  'sixteenths',
  'quintuplets',
  'sextuplets',
  'septuplets',
  'thirtyseconds',
] as const

export type SubdivisionId = (typeof SUBDIVISIONS)[number]

export const SUBDIVISION_META: Record<
  SubdivisionId,
  { steps: number; label: string; short: string }
> = {
  eighths: { steps: 2, label: 'Eighths', short: '8ths' },
  triplets: { steps: 3, label: 'Triplets', short: 'Trips' },
  sixteenths: { steps: 4, label: '16ths', short: '16ths' },
  quintuplets: { steps: 5, label: 'Quintuplets', short: '5' },
  sextuplets: { steps: 6, label: 'Sextuplets', short: '6' },
  septuplets: { steps: 7, label: 'Septuplets', short: '7' },
  thirtyseconds: { steps: 8, label: '32nds', short: '32nds' },
}

export const CLICK_SOUNDS = [
  'woodblock',
  'clave',
  'digital',
  'rim',
  'cowbell',
  'tick',
] as const

export type ClickSoundId = (typeof CLICK_SOUNDS)[number]

export const CLICK_SOUND_LABELS: Record<ClickSoundId, string> = {
  woodblock: 'Woodblock',
  clave: 'Clave',
  digital: 'Digital',
  rim: 'Rim',
  cowbell: 'Cowbell',
  tick: 'Soft tick',
}

export type Pattern = Record<VoiceId, boolean[]>

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

export function isSubdivision(value: unknown): value is SubdivisionId {
  return typeof value === 'string' && (SUBDIVISIONS as readonly string[]).includes(value)
}

export function isClickSound(value: unknown): value is ClickSoundId {
  return typeof value === 'string' && (CLICK_SOUNDS as readonly string[]).includes(value)
}

export function stepsPerBeat(subdivision: SubdivisionId): number {
  return SUBDIVISION_META[subdivision].steps
}

export function stepsInBar(bar: Pick<RhythmBar, 'beats' | 'subdivision'>): number {
  return bar.beats * stepsPerBeat(bar.subdivision)
}

export function emptyPattern(beats: number, subdivision: SubdivisionId): Pattern {
  const length = clampBeats(beats) * stepsPerBeat(subdivision)
  return Object.fromEntries(
    VOICES.map((voice) => [voice, Array.from({ length }, () => false)]),
  ) as Pattern
}

export function clonePattern(pattern: Pattern): Pattern {
  return Object.fromEntries(
    VOICES.map((voice) => [voice, [...(pattern[voice] ?? [])]]),
  ) as Pattern
}

export function resizeHits(hits: boolean[], length: number): boolean[] {
  if (hits.length === length) return [...hits]
  if (hits.length > length) return hits.slice(0, length)
  return [...hits, ...Array.from({ length: length - hits.length }, () => false)]
}

export function reshapePattern(
  pattern: Pattern,
  fromBeats: number,
  fromSub: SubdivisionId,
  toBeats: number,
  toSub: SubdivisionId,
): Pattern {
  const fromSteps = stepsPerBeat(fromSub)
  const toSteps = stepsPerBeat(toSub)
  const sourceBeats = Math.max(1, fromBeats)
  const next = emptyPattern(toBeats, toSub)
  for (const voice of VOICES) {
    const row = pattern[voice] ?? []
    row.forEach((on, step) => {
      if (!on) return
      const beat = Math.floor(step / fromSteps)
      if (beat >= toBeats || beat >= sourceBeats) return
      const frac = fromSteps <= 1 ? 0 : (step % fromSteps) / fromSteps
      const sub = Math.min(toSteps - 1, Math.round(frac * toSteps))
      next[voice][beat * toSteps + sub] = true
    })
  }
  return next
}

export function toggleHit(pattern: Pattern, voice: VoiceId, step: number): Pattern {
  const next = clonePattern(pattern)
  const row = next[voice]
  if (step < 0 || step >= row.length) return next
  next[voice] = row.map((on, index) => (index === step ? !on : on))
  return next
}

export function patternsEqual(a: Pattern, b: Pattern): boolean {
  return VOICES.every(
    (voice) =>
      a[voice]?.length === b[voice]?.length &&
      a[voice].every((on, index) => on === b[voice][index]),
  )
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

export function hitsFromSteps(length: number, steps: number[]): boolean[] {
  const row = Array.from({ length }, () => false)
  for (const step of steps) {
    if (step >= 0 && step < length) row[step] = true
  }
  return row
}

export function patternFromHits(
  beats: number,
  subdivision: SubdivisionId,
  hits: Partial<Record<VoiceId, number[]>>,
): Pattern {
  const length = clampBeats(beats) * stepsPerBeat(subdivision)
  const empty = emptyPattern(beats, subdivision)
  return {
    kick: hits.kick ? hitsFromSteps(length, hits.kick) : empty.kick,
    snare: hits.snare ? hitsFromSteps(length, hits.snare) : empty.snare,
    closedHat: hits.closedHat ? hitsFromSteps(length, hits.closedHat) : empty.closedHat,
    openHat: hits.openHat ? hitsFromSteps(length, hits.openHat) : empty.openHat,
    crash: hits.crash ? hitsFromSteps(length, hits.crash) : empty.crash,
  }
}

export function makeBar(
  beats = 4,
  beatUnit: BeatUnit = 4,
  subdivision: SubdivisionId = 'sixteenths',
  pattern?: Pattern,
  accents?: number[],
): RhythmBar {
  const safeBeats = clampBeats(beats)
  return {
    beats: safeBeats,
    beatUnit,
    subdivision,
    accents: clampAccents(accents ?? defaultAccents(safeBeats, beatUnit), safeBeats),
    pattern: pattern
      ? reshapePattern(pattern, safeBeats, subdivision, safeBeats, subdivision)
      : emptyPattern(safeBeats, subdivision),
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
    subdivision,
    accents: meterChanged
      ? defaultAccents(safeBeats, beatUnit)
      : clampAccents(bar.accents, safeBeats),
    pattern: reshapePattern(bar.pattern, bar.beats, bar.subdivision, safeBeats, subdivision),
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
