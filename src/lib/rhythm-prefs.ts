import {
  DEFAULT_BPM,
  DEFAULT_CLICK_SOUND,
  MAX_BARS,
  VOICES,
  clampBeats,
  clampBpm,
  cloneBar,
  emptyPattern,
  isBeatUnit,
  makeBar,
  normalizeClickSound,
  normalizeSubdivision,
  parseBeatAccents,
  parseSubdivAccents,
  reduceHit,
  stepsPerBeat,
  type BeatUnit,
  type ClickSoundId,
  type Pattern,
  type RhythmBar,
  type RhythmMode,
  type SubdivisionId,
  type VoiceId,
} from '@/lib/rhythm'
import { DEFAULT_KIT_MIX, parseKitMix, type KitMix } from '@/lib/kit-mix'
import { makeDefaultClickBars, makeDefaultRockBars } from '@/lib/rhythm-presets'

const STORAGE_KEY = 'omnician.rhythm.v11'
const PREVIOUS_KEYS = [
  'omnician.rhythm.v10',
  'omnician.rhythm.v9',
  'omnician.rhythm.v8',
  'omnician.rhythm.v7',
  'omnician.rhythm.v6',
  'omnician.rhythm.v5',
  'omnician.rhythm.v4',
  'omnician.rhythm.v3',
]

export type RhythmPrefs = {
  bpm: number
  mode: RhythmMode
  clickSound: ClickSoundId
  clickBars: RhythmBar[]
  drumBars: RhythmBar[]
  clickBarIndex: number
  drumBarIndex: number
  presetId: string | null
  kitMix: KitMix
}

function fallback(): RhythmPrefs {
  return {
    bpm: DEFAULT_BPM,
    mode: 'drums',
    clickSound: DEFAULT_CLICK_SOUND,
    clickBars: makeDefaultClickBars(),
    drumBars: makeDefaultRockBars(),
    clickBarIndex: 0,
    drumBarIndex: 0,
    presetId: 'rock-44',
    kitMix: { ...DEFAULT_KIT_MIX },
  }
}

function isBoolRow(value: unknown): value is boolean[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'boolean')
}

function isHitRow(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        Number.isInteger((item as { beat?: unknown }).beat) &&
        Number.isInteger((item as { num?: unknown }).num) &&
        Number.isInteger((item as { den?: unknown }).den),
    )
  )
}

function parsePattern(raw: unknown, beats: number, subdivision: SubdivisionId): Pattern {
  const empty = emptyPattern()
  if (!raw || typeof raw !== 'object') return empty
  const row = raw as Partial<Record<VoiceId, unknown>>
  const steps = stepsPerBeat(subdivision)
  for (const voice of VOICES) {
    const items = row[voice]
    if (isHitRow(items)) {
      for (const item of items as { beat: number; num: number; den: number }[]) {
        if (item.den > 0 && item.beat >= 0 && item.beat < beats) {
          empty[voice].push(reduceHit(item.beat, item.num, item.den))
        }
      }
      continue
    }
    if (!isBoolRow(items)) continue
    items.forEach((on, step) => {
      if (!on) return
      const beat = Math.floor(step / steps)
      const slot = step % steps
      if (beat >= 0 && beat < beats && slot >= 0 && slot < steps) {
        empty[voice].push(reduceHit(beat, slot, steps))
      }
    })
  }
  return empty
}

function parseBar(raw: unknown, fallbackSub: SubdivisionId): RhythmBar | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as {
    beats?: unknown
    beatUnit?: unknown
    subdivision?: unknown
    beatAccents?: unknown
    subdivAccents?: unknown
    accents?: unknown
    pattern?: unknown
  }
  const beats = clampBeats(typeof row.beats === 'number' ? row.beats : 4)
  const beatUnit: BeatUnit = isBeatUnit(row.beatUnit) ? row.beatUnit : 4
  const subdivision = normalizeSubdivision(row.subdivision ?? fallbackSub)
  const beatAccents = parseBeatAccents(row.beatAccents ?? row.accents, beats, beatUnit)
  const subdivAccents = parseSubdivAccents(row.subdivAccents)
  return makeBar(
    beats,
    beatUnit,
    subdivision,
    parsePattern(row.pattern, beats, subdivision),
    beatAccents,
    subdivAccents,
  )
}

function syncSubdivision(bars: RhythmBar[]): RhythmBar[] {
  const sub = bars[0]?.subdivision ?? 2
  return bars.map((bar) => ({ ...bar, subdivision: sub }))
}

function parseBars(raw: unknown, fallbackBars: RhythmBar[]): RhythmBar[] {
  const firstSub = Array.isArray(raw)
    ? normalizeSubdivision((raw[0] as { subdivision?: unknown } | undefined)?.subdivision)
    : 2
  const bars = Array.isArray(raw)
    ? raw.map((item) => parseBar(item, firstSub)).filter((item): item is RhythmBar => item !== null)
    : []
  return syncSubdivision((bars.length > 0 ? bars : fallbackBars).slice(0, MAX_BARS).map(cloneBar))
}

function clampIndex(index: unknown, length: number): number {
  if (!Number.isInteger(index)) return 0
  return Math.min(length - 1, Math.max(0, Number(index)))
}

export function loadRhythmPrefs(): RhythmPrefs {
  const base = fallback()
  if (typeof localStorage === 'undefined') return base
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      PREVIOUS_KEYS.map((key) => localStorage.getItem(key)).find((item) => item != null)
    if (!raw) return base
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return base
    const row = parsed as {
      bpm?: unknown
      mode?: unknown
      clickSound?: unknown
      bars?: unknown
      clickBars?: unknown
      drumBars?: unknown
      barIndex?: unknown
      clickBarIndex?: unknown
      drumBarIndex?: unknown
      presetId?: unknown
      kitMix?: unknown
    }

    const split = Array.isArray(row.clickBars) || Array.isArray(row.drumBars)
    const clickBars = split ? parseBars(row.clickBars, base.clickBars) : makeDefaultClickBars()
    const drumBars = split
      ? parseBars(row.drumBars, base.drumBars)
      : parseBars(row.bars, base.drumBars)

    const clickBarIndex = split
      ? clampIndex(row.clickBarIndex, clickBars.length)
      : 0
    const drumBarIndex = split
      ? clampIndex(row.drumBarIndex, drumBars.length)
      : clampIndex(row.barIndex, drumBars.length)

    return {
      bpm: clampBpm(typeof row.bpm === 'number' ? row.bpm : base.bpm),
      mode: row.mode === 'drums' ? 'drums' : row.mode === 'click' ? 'click' : base.mode,
      clickSound: normalizeClickSound(row.clickSound),
      clickBars,
      drumBars,
      clickBarIndex,
      drumBarIndex,
      presetId: typeof row.presetId === 'string' ? row.presetId : null,
      kitMix: parseKitMix(row.kitMix),
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
      clickBars: prefs.clickBars.map(cloneBar),
      drumBars: prefs.drumBars.map(cloneBar),
      clickBarIndex: prefs.clickBarIndex,
      drumBarIndex: prefs.drumBarIndex,
      presetId: prefs.presetId,
      kitMix: parseKitMix(prefs.kitMix),
    }),
  )
}
