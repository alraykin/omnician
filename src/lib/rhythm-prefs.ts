import {
  DEFAULT_BPM,
  MAX_BARS,
  VOICES,
  clampAccents,
  clampBeats,
  clampBpm,
  cloneBar,
  emptyPattern,
  isBeatUnit,
  isClickSound,
  isSubdivision,
  makeBar,
  reshapePattern,
  resizeHits,
  stepsInBar,
  type BeatUnit,
  type ClickSoundId,
  type Pattern,
  type RhythmBar,
  type RhythmMode,
  type SubdivisionId,
  type VoiceId,
} from '@/lib/rhythm'
import { findPreset, presetToBar } from '@/lib/rhythm-presets'

const STORAGE_KEY = 'omnician.rhythm.v2'
const LEGACY_KEY = 'omnician.rhythm.v1'

export type RhythmPrefs = {
  bpm: number
  mode: RhythmMode
  clickSound: ClickSoundId
  bars: RhythmBar[]
  barIndex: number
  presetId: string | null
}

const DEFAULT_BAR_COUNT = 4

function fallback(): RhythmPrefs {
  const rock = findPreset('rock-44')
  const bar = rock ? presetToBar(rock) : makeBar(4, 4, 'eighths')
  return {
    bpm: DEFAULT_BPM,
    mode: 'drums',
    clickSound: 'woodblock',
    bars: Array.from({ length: DEFAULT_BAR_COUNT }, () => cloneBar(bar)),
    barIndex: 0,
    presetId: rock?.id ?? 'rock-44',
  }
}

function isBoolRow(value: unknown): value is boolean[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'boolean')
}

function parsePattern(raw: unknown, beats: number, subdivision: SubdivisionId): Pattern {
  const empty = emptyPattern(beats, subdivision)
  if (!raw || typeof raw !== 'object') return empty
  const row = raw as Partial<Record<VoiceId, unknown>>
  const length = stepsInBar({ beats, subdivision })
  for (const voice of VOICES) {
    if (isBoolRow(row[voice])) empty[voice] = resizeHits(row[voice], length)
  }
  return empty
}

function parseBar(raw: unknown): RhythmBar | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as {
    beats?: unknown
    beatUnit?: unknown
    subdivision?: unknown
    accents?: unknown
    pattern?: unknown
  }
  const beats = clampBeats(typeof row.beats === 'number' ? row.beats : 4)
  const beatUnit: BeatUnit = isBeatUnit(row.beatUnit) ? row.beatUnit : 4
  const subdivision: SubdivisionId = isSubdivision(row.subdivision)
    ? row.subdivision
    : 'sixteenths'
  const accents = Array.isArray(row.accents)
    ? clampAccents(
        row.accents.filter((item): item is number => Number.isInteger(item)),
        beats,
      )
    : undefined
  return makeBar(
    beats,
    beatUnit,
    subdivision,
    parsePattern(row.pattern, beats, subdivision),
    accents,
  )
}

function fromLegacy(): RhythmPrefs | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const row = parsed as {
      bpm?: unknown
      mode?: unknown
      meterId?: unknown
      accents?: unknown
      pattern?: unknown
      presetId?: unknown
    }
    const meterMap: Record<string, { beats: number; beatUnit: BeatUnit; sub: SubdivisionId }> = {
      '2/4': { beats: 2, beatUnit: 4, sub: 'sixteenths' },
      '3/4': { beats: 3, beatUnit: 4, sub: 'sixteenths' },
      '4/4': { beats: 4, beatUnit: 4, sub: 'sixteenths' },
      '5/4': { beats: 5, beatUnit: 4, sub: 'eighths' },
      '6/8': { beats: 6, beatUnit: 8, sub: 'eighths' },
      '7/8': { beats: 7, beatUnit: 8, sub: 'eighths' },
      '9/8': { beats: 9, beatUnit: 8, sub: 'eighths' },
      '12/8': { beats: 12, beatUnit: 8, sub: 'eighths' },
    }
    const meter =
      typeof row.meterId === 'string' && meterMap[row.meterId]
        ? meterMap[row.meterId]
        : meterMap['4/4']
    const pattern = parsePattern(row.pattern, meter.beats, meter.sub)
    const bar = makeBar(
      meter.beats,
      meter.beatUnit,
      meter.sub,
      reshapePattern(pattern, meter.beats, meter.sub, meter.beats, meter.sub),
      Array.isArray(row.accents)
        ? row.accents.filter((item): item is number => Number.isInteger(item))
        : undefined,
    )
    return {
      bpm: clampBpm(typeof row.bpm === 'number' ? row.bpm : DEFAULT_BPM),
      mode: row.mode === 'drums' ? 'drums' : 'click',
      clickSound: 'woodblock',
      bars: [bar],
      barIndex: 0,
      presetId: typeof row.presetId === 'string' ? row.presetId : null,
    }
  } catch {
    return null
  }
}

export function loadRhythmPrefs(): RhythmPrefs {
  const base = fallback()
  if (typeof localStorage === 'undefined') return base
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fromLegacy() ?? base
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return base
    const row = parsed as {
      bpm?: unknown
      mode?: unknown
      clickSound?: unknown
      bars?: unknown
      barIndex?: unknown
      presetId?: unknown
    }
    const bars = Array.isArray(row.bars)
      ? row.bars.map(parseBar).filter((item): item is RhythmBar => item !== null)
      : []
    const safeBars = (bars.length > 0 ? bars : base.bars).slice(0, MAX_BARS).map(cloneBar)
    const barIndex = Number.isInteger(row.barIndex)
      ? Math.min(safeBars.length - 1, Math.max(0, Number(row.barIndex)))
      : 0
    return {
      bpm: clampBpm(typeof row.bpm === 'number' ? row.bpm : base.bpm),
      mode: row.mode === 'drums' ? 'drums' : 'click',
      clickSound: isClickSound(row.clickSound) ? row.clickSound : 'woodblock',
      bars: safeBars,
      barIndex,
      presetId: typeof row.presetId === 'string' ? row.presetId : null,
    }
  } catch {
    return base
  }
}

export function saveRhythmPrefs(prefs: RhythmPrefs): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      bpm: clampBpm(prefs.bpm),
      mode: prefs.mode,
      clickSound: prefs.clickSound,
      bars: prefs.bars.map(cloneBar),
      barIndex: prefs.barIndex,
      presetId: prefs.presetId,
    }),
  )
}
