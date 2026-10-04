import {
  MAX_BARS,
  MAX_BEATS,
  MIN_BEATS,
  VOICES,
  clampBeats,
  clampBpm,
  cloneBar,
  emptyPattern,
  isBeatUnit,
  makeBar,
  normalizeBeatSubdivisions,
  normalizeSubdivision,
  parseBeatAccents,
  parseVoiceHits,
  type BeatAccent,
  type BeatUnit,
  type RhythmBar,
  type SubdivisionId,
  type VoiceId,
} from './rhythm.ts'
import { type RhythmPreset, type RhythmStyle, type RhythmStyleId } from './rhythm-presets.ts'

export const FACTORY_LIBRARY_CACHE_KEY = 'omnician.factory-library.v1'
export const FACTORY_LIBRARY_VERSION = 1
export const FACTORY_HISTORY_LIMIT = 20
export const FACTORY_MAX_JSON_BYTES = 400_000

export const FACTORY_STYLE_IDS = [
  'rock',
  'funk',
  'metal',
  'pop',
  'hiphop',
  'house',
  'latin',
  'shuffle',
  'jazz',
  'waltz',
  'odd',
] as const satisfies readonly RhythmStyleId[]

export type FactoryBar = {
  beats: number
  beatUnit: BeatUnit
  subdivision: SubdivisionId
  beatAccents?: BeatAccent[]
  beatSubdivisions?: SubdivisionId[]
  pattern: Partial<Record<VoiceId, Array<{ beat: number; num: number; den: number; soft?: boolean }>>>
}

export type FactoryBeat = {
  id: string
  name: string
  blurb: string
  bpm: number
  bars: FactoryBar[]
}

export type FactoryStyle = {
  id: RhythmStyleId
  name: string
  beats: FactoryBeat[]
}

export type FactoryLibrary = {
  version: number
  updatedAt: string
  styles: FactoryStyle[]
}

export type FactoryHistoryItem = {
  id: string
  savedAt: string
  beatCount: number
  library: FactoryLibrary
}

export type FactoryValidateOk = { ok: true; library: FactoryLibrary }
export type FactoryValidateErr = { ok: false; error: string }
export type FactoryValidateResult = FactoryValidateOk | FactoryValidateErr

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i

export function isFactoryStyleId(value: unknown): value is RhythmStyleId {
  return typeof value === 'string' && (FACTORY_STYLE_IDS as readonly string[]).includes(value)
}

export function serializeBar(bar: RhythmBar): FactoryBar {
  const pattern: FactoryBar['pattern'] = {}
  for (const voice of VOICES) {
    const hits = bar.pattern[voice]
    if (!hits.length) continue
    pattern[voice] = hits.map((hit) => ({
      beat: hit.beat,
      num: hit.num,
      den: hit.den,
      ...(hit.soft ? { soft: true } : {}),
    }))
  }
  return {
    beats: bar.beats,
    beatUnit: bar.beatUnit,
    subdivision: bar.subdivision,
    beatAccents: bar.beatAccents,
    beatSubdivisions: bar.beatSubdivisions,
    pattern,
  }
}

export function parseFactoryBar(raw: unknown): RhythmBar | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as {
    beats?: unknown
    beatUnit?: unknown
    subdivision?: unknown
    beatAccents?: unknown
    beatSubdivisions?: unknown
    pattern?: unknown
  }
  const beats = clampBeats(typeof row.beats === 'number' ? row.beats : 4)
  if (beats < MIN_BEATS || beats > MAX_BEATS) return null
  if (!isBeatUnit(row.beatUnit)) return null
  const subdivision = normalizeSubdivision(row.subdivision)
  const pattern = emptyPattern()
  if (row.pattern && typeof row.pattern === 'object') {
    const source = row.pattern as Partial<Record<string, unknown>>
    for (const voice of VOICES) {
      pattern[voice] = parseVoiceHits(source[voice], beats, subdivision)
    }
  }
  const beatAccents = parseBeatAccents(row.beatAccents, beats, row.beatUnit)
  const beatSubdivisions = Array.isArray(row.beatSubdivisions)
    ? normalizeBeatSubdivisions(beats, subdivision, row.beatSubdivisions)
    : undefined
  return makeBar(beats, row.beatUnit, subdivision, pattern, beatAccents, beatSubdivisions)
}

