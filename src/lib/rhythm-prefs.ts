import {
  DEFAULT_BPM,
  DEFAULT_CLICK_SOUND,
  DEFAULT_CLICK_SUBDIVISION,
  MAX_BARS,
  VOICES,
  clampBeats,
  clampBpm,
  cloneBar,
  emptyPattern,
  isBeatUnit,
  makeBar,
  normalizeBeatSubdivisions,
  setBarSubdivision,
  normalizeClickSound,
  normalizeSubdivision,
  parseBeatAccents,
  parseVoiceHits,
  absorbCrashRHits,
  absorbRetiredKitHits,
  type BeatUnit,
  type ClickSoundId,
  type Pattern,
  type RhythmBar,
  type RhythmMode,
  type SubdivisionId,
  type VoiceId,
} from '@/lib/rhythm'
import { DEFAULT_KIT_INTENSITY, clampKitIntensity, type KitIntensity } from '@/lib/kit-intensity'
import {
  DEFAULT_KIT_MIX,
  DEFAULT_MASTER_VOLUME_DB,
  parseKitMix,
  parseMasterVolumeDb,
  type KitMix,
} from '@/lib/kit-mix'
import { DEFAULT_DRUM_INPUT, normalizeDrumInput, type InputDivision } from '@/lib/beat-boxes'
import { barsForPreset, findPreset, makeDefaultClickBars, makeDefaultRockBars, matchPreset } from '@/lib/rhythm-presets'
import { DEFAULT_SPEED_BUILDER, parseSpeedBuilder, type SpeedBuilder } from '@/lib/speed-builder'

const STORAGE_KEY = 'omnician.rhythm.v22'
const PREVIOUS_KEYS = [
  'omnician.rhythm.v21',
  'omnician.rhythm.v20',
  'omnician.rhythm.v19',
  'omnician.rhythm.v18',
  'omnician.rhythm.v17',
  'omnician.rhythm.v16',
  'omnician.rhythm.v15',
  'omnician.rhythm.v14',
  'omnician.rhythm.v13',
  'omnician.rhythm.v12',
  'omnician.rhythm.v11',
  'omnician.rhythm.v10',
  'omnician.rhythm.v9',
  'omnician.rhythm.v8',
  'omnician.rhythm.v7',
  'omnician.rhythm.v6',
  'omnician.rhythm.v5',
  'omnician.rhythm.v4',
  'omnician.rhythm.v3',
]
const CYMBAL_FADE_MIGRATE_KEY = 'omnician.rhythm.v11'

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
  kitIntensity: KitIntensity
  speedBuilder: SpeedBuilder
  volumeDb: number
  userBeatId: string | null
  drumInput: InputDivision
}

function fallback(): RhythmPrefs {
  return {
    bpm: findPreset('rock-44')?.bpm ?? DEFAULT_BPM,
    mode: 'drums',
    clickSound: DEFAULT_CLICK_SOUND,
    clickBars: makeDefaultClickBars(),
    drumBars: makeDefaultRockBars(),
    clickBarIndex: 0,
    drumBarIndex: 0,
    presetId: 'rock-44',
    kitMix: { ...DEFAULT_KIT_MIX },
    kitIntensity: DEFAULT_KIT_INTENSITY,
    speedBuilder: { ...DEFAULT_SPEED_BUILDER },
    volumeDb: DEFAULT_MASTER_VOLUME_DB,
    userBeatId: null,
    drumInput: DEFAULT_DRUM_INPUT,
  }
}

function parsePattern(raw: unknown, beats: number, subdivision: SubdivisionId): Pattern {
  const empty = emptyPattern()
  if (!raw || typeof raw !== 'object') return empty
  const row = raw as Partial<Record<VoiceId, unknown>>
  for (const voice of VOICES) {
    empty[voice] = parseVoiceHits(row[voice], beats, subdivision)
  }
  return absorbRetiredKitHits(raw, absorbCrashRHits(raw, empty, beats, subdivision), beats, subdivision)
}

