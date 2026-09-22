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

export const CLICK_SOUNDS = ['woodSoft', 'clave', 'digitalSoft', 'mechanicalSoft'] as const

export type ClickSoundId = (typeof CLICK_SOUNDS)[number]
export const DEFAULT_CLICK_SOUND: ClickSoundId = 'woodSoft'

export const CLICK_SOUND_LABELS: Record<ClickSoundId, string> = {
  woodSoft: 'Wood Soft',
  clave: 'Clave',
  digitalSoft: 'Digital Soft',
  mechanicalSoft: 'Mechanical Soft',
}

/** Old picker ids (and anything unknown) land on Wood Soft. */
const LEGACY_CLICK_SOUND: Record<string, ClickSoundId> = {
  woodblock: 'woodSoft',
  wood: 'woodSoft',
  digital: 'digitalSoft',
  rim: 'woodSoft',
  tick: 'woodSoft',
  mechanical: 'mechanicalSoft',
}

/** A hit locked to an exact place in the bar: beat + num/den of that beat. */
export type HitPos = {
  beat: number
  num: number
  den: number
}

export type Pattern = Record<VoiceId, HitPos[]>

/** Click velocity: 0 unaccented, 1 soft, 2 strong. Drums ignore this. */
export type AccentLevel = 0 | 1 | 2

export const ACCENT_LEVEL_LABELS: Record<AccentLevel, string> = {
  0: 'Off',
  1: 'Soft',
  2: 'Strong',
}

/** Outer layer: accent on a main beat of the bar. */
export type BeatAccent = { beat: number; level: 1 | 2 }

/** Inner layer: one nested pattern that repeats inside every beat. */
export type SubdivAccent = { num: number; den: number; level: 1 | 2 }

