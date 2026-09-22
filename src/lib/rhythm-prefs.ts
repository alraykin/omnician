import {
  DEFAULT_BPM,
  DEFAULT_CLICK_SOUND,
  MAX_BARS,
  VOICES,
  clampAccents,
  clampBeats,
  clampBpm,
  cloneBar,
  emptyPattern,
  isBeatUnit,
  isClickSound,
  makeBar,
  normalizeSubdivision,
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
import { makeDefaultRockBars } from '@/lib/rhythm-presets'

const STORAGE_KEY = 'omnician.rhythm.v5'
const PREVIOUS_KEYS = ['omnician.rhythm.v4', 'omnician.rhythm.v3']

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
    clickSound: DEFAULT_CLICK_SOUND,
    bars: makeDefaultRockBars(),
    barIndex: 0,
    presetId: 'rock-44',
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
    accents?: unknown
    pattern?: unknown
  }
  const beats = clampBeats(typeof row.beats === 'number' ? row.beats : 4)
  const beatUnit: BeatUnit = isBeatUnit(row.beatUnit) ? row.beatUnit : 4
  const subdivision = normalizeSubdivision(row.subdivision ?? fallbackSub)
  const accents = Array.isArray(row.accents)
    ? clampAccents(
        row.accents.filter((item): item is number => Number.isInteger(item)),
        beats,
      )
    : undefined
  return makeBar(beats, beatUnit, subdivision, parsePattern(row.pattern, beats, subdivision), accents)
}

function syncSubdivision(bars: RhythmBar[]): RhythmBar[] {
  const sub = bars[0]?.subdivision ?? 2
  return bars.map((bar) => ({ ...bar, subdivision: sub }))
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
      barIndex?: unknown
      presetId?: unknown
    }
    const firstSub = Array.isArray(row.bars)
      ? normalizeSubdivision((row.bars[0] as { subdivision?: unknown } | undefined)?.subdivision)
      : 2
    const bars = Array.isArray(row.bars)
      ? row.bars.map((item) => parseBar(item, firstSub)).filter((item): item is RhythmBar => item !== null)
      : []
    const safeBars = syncSubdivision((bars.length > 0 ? bars : base.bars).slice(0, MAX_BARS).map(cloneBar))
    const barIndex = Number.isInteger(row.barIndex)
      ? Math.min(safeBars.length - 1, Math.max(0, Number(row.barIndex)))
      : 0
    return {
      bpm: clampBpm(typeof row.bpm === 'number' ? row.bpm : base.bpm),
      mode: row.mode === 'drums' ? 'drums' : row.mode === 'click' ? 'click' : base.mode,
      clickSound: isClickSound(row.clickSound) ? row.clickSound : DEFAULT_CLICK_SOUND,
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