function parseBar(raw: unknown, fallbackSub: SubdivisionId): RhythmBar | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as {
    beats?: unknown
    beatUnit?: unknown
    subdivision?: unknown
    beatAccents?: unknown
    beatSubdivisions?: unknown
    accents?: unknown
    pattern?: unknown
  }
  const beats = clampBeats(typeof row.beats === 'number' ? row.beats : 4)
  const beatUnit: BeatUnit = isBeatUnit(row.beatUnit) ? row.beatUnit : 4
  const subdivision = normalizeSubdivision(row.subdivision ?? fallbackSub)
  const beatAccents = parseBeatAccents(row.beatAccents ?? row.accents, beats, beatUnit)
  const beatSubdivisions = Array.isArray(row.beatSubdivisions)
    ? normalizeBeatSubdivisions(beats, subdivision, row.beatSubdivisions)
    : undefined
  return makeBar(
    beats,
    beatUnit,
    subdivision,
    parsePattern(row.pattern, beats, subdivision),
    beatAccents,
    beatSubdivisions,
  )
}

/** Old first-open Click was 4/4 eighths. Promote that factory shape to quarters. */
export function migrateClickFactorySubdivision(bars: RhythmBar[]): RhythmBar[] {
  if (bars.length !== 1) return bars
  const bar = bars[0]
  if (!bar) return bars
  if (bar.beats !== 4 || bar.beatUnit !== 4 || bar.subdivision !== 2) return bars
  if (!bar.beatSubdivisions.every((item) => item === 2)) return bars
  return [setBarSubdivision(bar, DEFAULT_CLICK_SUBDIVISION)]
}

function syncSubdivision(bars: RhythmBar[]): RhythmBar[] {
  const sub = bars[0]?.subdivision ?? 2
  return bars.map((bar) => {
    const uniform = bar.beatSubdivisions.every((item) => item === bar.subdivision)
    return {
      ...bar,
      subdivision: sub,
      beatSubdivisions: uniform
        ? normalizeBeatSubdivisions(bar.beats, sub)
        : normalizeBeatSubdivisions(bar.beats, sub, bar.beatSubdivisions),
    }
  })
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
    const currentRaw = localStorage.getItem(STORAGE_KEY)
    const raw =
      currentRaw ?? PREVIOUS_KEYS.map((key) => localStorage.getItem(key)).find((item) => item != null)
    if (!raw) return base
    const migrateCymbals = !currentRaw && Boolean(localStorage.getItem(CYMBAL_FADE_MIGRATE_KEY))
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
      kitIntensity?: unknown
      speedBuilder?: unknown
      volumeDb?: unknown
      userBeatId?: unknown
      drumInput?: unknown
    }

    const split = Array.isArray(row.clickBars) || Array.isArray(row.drumBars)
    const parsedClick = split ? parseBars(row.clickBars, base.clickBars) : makeDefaultClickBars()
    const clickBars = currentRaw ? parsedClick : migrateClickFactorySubdivision(parsedClick)
    const presetId = typeof row.presetId === 'string' ? row.presetId : null
    const libraryPreset = !currentRaw && presetId ? findPreset(presetId) : undefined
    const drumBars = libraryPreset
      ? barsForPreset(libraryPreset).map(cloneBar)
      : split
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
      presetId,
      kitMix: parseKitMix(row.kitMix, migrateCymbals),
      kitIntensity: clampKitIntensity(
        row.kitIntensity,
        (presetId ? findPreset(presetId)?.styleId : null) ?? matchPreset(drumBars[0] ?? base.drumBars[0])?.styleId,
      ),
      speedBuilder: parseSpeedBuilder(row.speedBuilder),
      volumeDb: parseMasterVolumeDb(row.volumeDb),
      userBeatId: typeof row.userBeatId === 'string' && row.userBeatId.length > 0 ? row.userBeatId : null,
      drumInput: normalizeDrumInput(row.drumInput),
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
      kitIntensity: clampKitIntensity(prefs.kitIntensity),
      speedBuilder: parseSpeedBuilder(prefs.speedBuilder),
      volumeDb: parseMasterVolumeDb(prefs.volumeDb),
      userBeatId: prefs.userBeatId,
      drumInput: normalizeDrumInput(prefs.drumInput),
    }),
  )
}

export function patchRhythmPrefs(patch: Partial<RhythmPrefs>): RhythmPrefs {
  const next = { ...loadRhythmPrefs(), ...patch }
  saveRhythmPrefs(next)
  return next
}
