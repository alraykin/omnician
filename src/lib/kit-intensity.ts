import { stepsPerBeat, type HitPos, type SubdivisionId } from '@/lib/rhythm'
import type { RhythmStyleId } from '@/lib/rhythm-presets'

/** CrocellKit velocity layers (softest t1 → hardest t5). */
export const CROCELL_TIERS = [1, 2, 3, 4, 5] as const
export type CrocellTier = (typeof CROCELL_TIERS)[number]

/** Playing dynamics. Same notes at every level — only how hard they are struck. */
export const KIT_INTENSITIES = ['pp', 'p', 'f', 'ff'] as const
export type KitIntensity = (typeof KIT_INTENSITIES)[number]
export const DEFAULT_KIT_INTENSITY: KitIntensity = 'f'
export const DEFAULT_INTENSITY_STYLE: RhythmStyleId = 'rock'

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
  /** Extra level so softer layers also play quieter, harder layers louder. */
  gain: number
}

const DYNAMICS: Record<KitIntensity, IntensityDynamics> = {
  pp: {
    mark: 'pp',
    accentTier: 1,
    ghostTier: 1,
    hatTier: 1,
    accentVel: 0.55,
    ghostVel: 0.36,
    hatVel: 0.48,
    normalVel: 0.5,
    gain: 0.62,
  },
  p: {
    mark: 'p',
    accentTier: 2,
    ghostTier: 1,
    hatTier: 2,
    accentVel: 0.7,
    ghostVel: 0.42,
    hatVel: 0.62,
    normalVel: 0.66,
    gain: 0.82,
  },
  f: {
    mark: 'f',
    accentTier: 4,
    ghostTier: 2,
    hatTier: 4,
    accentVel: 0.92,
    ghostVel: 0.5,
    hatVel: 0.8,
    normalVel: 0.86,
    gain: 1,
  },
  ff: {
    mark: 'ff',
    accentTier: 5,
    ghostTier: 3,
    hatTier: 5,
    accentVel: 1,
    ghostVel: 0.58,
    hatVel: 0.92,
    normalVel: 0.96,
    gain: 1.18,
  },
}

export function dynamicsFor(intensity: KitIntensity): IntensityDynamics {
  return DYNAMICS[intensity] ?? DYNAMICS[DEFAULT_KIT_INTENSITY]
}

export function intensityLabel(value: KitIntensity): string {
  return dynamicsFor(value).mark
}

/**
 * Accept saved marks, or old 1–5 character numbers:
 * 1 Light → pp, 2 Pocket → p, 3 Driving → f, 4 Full (old default) → f, 5 Stadium → ff.
 */
export function clampKitIntensity(value: unknown): KitIntensity {
  if (value === 'pp' || value === 'p' || value === 'f' || value === 'ff') return value
  if (typeof value === 'string' && value.trim() !== '') {
    const asNumber = Number(value)
    if (Number.isFinite(asNumber)) return clampKitIntensity(asNumber)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.round(value)
    if (rounded <= 1) return 'pp'
    if (rounded === 2) return 'p'
    if (rounded === 3 || rounded === 4) return 'f'
    return 'ff'
  }
  return DEFAULT_KIT_INTENSITY
}

/** @deprecated Intensity is no longer per-style. */
export function clampStyleIntensity(
  _styleId: RhythmStyleId | null | undefined,
  value: unknown,
): KitIntensity {
  return clampKitIntensity(value)
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
