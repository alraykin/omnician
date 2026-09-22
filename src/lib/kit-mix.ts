export const KIT_GROUPS = ['kick', 'snare', 'cymbals', 'toms'] as const
export type KitGroupId = (typeof KIT_GROUPS)[number]

export const KIT_GROUP_LABELS: Record<KitGroupId, string> = {
  kick: 'Kick',
  snare: 'Snare',
  cymbals: 'Cymbals',
  toms: 'Toms',
}

export type KitMix = Record<KitGroupId, number>

export const KIT_MIX_MIN_DB = -48
export const KIT_MIX_MAX_DB = 6
/** Rest position: 75% up the throw = 0 dB / calibrated default. */
export const KIT_MIX_UNITY_POS = 0.75

export const KIT_SCALE_MARKS: { db: number; label: string }[] = [
  { db: 6, label: '+6' },
  { db: 0, label: '0' },
  { db: -6, label: '−6' },
  { db: -12, label: '−12' },
  { db: -24, label: '−24' },
  { db: -48, label: '∞' },
]

/** Extra gain applied after the fader so 0 on Cymbals stays the quieter default. */
export const KIT_ZERO_OFFSET_DB: KitMix = {
  kick: 0,
  snare: 0,
  cymbals: -4.5,
  toms: 0,
}

export const DEFAULT_KIT_MIX: KitMix = {
  kick: 0,
  snare: 0,
  cymbals: 0,
  toms: 0,
}

export const KIT_VOICE_GROUP: Record<
  'kick' | 'snare' | 'rim' | 'clap' | 'closedHat' | 'openHat' | 'highTom' | 'midTom' | 'floorTom' | 'ride' | 'crash',
  KitGroupId
> = {
  kick: 'kick',
  snare: 'snare',
  rim: 'snare',
  clap: 'snare',
  closedHat: 'cymbals',
  openHat: 'cymbals',
  ride: 'cymbals',
  crash: 'cymbals',
  highTom: 'toms',
  midTom: 'toms',
  floorTom: 'toms',
}

export function clampKitDb(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(KIT_MIX_MAX_DB, Math.max(KIT_MIX_MIN_DB, value))
}

export function dbToGain(db: number): number {
  if (db <= KIT_MIX_MIN_DB) return 0
  return Math.pow(10, db / 20)
}

export function mixFaderToGain(group: KitGroupId, faderDb: number): number {
  if (faderDb <= KIT_MIX_MIN_DB) return 0
  return dbToGain(faderDb + KIT_ZERO_OFFSET_DB[group])
}

/** Slider 0–1: 75% up is 0 dB, more travel down to −48, headroom up to +6. */
export function mixPosToDb(pos: number): number {
  const p = Math.min(1, Math.max(0, pos))
  if (p <= KIT_MIX_UNITY_POS) {
    return KIT_MIX_MIN_DB + (0 - KIT_MIX_MIN_DB) * (p / KIT_MIX_UNITY_POS)
  }
  return KIT_MIX_MAX_DB * ((p - KIT_MIX_UNITY_POS) / (1 - KIT_MIX_UNITY_POS))
}

export function mixDbToPos(db: number): number {
  const d = clampKitDb(db)
  if (d <= 0) return KIT_MIX_UNITY_POS * ((d - KIT_MIX_MIN_DB) / (0 - KIT_MIX_MIN_DB))
  return KIT_MIX_UNITY_POS + (1 - KIT_MIX_UNITY_POS) * (d / KIT_MIX_MAX_DB)
}

export function formatKitDb(db: number): string {
  if (db <= KIT_MIX_MIN_DB + 0.4) return '∞'
  if (Math.abs(db) < 0.25) return '0'
  const rounded = Math.round(db * 2) / 2
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

export function parseKitMix(raw: unknown, migrateActualCymbals = false): KitMix {
  const row = raw && typeof raw === 'object' ? (raw as Partial<Record<KitGroupId, unknown>>) : {}
  const read = (group: KitGroupId): number => {
    const fallback = DEFAULT_KIT_MIX[group]
    if (typeof row[group] !== 'number') return fallback
    let value = row[group]
    if (migrateActualCymbals && group === 'cymbals') {
      value -= KIT_ZERO_OFFSET_DB.cymbals
    }
    return clampKitDb(value, fallback)
  }
  return {
    kick: read('kick'),
    snare: read('snare'),
    cymbals: read('cymbals'),
    toms: read('toms'),
  }
}