export function stylesToFactoryLibrary(
  styles: readonly RhythmStyle[],
  barsOf: (preset: RhythmPreset) => RhythmBar[],
  updatedAt = new Date(0).toISOString(),
): FactoryLibrary {
  return {
    version: FACTORY_LIBRARY_VERSION,
    updatedAt,
    styles: styles.map((style) => ({
      id: style.id,
      name: style.name,
      beats: style.grooves.map((preset) => ({
        id: preset.id,
        name: preset.name,
        blurb: preset.blurb,
        bpm: preset.bpm ?? 120,
        bars: barsOf(preset).map(serializeBar),
      })),
    })),
  }
}

export function factoryBeatToPreset(style: FactoryStyle, beat: FactoryBeat, index: number): RhythmPreset | null {
  const bars = beat.bars.map(parseFactoryBar).filter((bar): bar is RhythmBar => bar !== null)
  if (!bars.length) return null
  const first = bars[0]!
  return {
    id: beat.id,
    styleId: style.id,
    styleName: style.name,
    groove: index + 1,
    name: beat.name,
    blurb: beat.blurb,
    beats: first.beats,
    beatUnit: first.beatUnit,
    subdivision: first.subdivision,
    hits: {},
    pattern: first.pattern,
    bpm: beat.bpm,
    bars: bars.map(cloneBar),
  }
}

export function factoryLibraryToStyles(library: FactoryLibrary): RhythmStyle[] {
  return library.styles.map((style) => ({
    id: style.id,
    name: style.name,
    grooves: style.beats
      .map((beat, index) => factoryBeatToPreset(style, beat, index))
      .filter((item): item is RhythmPreset => item !== null),
  }))
}

export function factoryBeatCount(library: FactoryLibrary): number {
  return library.styles.reduce((sum, style) => sum + style.beats.length, 0)
}

export function findFactoryBeat(library: FactoryLibrary, id: string): { style: FactoryStyle; beat: FactoryBeat; index: number } | null {
  for (const style of library.styles) {
    const index = style.beats.findIndex((beat) => beat.id === id)
    if (index >= 0) return { style, beat: style.beats[index]!, index }
  }
  return null
}

export function cloneFactoryLibrary(library: FactoryLibrary): FactoryLibrary {
  return structuredClone(library)
}

function parseBeat(raw: unknown, seen: Set<string>): FactoryBeat | string {
  if (!raw || typeof raw !== 'object') return 'Each factory beat must be an object.'
  const row = raw as {
    id?: unknown
    name?: unknown
    blurb?: unknown
    bpm?: unknown
    bars?: unknown
  }
  if (typeof row.id !== 'string' || !ID_RE.test(row.id)) return 'Each factory beat needs a short id.'
  if (seen.has(row.id)) return `Duplicate factory beat id: ${row.id}`
  seen.add(row.id)
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  if (!name || name.length > 80) return `Beat ${row.id} needs a name.`
  const blurb = typeof row.blurb === 'string' ? row.blurb.trim().slice(0, 160) : ''
  if (!Array.isArray(row.bars) || row.bars.length < 1 || row.bars.length > MAX_BARS) {
    return `Beat ${row.id} must have 1–${MAX_BARS} bars.`
  }
  const bars: FactoryBar[] = []
  for (const item of row.bars) {
    const parsed = parseFactoryBar(item)
    if (!parsed) return `Beat ${row.id} has an invalid bar.`
    bars.push(serializeBar(parsed))
  }
  return {
    id: row.id,
    name,
    blurb,
    bpm: clampBpm(typeof row.bpm === 'number' ? row.bpm : 120),
    bars,
  }
}

