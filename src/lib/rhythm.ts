export const VOICES = [
  'kick',
  'snare',
  'rim',
  'highTom',
  'midTom',
  'floorTom',
  'closedHat',
  'openHat',
  'ride',
  'rideBell',
  'crash',
  'stack',
  'splash',
  'china',
] as const

export type VoiceId = (typeof VOICES)[number]

export const VOICE_LABELS: Record<VoiceId, string> = {
  kick: 'Kick',
  snare: 'Snare',
  rim: 'Rimshot',
  highTom: 'Tom 1',
  midTom: 'Tom 2',
  floorTom: 'Fl Tom',
  closedHat: 'HH Closed',
  openHat: 'HH Open',
  ride: 'Ride',
  rideBell: 'Ride Bell',
  crash: 'Crash',
  stack: 'Stack',
  splash: 'Splash',
  china: 'China',
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

export const CLICK_SOUNDS = ['wood', 'clave', 'digital', 'mechanical'] as const

export type ClickSoundId = (typeof CLICK_SOUNDS)[number]
export const DEFAULT_CLICK_SOUND: ClickSoundId = 'wood'

export const CLICK_SOUND_LABELS: Record<ClickSoundId, string> = {
  wood: 'Wood',
  clave: 'Clave',
  digital: 'Digital',
  mechanical: 'Mechanical',
}

/** Old picker ids (and anything unknown) land on Wood. */
const LEGACY_CLICK_SOUND: Record<string, ClickSoundId> = {
  woodSoft: 'wood',
  woodblock: 'wood',
  digitalSoft: 'digital',
  mechanicalSoft: 'mechanical',
  rim: 'wood',
  tick: 'wood',
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

/** Accent on a main beat of the bar. Subdivision clicks stay unaccented. */
export type BeatAccent = { beat: number; level: 1 | 2 }

export type RhythmBar = {
  beats: number
  beatUnit: BeatUnit
  subdivision: SubdivisionId
  /** Per-beat click subdivision. Drums keep using `subdivision` for the grid. */
  beatSubdivisions: SubdivisionId[]
  beatAccents: BeatAccent[]
  pattern: Pattern
}

export type ClickPulse = {
  beat: number
  slot: number
  onBeat: boolean
  offsetSec: number
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

export function dedupeHits(hits: readonly HitPos[]): HitPos[] {
  const next: HitPos[] = []
  for (const hit of hits) {
    if (!next.some((item) => sameHit(item, hit))) next.push(hit)
  }
  return next
}

/** Saved Crash R hits land on Crash; matching steps stay one hit. */
function isHitRow(value: unknown): value is HitPos[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        Number.isInteger((item as HitPos).beat) &&
        Number.isInteger((item as HitPos).num) &&
        Number.isInteger((item as HitPos).den),
    )
  )
}

export function parseVoiceHits(raw: unknown, beats: number, subdivision: SubdivisionId): HitPos[] {
  const steps = stepsPerBeat(subdivision)
  const hits: HitPos[] = []
  if (isHitRow(raw)) {
    for (const item of raw) {
      if (item.den > 0 && item.beat >= 0 && item.beat < beats) {
        hits.push(reduceHit(item.beat, item.num, item.den))
      }
    }
    return hits
  }
  if (Array.isArray(raw) && raw.every((item) => typeof item === 'boolean')) {
    raw.forEach((on, step) => {
      if (!on) return
      const beat = Math.floor(step / steps)
      const slot = step % steps
      if (beat >= 0 && beat < beats && slot >= 0 && slot < steps) {
        hits.push(reduceHit(beat, slot, steps))
      }
    })
  }
  return hits
}

export function absorbCrashRHits(raw: unknown, pattern: Pattern, beats: number, subdivision: SubdivisionId): Pattern {
  if (!raw || typeof raw !== 'object') return pattern
  const extra = parseVoiceHits((raw as { crashR?: unknown }).crashR, beats, subdivision)
  if (extra.length === 0) return pattern
  const next = clonePattern(pattern)
  next.crash = dedupeHits([...(next.crash ?? []), ...extra])
  return next
}

/** Fold retired Clap → Snare and Tom 3 → remaining toms so old saves keep sounding. */
export function absorbRetiredKitHits(
  raw: unknown,
  pattern: Pattern,
  beats: number,
  subdivision: SubdivisionId,
): Pattern {
  if (!raw || typeof raw !== 'object') return pattern
  const row = raw as { clap?: unknown; lowTom?: unknown }
  const clap = parseVoiceHits(row.clap, beats, subdivision)
  const lowTom = parseVoiceHits(row.lowTom, beats, subdivision)
  if (clap.length === 0 && lowTom.length === 0) return pattern
  const next = clonePattern(pattern)
  if (clap.length > 0) next.snare = dedupeHits([...(next.snare ?? []), ...clap])
  if (lowTom.length > 0) {
    const steps = stepsPerBeat(subdivision)
    const stepOf = (hit: HitPos) => {
      const slot = hitSlot(hit, steps)
      return slot == null ? hit.beat * steps : hit.beat * steps + slot
    }
    const occupied = new Set(
      [...(next.highTom ?? []), ...(next.midTom ?? []), ...(next.floorTom ?? [])].map(stepOf),
    )
    const floorMin = (next.floorTom ?? []).reduce(
      (min, hit) => Math.min(min, stepOf(hit)),
      Number.POSITIVE_INFINITY,
    )
    const mid: HitPos[] = []
    const floor: HitPos[] = []
    for (const hit of lowTom) {
      const step = stepOf(hit)
      if (occupied.has(step)) continue
      occupied.add(step)
      if (step >= floorMin) floor.push(hit)
      else mid.push(hit)
    }
    if (mid.length > 0) next.midTom = dedupeHits([...(next.midTom ?? []), ...mid])
    if (floor.length > 0) next.floorTom = dedupeHits([...(next.floorTom ?? []), ...floor])
  }
  return next
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
  if (beat < 0 || beat >= beats || slot < 0 || slot >= steps) return pattern
  const target = reduceHit(beat, slot, steps)
  const row = pattern[voice] ?? []
  const exists = row.some((hit) => sameHit(hit, target))
  return setHit(pattern, voice, step, beats, subdivision, !exists)
}

/** Set a grid cell on or off. Returns the same pattern reference when nothing changes. */
export function setHit(
  pattern: Pattern,
  voice: VoiceId,
  step: number,
  beats: number,
  subdivision: SubdivisionId,
  on: boolean,
): Pattern {
  const steps = stepsPerBeat(subdivision)
  const beat = Math.floor(step / steps)
  const slot = step % steps
  if (beat < 0 || beat >= beats || slot < 0 || slot >= steps) return pattern
  const target = reduceHit(beat, slot, steps)
  const row = pattern[voice] ?? []
  const index = row.findIndex((hit) => sameHit(hit, target))
  if (on && index >= 0) return pattern
  if (!on && index < 0) return pattern
  const next = clonePattern(pattern)
  if (on) next[voice].push(target)
  else next[voice].splice(index, 1)
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

export function cloneBeatAccent(accent: BeatAccent): BeatAccent {
  return { beat: accent.beat, level: accent.level }
}

export function normalizeBeatSubdivisions(
  beats: number,
  subdivision: SubdivisionId,
  existing?: readonly unknown[],
): SubdivisionId[] {
  const count = clampBeats(beats)
  const fallback = normalizeSubdivision(subdivision)
  return Array.from({ length: count }, (_, index) => {
    const raw = existing?.[index]
    return isSubdivision(raw) ? raw : fallback
  })
}

export function beatSubdivisionAt(
  bar: Pick<RhythmBar, 'subdivision' | 'beatSubdivisions'>,
  beat: number,
): SubdivisionId {
  return bar.beatSubdivisions[beat] ?? bar.subdivision
}

export function setBeatSubdivision(bar: RhythmBar, beat: number, subdivision: SubdivisionId): RhythmBar {
  if (beat < 0 || beat >= bar.beats) return cloneBar(bar)
  const next = cloneBar(bar)
  next.beatSubdivisions[beat] = normalizeSubdivision(subdivision)
  return next
}

export function clickPulsesInBar(bar: Pick<RhythmBar, 'beats' | 'subdivision' | 'beatSubdivisions'>, bpm: number): ClickPulse[] {
  const beatSec = beatDurationSec(bpm)
  const pulses: ClickPulse[] = []
  for (let beat = 0; beat < bar.beats; beat += 1) {
    const steps = Math.max(1, stepsPerBeat(beatSubdivisionAt(bar, beat)))
    const slotSec = beatSec / steps
    for (let slot = 0; slot < steps; slot += 1) {
      pulses.push({
        beat,
        slot,
        onBeat: slot === 0,
        offsetSec: beat * beatSec + slot * slotSec,
      })
    }
  }
  return pulses
}

export function barDurationSec(beats: number, bpm: number): number {
  return clampBeats(beats) * beatDurationSec(bpm)
}

/** Strong on beat 1 only. Every other beat is unaccented, for every meter. */
export function defaultBeatAccents(beats: number, _beatUnit?: BeatUnit): BeatAccent[] {
  clampBeats(beats)
  return [{ beat: 0, level: 2 }]
}

/** Pre–beat-1-only defaults: strong on 1 plus meter-aware softs (e.g. beat 3 in 4/4). */
export function legacyDefaultBeatAccents(beats: number, beatUnit: BeatUnit): BeatAccent[] {
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

export function accentsEqual(left: readonly BeatAccent[], right: readonly BeatAccent[]): boolean {
  if (left.length !== right.length) return false
  const a = [...left].sort((x, y) => x.beat - y.beat)
  const b = [...right].sort((x, y) => x.beat - y.beat)
  return a.every((item, index) => item.beat === b[index].beat && item.level === b[index].level)
}

/** Reset saved accents that still match the old meter-aware default. */
export function migrateLegacyDefaultAccents(
  accents: readonly BeatAccent[],
  beats: number,
  beatUnit: BeatUnit,
): BeatAccent[] {
  if (accentsEqual(accents, legacyDefaultBeatAccents(beats, beatUnit))) {
    return defaultBeatAccents(beats, beatUnit)
  }
  return accents.map(cloneBeatAccent)
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

function isBeatAccent(value: unknown): value is BeatAccent {
  if (!value || typeof value !== 'object') return false
  const row = value as { beat?: unknown; level?: unknown }
  return Number.isInteger(row.beat) && (row.level === 1 || row.level === 2)
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
  let next: BeatAccent[]
  if (!Array.isArray(raw)) next = defaultBeatAccents(beats, beatUnit)
  else if (raw.length === 0) next = []
  else if (raw.every(isBeatAccent) && raw.every((item) => !('num' in item) && !('den' in item))) {
    next = clampBeatAccents(raw, beats)
  } else if (raw.every(isLegacyAccentPos)) {
    const downbeats = (raw as { beat: number; num: number; den: number; level: 1 | 2 }[])
      .filter((item) => item.num === 0)
      .map((item) => ({ beat: item.beat, level: item.level }))
    next = downbeats.length > 0 ? clampBeatAccents(downbeats, beats) : defaultBeatAccents(beats, beatUnit)
  } else {
    next = defaultBeatAccents(beats, beatUnit)
  }
  return migrateLegacyDefaultAccents(next, beats, beatUnit)
}

export function beatAccentAt(accents: readonly BeatAccent[], beat: number): AccentLevel {
  return accents.find((item) => item.beat === beat)?.level ?? 0
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
  beatSubdivisions?: readonly SubdivisionId[],
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
    beatSubdivisions: normalizeBeatSubdivisions(safeBeats, sub, beatSubdivisions),
    beatAccents,
    pattern: filterPatternBeats(pattern ?? emptyPattern(), safeBeats),
  }
}

export function cloneBar(bar: RhythmBar): RhythmBar {
  return {
    beats: bar.beats,
    beatUnit: bar.beatUnit,
    subdivision: bar.subdivision,
    beatSubdivisions: normalizeBeatSubdivisions(bar.beats, bar.subdivision, bar.beatSubdivisions),
    beatAccents: bar.beatAccents.map(cloneBeatAccent),
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
  const sub = normalizeSubdivision(subdivision)
  return {
    beats: safeBeats,
    beatUnit,
    subdivision: sub,
    beatSubdivisions: normalizeBeatSubdivisions(safeBeats, sub, bar.beatSubdivisions),
    beatAccents: meterChanged
      ? defaultBeatAccents(safeBeats, beatUnit)
      : clampBeatAccents(bar.beatAccents, safeBeats),
    pattern: filterPatternBeats(bar.pattern, safeBeats),
  }
}

export function setBarSubdivision(bar: RhythmBar, subdivision: SubdivisionId): RhythmBar {
  const sub = normalizeSubdivision(subdivision)
  return {
    ...cloneBar(bar),
    subdivision: sub,
    beatSubdivisions: normalizeBeatSubdivisions(bar.beats, sub),
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

/** Voices closer than this stay; only later notes are cancelled and re-picked. */
export const LIVE_COMMIT_SEC = 0.01

/** Keep the same place in the bar when tempo jumps: stretch elapsed time by old/new. */
export function remapBarStart(now: number, oldBarStart: number, oldBpm: number, newBpm: number): number {
  const elapsed = now - oldBarStart
  return now - elapsed * (oldBpm / newBpm)
}

/** First step (or pulse) whose time is still after `commit`; wrap if the bar is already past. */
export function nextEventAfter(
  times: readonly number[],
  commit: number,
  barEnd: number,
): { index: number; time: number; wrap: boolean } {
  for (let index = 0; index < times.length; index += 1) {
    if (times[index] > commit) return { index, time: times[index], wrap: false }
  }
  return { index: 0, time: barEnd, wrap: true }
}

export function timesAfter(times: readonly number[], after: number): number[] {
  return times.filter((time) => time > after)
}

/** Recompute the current bar from the playhead so a manual tempo change stays in phase. */
export function planLiveTempoRetarget(
  now: number,
  oldBarStart: number,
  oldBpm: number,
  newBpm: number,
  offsetsAtNewTempo: readonly number[],
  beats: number,
  commitLead = LIVE_COMMIT_SEC,
): {
  newBarStart: number
  commit: number
  barEnd: number
  next: { index: number; time: number; wrap: boolean }
  remaining: number[]
} {
  const newBarStart = remapBarStart(now, oldBarStart, oldBpm, newBpm)
  const commit = now + commitLead
  const times = offsetsAtNewTempo.map((offset) => newBarStart + offset)
  const barEnd = newBarStart + barDurationSec(beats, newBpm)
  return {
    newBarStart,
    commit,
    barEnd,
    next: nextEventAfter(times, commit, barEnd),
    remaining: timesAfter(times, commit),
  }
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
