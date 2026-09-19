const STORAGE_KEY = 'omnician.custom-presets.v1'
const PREFS_KEY = 'omnician.tuner-prefs.v1'

export type CustomTuning = {
  id: string
  name: string
  midis: number[]
}

export type TunerPrefs = {
  presetId: string
  sensitivity: 'low' | 'medium' | 'high'
}

const MIN_MIDI = 12
const MAX_MIDI = 96

function isMidi(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_MIDI &&
    value <= MAX_MIDI
  )
}

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
    sensitivity: 'medium',
  }
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return fallback
    const row = parsed as { presetId?: unknown; sensitivity?: unknown }
    const sensitivity =
      row.sensitivity === 'low' ||
      row.sensitivity === 'medium' ||
      row.sensitivity === 'high'
        ? row.sensitivity
        : fallback.sensitivity
    return {
      presetId:
        typeof row.presetId === 'string' && row.presetId
          ? row.presetId
          : fallback.presetId,
      sensitivity,
    }
  } catch {
    return fallback
  }
}

export function saveTunerPrefs(prefs: TunerPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}
