import { KIT_MIX_UNITY_POS } from '@/lib/kit-mix'
import { stepsPerBeat, type HitPos, type SubdivisionId } from '@/lib/rhythm'
import type { RhythmStyleId } from '@/lib/rhythm-presets'

/** CrocellKit velocity layers (softest t1 → hardest t5). */
export const CROCELL_TIERS = [1, 2, 3, 4, 5] as const
export type CrocellTier = (typeof CROCELL_TIERS)[number]

/** Playing dynamics. Same notes at every level — how hard they are struck. */
export const KIT_INTENSITIES = ['low', 'mid', 'high'] as const
export type KitIntensity = (typeof KIT_INTENSITIES)[number]
export const DEFAULT_KIT_INTENSITY: KitIntensity = 'high'
export const DEFAULT_INTENSITY_STYLE: RhythmStyleId = 'rock'

export const INTENSITY_LABELS: Record<KitIntensity, string> = {
  low: 'Low',
  mid: 'Mid',
  high: 'High',
}

/** Cap positions on the shared kit throw. Mid sits on the 0.0 line. */
export const INTENSITY_POS: Record<KitIntensity, number> = {
  low: 0.28,
  mid: KIT_MIX_UNITY_POS,
  high: 1,
}

export const INTENSITY_POS_LIST = KIT_INTENSITIES.map((level) => INTENSITY_POS[level])

export type HitRole = 'backbeat' | 'ghost' | 'normal'

export type IntensityDynamics = {
  mark: KitIntensity
  /** Crocell layer for kicks, snares, toms, crashes. */
  accentTier: CrocellTier
  ghostTier: CrocellTier
  hatTier: CrocellTier
  accentVel: number
  ghostVel: number
  hatVel: number
  normalVel: number
  /**
   * Compensates Crocell layer loudness so Low / Mid / High stay within
   * about 5% of each other. Feel comes from the velocity layer, not fader gain.
   */
  gain: number
}

const DYNAMICS: Record<KitIntensity, IntensityDynamics> = {
  low: {
    mark: 'low',
    accentTier: 1,
    ghostTier: 1,
    hatTier: 1,
    accentVel: 0.88,
    ghostVel: 0.48,
    hatVel: 0.72,
    normalVel: 0.82,
    gain: 1.655,
  },
  mid: {
    mark: 'mid',
    accentTier: 3,
    ghostTier: 2,
    hatTier: 3,
    accentVel: 0.92,
    ghostVel: 0.5,
    hatVel: 0.78,
    normalVel: 0.86,
    gain: 1,
  },
  high: {
    mark: 'high',
    accentTier: 5,
    ghostTier: 3,
    hatTier: 5,
    accentVel: 0.96,
    ghostVel: 0.52,
    hatVel: 0.84,
    normalVel: 0.9,
    gain: 0.704,
  },
}

const STYLE_DEFAULT_INTENSITY: Record<RhythmStyleId, KitIntensity> = {
  rock: 'high',
  metal: 'high',
  odd: 'high',
  funk: 'mid',
  pop: 'mid',
  hiphop: 'mid',
  house: 'mid',
  latin: 'mid',
  shuffle: 'mid',
  jazz: 'low',
  waltz: 'low',
}

export function dynamicsFor(intensity: KitIntensity): IntensityDynamics {
  return DYNAMICS[intensity] ?? DYNAMICS[DEFAULT_KIT_INTENSITY]
}

export function intensityLabel(value: KitIntensity): string {
  return INTENSITY_LABELS[value] ?? INTENSITY_LABELS[DEFAULT_KIT_INTENSITY]
}

export function isKitIntensity(value: unknown): value is KitIntensity {
  return value === 'low' || value === 'mid' || value === 'high'
}

export function defaultIntensityForStyle(styleId: RhythmStyleId | null | undefined): KitIntensity {
  if (!styleId) return DEFAULT_KIT_INTENSITY
  return STYLE_DEFAULT_INTENSITY[styleId] ?? DEFAULT_KIT_INTENSITY
}

export function intensityFromPos(pos: number): KitIntensity {
  const p = Math.min(1, Math.max(0, pos))
  let best: KitIntensity = DEFAULT_KIT_INTENSITY
  let bestDist = Number.POSITIVE_INFINITY
  for (const level of KIT_INTENSITIES) {
    const dist = Math.abs(INTENSITY_POS[level] - p)
    if (dist < bestDist) {
      best = level
      bestDist = dist
    }
  }
  return best
}

export function stepKitIntensity(value: KitIntensity, delta: number): KitIntensity {
  const index = KIT_INTENSITIES.indexOf(value)
  const next = Math.min(KIT_INTENSITIES.length - 1, Math.max(0, index + delta))
  return KIT_INTENSITIES[next] ?? value
}

/**
 * Keep Low / Mid / High. Old pp / p / f / ff and 1–5 fall back to the
 * style default so each beat family opens on its own intensity.
 */
export function clampKitIntensity(
  value: unknown,
  styleId?: RhythmStyleId | null,
): KitIntensity {
  if (isKitIntensity(value)) return value
  return defaultIntensityForStyle(styleId)
}

/** @deprecated Use defaultIntensityForStyle + clampKitIntensity. */
export function clampStyleIntensity(
  styleId: RhythmStyleId | null | undefined,
  value: unknown,
): KitIntensity {
  return clampKitIntensity(value, styleId)
}

export function snareHitRole(hit: Pick<HitPos, 'beat' | 'num'>): HitRole {
  if (hit.num === 0 && hit.beat % 2 === 1) return 'backbeat'
  if (hit.num !== 0) return 'ghost'
  return 'normal'
}

export function snareRoleFromStep(step: number, subdivision: SubdivisionId): HitRole {
  const steps = stepsPerBeat(subdivision)
  const beat = Math.floor(step / steps)
  const slot = step % steps
  return snareHitRole({ beat, num: slot })
}

export function resolveTier(intensity: KitIntensity, role: HitRole): CrocellTier {
  const dyn = dynamicsFor(intensity)
  return role === 'ghost' ? dyn.ghostTier : dyn.accentTier
}

export function playOptsForRole(
  intensity: KitIntensity,
  role: HitRole,
): { tier: CrocellTier; rimshot: false; vel: number } {
  const dyn = dynamicsFor(intensity)
  if (role === 'ghost') {
    return { tier: dyn.ghostTier, rimshot: false, vel: dyn.ghostVel * dyn.gain }
  }
  if (role === 'backbeat') {
    return { tier: dyn.accentTier, rimshot: false, vel: dyn.accentVel * dyn.gain }
  }
  return { tier: dyn.accentTier, rimshot: false, vel: dyn.normalVel * dyn.gain }
}