export function validateFactoryLibrary(raw: unknown): FactoryValidateResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Library must be a JSON object.' }
  const row = raw as { version?: unknown; updatedAt?: unknown; styles?: unknown }
  if (row.version !== FACTORY_LIBRARY_VERSION) {
    return { ok: false, error: `Unsupported library version (need ${FACTORY_LIBRARY_VERSION}).` }
  }
  if (typeof row.updatedAt !== 'string' || row.updatedAt.length > 80) {
    return { ok: false, error: 'Library needs an updatedAt timestamp.' }
  }
  if (!Array.isArray(row.styles) || row.styles.length === 0 || row.styles.length > FACTORY_STYLE_IDS.length) {
    return { ok: false, error: 'Library must list the factory styles.' }
  }
  const seenStyles = new Set<string>()
  const seenBeats = new Set<string>()
  const styles: FactoryStyle[] = []
  for (const item of row.styles) {
    if (!item || typeof item !== 'object') return { ok: false, error: 'Each style must be an object.' }
    const style = item as { id?: unknown; name?: unknown; beats?: unknown }
    if (!isFactoryStyleId(style.id)) return { ok: false, error: 'Unknown factory style.' }
    if (seenStyles.has(style.id)) return { ok: false, error: `Duplicate style: ${style.id}` }
    seenStyles.add(style.id)
    const name = typeof style.name === 'string' && style.name.trim() ? style.name.trim().slice(0, 40) : style.id
    if (!Array.isArray(style.beats) || style.beats.length > 40) {
      return { ok: false, error: `Style ${style.id} has too many beats.` }
    }
    const beats: FactoryBeat[] = []
    for (const beatRaw of style.beats) {
      const parsed = parseBeat(beatRaw, seenBeats)
      if (typeof parsed === 'string') return { ok: false, error: parsed }
      beats.push(parsed)
    }
    styles.push({ id: style.id, name, beats })
  }
  for (const id of FACTORY_STYLE_IDS) {
    if (!seenStyles.has(id)) {
      styles.push({ id, name: id, beats: [] })
    }
  }
  styles.sort((a, b) => FACTORY_STYLE_IDS.indexOf(a.id) - FACTORY_STYLE_IDS.indexOf(b.id))
  return {
    ok: true,
    library: {
      version: FACTORY_LIBRARY_VERSION,
      updatedAt: row.updatedAt,
      styles,
    },
  }
}

export function parseFactoryLibraryJson(text: string): FactoryValidateResult {
  if (text.length > FACTORY_MAX_JSON_BYTES) return { ok: false, error: 'Library JSON is too large.' }
  try {
    return validateFactoryLibrary(JSON.parse(text) as unknown)
  } catch {
    return { ok: false, error: 'Library JSON is not valid.' }
  }
}

export function emptyFactoryBeat(_styleId: RhythmStyleId, id: string): FactoryBeat {
  return {
    id,
    name: 'New factory beat',
    blurb: '',
    bpm: 120,
    bars: Array.from({ length: 4 }, () => serializeBar(makeBar(4, 4, 4))),
  }
}

export function newFactoryBeatId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `fx-${crypto.randomUUID().slice(0, 8)}`
  }
  return `fx-${Date.now().toString(36)}`
}

export function moveFactoryBeat(
  library: FactoryLibrary,
  id: string,
  styleId: RhythmStyleId,
  index: number,
): FactoryLibrary {
  const next = cloneFactoryLibrary(library)
  let moving: FactoryBeat | null = null
  for (const style of next.styles) {
    const found = style.beats.findIndex((beat) => beat.id === id)
    if (found >= 0) {
      moving = style.beats.splice(found, 1)[0] ?? null
      break
    }
  }
  const target = next.styles.find((style) => style.id === styleId)
  if (!moving || !target) return library
  const at = Math.min(target.beats.length, Math.max(0, index))
  target.beats.splice(at, 0, moving)
  return next
}

export function upsertFactoryBeat(library: FactoryLibrary, styleId: RhythmStyleId, beat: FactoryBeat): FactoryLibrary {
  const next = cloneFactoryLibrary(library)
  for (const style of next.styles) {
    style.beats = style.beats.filter((item) => item.id !== beat.id)
  }
  const target = next.styles.find((style) => style.id === styleId)
  if (!target) return library
  target.beats.push(beat)
  return next
}

export function replaceFactoryBeat(library: FactoryLibrary, beat: FactoryBeat): FactoryLibrary {
  const next = cloneFactoryLibrary(library)
  for (const style of next.styles) {
    const index = style.beats.findIndex((item) => item.id === beat.id)
    if (index >= 0) {
      style.beats[index] = beat
      return next
    }
  }
  return library
}

export function deleteFactoryBeat(library: FactoryLibrary, id: string): FactoryLibrary {
  const next = cloneFactoryLibrary(library)
  for (const style of next.styles) {
    style.beats = style.beats.filter((beat) => beat.id !== id)
  }
  return next
}