export type RhythmBar = {
  beats: number
  beatUnit: BeatUnit
  subdivision: SubdivisionId
  beatAccents: BeatAccent[]
  subdivAccents: SubdivAccent[]
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

export function normalizeClickSound(value: unknown): ClickSoundId {
  if (isClickSound(value)) return value
  if (typeof value === 'string' && value in LEGACY_CLICK_SOUND) return LEGACY_CLICK_SOUND[value]
  return DEFAULT_CLICK_SOUND
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

function nextAccentLevel(current: AccentLevel): AccentLevel {
  if (current === 0) return 1
  if (current === 1) return 2
  return 0
}

/** Strong wins, else soft, else off — nested layers, not independent grids. */
export function nestAccent(outer: AccentLevel, inner: AccentLevel): AccentLevel {
  return Math.max(outer, inner) as AccentLevel
}

export function cloneBeatAccent(accent: BeatAccent): BeatAccent {
  return { beat: accent.beat, level: accent.level }
}

export function cloneSubdivAccent(accent: SubdivAccent): SubdivAccent {
  return { num: accent.num, den: accent.den, level: accent.level }
}

/** Meter-aware Click defaults: strong on 1, softer secondary later — never every beat. */
export function defaultBeatAccents(beats: number, beatUnit: BeatUnit): BeatAccent[] {
  const count = clampBeats(beats)
  const next: BeatAccent[] = [{ beat: 0, level: 2 }]
  const soft: number[] = []

  if (beatUnit === 8 && count % 3 === 0) {
    const pulses = count / 3
    if (pulses === 2) soft.push(3)
    else if (pulses === 3) soft.push(3, 6)
    else if (pulses === 4) soft.push(6)
    else {
      for (let beat = 3; beat < count; beat += 3) soft.push(beat)
    }
  } else if (count === 4) soft.push(2)
  else if (count === 5) soft.push(3)
  else if (count === 7) soft.push(3)
  else if (count === 11) soft.push(3, 6)
  else if (count === 13) soft.push(3, 8)
  else if (count >= 6 && count % 2 === 0) soft.push(count / 2)

  for (const beat of soft) {
    if (beat > 0 && beat < count) next.push({ beat, level: 1 })
  }
  return next
}

export function accentsFromBeatIndices(beats: number, indices: number[]): BeatAccent[] {
  const count = clampBeats(beats)
  const unique = [...new Set(indices.filter((beat) => Number.isInteger(beat) && beat >= 0 && beat < count))]
  if (unique.length === 0) return defaultBeatAccents(count, 4)
  return unique.map((beat) => ({ beat, level: beat === 0 ? 2 : 1 }))
}

export function clampBeatAccents(accents: readonly BeatAccent[], beats: number): BeatAccent[] {
  const count = clampBeats(beats)
  const next: BeatAccent[] = []
  for (const accent of accents) {
    if (!Number.isInteger(accent.beat) || accent.beat < 0 || accent.beat >= count) continue
    if (accent.level !== 1 && accent.level !== 2) continue
    const index = next.findIndex((item) => item.beat === accent.beat)
    if (index >= 0) next[index] = { beat: accent.beat, level: accent.level }
    else next.push({ beat: accent.beat, level: accent.level })
  }
  return next
}

export function clampSubdivAccents(accents: readonly SubdivAccent[]): SubdivAccent[] {
  const next: SubdivAccent[] = []
  for (const accent of accents) {
    if (!Number.isInteger(accent.num) || !Number.isInteger(accent.den) || accent.den <= 0) continue
    if (accent.level !== 1 && accent.level !== 2) continue
    const hit = reduceHit(0, accent.num, accent.den)
    const row: SubdivAccent = { num: hit.num, den: hit.den, level: accent.level }
    const index = next.findIndex((item) => item.num === row.num && item.den === row.den)
    if (index >= 0) next[index] = row
    else next.push(row)
  }
  return next
}

function isBeatAccent(value: unknown): value is BeatAccent {
  if (!value || typeof value !== 'object') return false
  const row = value as { beat?: unknown; level?: unknown }
  return Number.isInteger(row.beat) && (row.level === 1 || row.level === 2)
}

function isSubdivAccent(value: unknown): value is SubdivAccent {
  if (!value || typeof value !== 'object') return false
  const row = value as { num?: unknown; den?: unknown; level?: unknown }
  return Number.isInteger(row.num) && Number.isInteger(row.den) && (row.level === 1 || row.level === 2)
}

/** v7 stacked-grid accents: only lift downbeats into the outer beat row. */
function isLegacyAccentPos(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const row = value as { beat?: unknown; num?: unknown; den?: unknown; level?: unknown }
  return (
    Number.isInteger(row.beat) &&
    Number.isInteger(row.num) &&
    Number.isInteger(row.den) &&
    (row.level === 1 || row.level === 2)
  )
}

export function parseBeatAccents(raw: unknown, beats: number, beatUnit: BeatUnit): BeatAccent[] {
  if (!Array.isArray(raw)) return defaultBeatAccents(beats, beatUnit)
  if (raw.length === 0) return []
  if (raw.every(isBeatAccent) && raw.every((item) => !('num' in item) && !('den' in item))) {
    return clampBeatAccents(raw, beats)
  }
  if (raw.every(isLegacyAccentPos)) {
    const downbeats = (raw as { beat: number; num: number; den: number; level: 1 | 2 }[])
      .filter((item) => item.num === 0)
      .map((item) => ({ beat: item.beat, level: item.level }))
    return downbeats.length > 0 ? clampBeatAccents(downbeats, beats) : defaultBeatAccents(beats, beatUnit)
  }
  if (raw.every((item) => Number.isInteger(item))) {
    return defaultBeatAccents(beats, beatUnit)
  }
  return defaultBeatAccents(beats, beatUnit)
}

export function parseSubdivAccents(raw: unknown): SubdivAccent[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  if (raw.every(isSubdivAccent)) return clampSubdivAccents(raw)
  return []
}

export function beatAccentAt(accents: readonly BeatAccent[], beat: number): AccentLevel {
  return accents.find((item) => item.beat === beat)?.level ?? 0
}

export function subdivAccentAt(
  accents: readonly SubdivAccent[],
  slot: number,
  steps: number,
): AccentLevel {
  for (const accent of accents) {
    const index = hitSlot({ beat: 0, num: accent.num, den: accent.den }, steps)
    if (index === slot) return accent.level
  }
  return 0
}

export function cycleBeatAccent(
  accents: readonly BeatAccent[],
  beat: number,
  beats: number,
): BeatAccent[] {
  if (beat < 0 || beat >= beats) return accents.map(cloneBeatAccent)
  const nextLevel = nextAccentLevel(beatAccentAt(accents, beat))
  const without = accents.filter((item) => item.beat !== beat).map(cloneBeatAccent)
  if (nextLevel === 0) return without
  return [...without, { beat, level: nextLevel }]
}

export function cycleSubdivAccent(
  accents: readonly SubdivAccent[],
  slot: number,
  steps: number,
): SubdivAccent[] {
  if (slot < 0 || slot >= steps) return accents.map(cloneSubdivAccent)
  const nextLevel = nextAccentLevel(subdivAccentAt(accents, slot, steps))
  const without = accents.filter((item) => hitSlot({ beat: 0, num: item.num, den: item.den }, steps) !== slot)
  if (nextLevel === 0) return without.map(cloneSubdivAccent)
  const hit = reduceHit(0, slot, steps)
  return [...without.map(cloneSubdivAccent), { num: hit.num, den: hit.den, level: nextLevel }]
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
  accents?: BeatAccent[] | number[],
  subdivAccents?: SubdivAccent[],
): RhythmBar {
  const safeBeats = clampBeats(beats)
  const sub = normalizeSubdivision(subdivision)
  const beatAccents =
    accents === undefined
      ? defaultBeatAccents(safeBeats, beatUnit)
      : Array.isArray(accents) && accents.every(isBeatAccent)
        ? clampBeatAccents(accents, safeBeats)
        : Array.isArray(accents) && accents.every((item) => Number.isInteger(item))
          ? accentsFromBeatIndices(safeBeats, accents as number[])
          : defaultBeatAccents(safeBeats, beatUnit)
  return {
    beats: safeBeats,
    beatUnit,
    subdivision: sub,
    beatAccents,
    subdivAccents: clampSubdivAccents(subdivAccents ?? []),
    pattern: filterPatternBeats(pattern ?? emptyPattern(), safeBeats),
  }
}

export function cloneBar(bar: RhythmBar): RhythmBar {
  return {
    beats: bar.beats,
    beatUnit: bar.beatUnit,
    subdivision: bar.subdivision,
    beatAccents: bar.beatAccents.map(cloneBeatAccent),
    subdivAccents: bar.subdivAccents.map(cloneSubdivAccent),
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
    beatAccents: meterChanged
      ? defaultBeatAccents(safeBeats, beatUnit)
      : clampBeatAccents(bar.beatAccents, safeBeats),
    subdivAccents: bar.subdivAccents.map(cloneSubdivAccent),
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
