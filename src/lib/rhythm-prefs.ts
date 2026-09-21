import {
  DEFAULT_BPM,
  METERS,
  VOICES,
  clampBpm,
  clonePattern,
  defaultAccents,
  emptyPattern,
  isMeterId,
  resizeHits,
  resizePattern,
  stepsPerBar,
  type MeterId,
  type Pattern,
  type RhythmMode,
  type VoiceId,
} from '@/lib/rhythm'
import { defaultPreset, findPreset } from '@/lib/rhythm-presets'

const STORAGE_KEY = 'omnician.rhythm.v1'

export type RhythmPrefs = {
  bpm: number
  meterId: MeterId
  mode: RhythmMode
  accents: number[]
  pattern: Pattern
  presetId: string | null
}

function fallback(): RhythmPrefs {
  const preset = defaultPreset('4/4')
  return {
    bpm: DEFAULT_BPM,
    meterId: '4/4',
    mode: 'click',
    accents: defaultAccents('4/4'),
    pattern: clonePattern(preset.pattern),
    presetId: preset.id,
  }
}

function isVoiceRow(value: unknown, length: number): value is boolean[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'boolean') &&
    resizeHits(value, length).length === length
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
      meterId?: unknown
      mode?: unknown
      accents?: unknown
      pattern?: unknown
      presetId?: unknown
    }
    const meterId = isMeterId(row.meterId) ? row.meterId : base.meterId
    const meter = METERS[meterId]
    const length = stepsPerBar(meter)
    const mode: RhythmMode = row.mode === 'drums' ? 'drums' : 'click'
    const accents = Array.isArray(row.accents)
      ? row.accents
          .filter((item): item is number => Number.isInteger(item) && item >= 0 && item < meter.beats)
          .slice(0, meter.beats)
      : defaultAccents(meterId)
    const saved =
      row.pattern && typeof row.pattern === 'object'
        ? (row.pattern as Partial<Record<VoiceId, unknown>>)
        : null
    const pattern = emptyPattern(meter)
    if (saved) {
      for (const voice of VOICES) {
        if (isVoiceRow(saved[voice], length)) {
          pattern[voice] = resizeHits(saved[voice], length)
        }
      }
    } else {
      return {
        bpm: clampBpm(typeof row.bpm === 'number' ? row.bpm : base.bpm),
        meterId,
        mode,
        accents: accents.length > 0 ? accents : defaultAccents(meterId),
        pattern: clonePattern(defaultPreset(meterId).pattern),
        presetId: defaultPreset(meterId).id,
      }
    }
    const presetId = typeof row.presetId === 'string' ? row.presetId : null
    const known = presetId ? findPreset(presetId) : null
    return {
      bpm: clampBpm(typeof row.bpm === 'number' ? row.bpm : base.bpm),
      meterId,
      mode,
      accents: accents.length > 0 ? accents : defaultAccents(meterId),
      pattern: resizePattern(pattern, meter),
      presetId: known && known.meterId === meterId ? known.id : null,
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
      meterId: prefs.meterId,
      mode: prefs.mode,
      accents: prefs.accents,
      pattern: prefs.pattern,
      presetId: prefs.presetId,
    }),
  )
}
