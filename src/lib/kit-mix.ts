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
export const DEFAULT_KIT_MIX: KitMix = {
  kick: 0,
  snare: 0,
  cymbals: -4.5,
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

/** Slider 0–1: center is 0 dB, more travel down to −48, headroom up to +6. */
export function mixPosToDb(pos: number): number {
  const p = Math.min(1, Math.max(0, pos))
  if (p <= 0.5) return KIT_MIX_MIN_DB + (0 - KIT_MIX_MIN_DB) * (p / 0.5)
  return KIT_MIX_MAX_DB * ((p - 0.5) / 0.5)
}

export function mixDbToPos(db: number): number {
  const d = clampKitDb(db)
  if (d <= 0) return 0.5 * ((d - KIT_MIX_MIN_DB) / (0 - KIT_MIX_MIN_DB))
  return 0.5 + 0.5 * (d / KIT_MIX_MAX_DB)
}

export function formatKitDb(db: number): string {
  if (Math.abs(db) < 0.25) return '0'
  const rounded = Math.round(db * 2) / 2
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

export function parseKitMix(raw: unknown): KitMix {
  const row = raw && typeof raw === 'object' ? (raw as Partial<Record<KitGroupId, unknown>>) : {}
  return {
    kick: clampKitDb(typeof row.kick === 'number' ? row.kick : DEFAULT_KIT_MIX.kick, DEFAULT_KIT_MIX.kick),
    snare: clampKitDb(typeof row.snare === 'number' ? row.snare : DEFAULT_KIT_MIX.snare, DEFAULT_KIT_MIX.snare),
    cymbals: clampKitDb(
      typeof row.cymbals === 'number' ? row.cymbals : DEFAULT_KIT_MIX.cymbals,
      DEFAULT_KIT_MIX.cymbals,
    ),
    toms: clampKitDb(typeof row.toms === 'number' ? row.toms : DEFAULT_KIT_MIX.toms, DEFAULT_KIT_MIX.toms),
  }
}
