import { A4_HZ } from '@/lib/notes'
import {
  normalizeInstrumentId,
  type InstrumentId,
} from '@/lib/presets'

const STORAGE_KEY = 'omnician.custom-presets.v1'
const PREFS_KEY = 'omnician.tuner-prefs.v1'

export type CustomTuning = {
  id: string
  name: string
  midis: number[]
}

export type TunerPrefs = {
  presetId: string
  instrumentId: InstrumentId
  a4Hz: number
  autoString: boolean
}

const MIN_MIDI = 12
const MAX_MIDI = 96
const MIN_A4 = 415
const MAX_A4 = 466

function isMidi(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_MIDI &&
    value <= MAX_MIDI
  )
}

export function clampA4(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return A4_HZ
  return Math.round(Math.min(MAX_A4, Math.max(MIN_A4, value)))
}

export const A4_RANGE = { min: MIN_A4, max: MAX_A4 } as const

export function loadCustomTunings(): CustomTuning[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as { id?: unknown; name?: unknown; midis?: unknown }
      if (typeof row.id !== 'string' || typeof row.name !== 'string') return []
      if (!Array.isArray(row.midis)) return []
      if (row.midis.length < 4 || row.midis.length > 10) return []
      if (!row.midis.every(isMidi)) return []
      const name = row.name.trim().slice(0, 32)
      if (!name) return []
      return [{ id: row.id, name, midis: row.midis }]
    })
  } catch {
    return []
  }
}

export function saveCustomTunings(tunings: CustomTuning[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tunings))
}

export function createCustomId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function loadTunerPrefs(): TunerPrefs {
  const fallback: TunerPrefs = {
    presetId: 'guitar-6-standard',
    instrumentId: 'guitar-6',
    a4Hz: A4_HZ,
    autoString: true,
  }
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return fallback
    const row = parsed as {
      presetId?: unknown
      instrumentId?: unknown
      a4Hz?: unknown
      autoString?: unknown
    }
    const instrumentId =
      typeof row.instrumentId === 'string'
        ? (normalizeInstrumentId(row.instrumentId) ?? fallback.instrumentId)
        : fallback.instrumentId
    return {
      presetId:
        typeof row.presetId === 'string' && row.presetId
          ? row.presetId
          : fallback.presetId,
      instrumentId,
      a4Hz: clampA4(row.a4Hz),
      autoString: typeof row.autoString === 'boolean' ? row.autoString : fallback.autoString,
    }
  } catch {
    return fallback
  }
}

export function saveTunerPrefs(prefs: TunerPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}
