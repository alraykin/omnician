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
import { makeDefaultRockBars } from '@/lib/rhythm-presets'

const STORAGE_KEY = 'omnician.rhythm.v3'

export type RhythmPrefs = {
  bpm: number
  mode: RhythmMode
  clickSound: ClickSoundId
  bars: RhythmBar[]
  barIndex: number
  presetId: string | null
}

function fallback(): RhythmPrefs {
  return {
    bpm: DEFAULT_BPM,
    mode: 'drums',
    clickSound: 'woodblock',
    bars: makeDefaultRockBars(),
    barIndex: 0,
    presetId: 'rock-44',
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
    : 'eighths'
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

export function loadRhythmPrefs(): RhythmPrefs {
  const base = fallback()
  if (typeof localStorage === 'undefined') return base
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
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
      mode: row.mode === 'drums' ? 'drums' : row.mode === 'click' ? 'click' : base.mode,
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
