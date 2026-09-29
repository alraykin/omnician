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

/** Cap positions: Low at the bottom, Mid at center, High at the top. */
export const INTENSITY_POS: Record<KitIntensity, number> = {
  low: 0,
  mid: 0.5,
  high: 1,
}

export const INTENSITY_POS_LIST = KIT_INTENSITIES.map((level) => INTENSITY_POS[level])

/**
 * Hit strength vs High. High is the reference (1.0). Mid is 15% less,
 * Low is 15% less than Mid (0.85 × 0.85 = 0.7225 ≈ 0.72).
 */
export const INTENSITY_STRENGTH: Record<KitIntensity, number> = {
  high: 1,
  mid: 0.85,
  low: 0.72,
}

/** High playback gain before Mid/Low loudness compensation. Do not change. */
export const HIGH_INTENSITY_GAIN = 0.7

/**
 * Extra gain so Mid / Low match High RMS within ~0.5 dB after
 * velocity-layer blending. High stays 1. Measured from rendered Crocell output.
 */
export const INTENSITY_LOUDNESS_COMP: Record<KitIntensity, number> = {
  high: 1,
  mid: 1.818,
  low: 2.923,
}

export type HitRole = 'backbeat' | 'ghost' | 'normal'

export type LayerBlend = {
  tier: CrocellTier
  blendTier?: CrocellTier
  blendMix: number
}

export type IntensityDynamics = {
  mark: KitIntensity
  strength: number
  /** High's Crocell layers — Mid/Low scale these instead of jumping to t1. */
  accentTier: CrocellTier
  ghostTier: CrocellTier
  hatTier: CrocellTier
  accentVel: number
  ghostVel: number
  hatVel: number
  normalVel: number
  /** High's 0.7, times strength, times measured Mid/Low compensation. */
  gain: number
}

const HIGH_VEL = {
  accentVel: 0.92,
  ghostVel: 0.5,
  hatVel: 0.78,
  normalVel: 0.86,
} as const

const HIGH_LAYERS = {
  accentTier: 5 as CrocellTier,
  ghostTier: 3 as CrocellTier,
  hatTier: 5 as CrocellTier,
}

function dynamicsAt(mark: KitIntensity): IntensityDynamics {
  const strength = INTENSITY_STRENGTH[mark]
  return {
    mark,
    strength,
    ...HIGH_LAYERS,
    ...HIGH_VEL,
    gain: HIGH_INTENSITY_GAIN * strength * INTENSITY_LOUDNESS_COMP[mark],
  }
}

const DYNAMICS: Record<KitIntensity, IntensityDynamics> = {
  low: dynamicsAt('low'),
  mid: dynamicsAt('mid'),
  high: dynamicsAt('high'),
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

/** Map High's layer × strength onto Crocell t1–t5, blending neighbors. */
export function scaleLayer(refTier: CrocellTier, strength: number): LayerBlend {
  if (strength >= 0.999) return { tier: refTier, blendMix: 0 }
  const continuous = 1 + (refTier - 1) * Math.min(1, Math.max(0, strength))
  const lo = Math.min(5, Math.max(1, Math.floor(continuous))) as CrocellTier
  const hi = Math.min(5, Math.max(1, Math.ceil(continuous))) as CrocellTier
  if (lo === hi) return { tier: lo, blendMix: 0 }
  return { tier: lo, blendTier: hi, blendMix: continuous - lo }
}

export function layerBlendFor(
  intensity: KitIntensity,
  role: HitRole,
  kind: 'accent' | 'ghost' | 'hat' = role === 'ghost' ? 'ghost' : 'accent',
): LayerBlend {
  const dyn = dynamicsFor(intensity)
  const ref = kind === 'ghost' ? dyn.ghostTier : kind === 'hat' ? dyn.hatTier : dyn.accentTier
  return scaleLayer(ref, dyn.strength)
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
  return layerBlendFor(intensity, role).tier
}

export function playOptsForRole(
  intensity: KitIntensity,
  role: HitRole,
): { tier: CrocellTier; blendTier?: CrocellTier; blendMix: number; rimshot: false; vel: number } {
  const dyn = dynamicsFor(intensity)
  const kind = role === 'ghost' ? 'ghost' : 'accent'
  const blend = layerBlendFor(intensity, role, kind)
  const vel =
    role === 'ghost' ? dyn.ghostVel * dyn.gain : role === 'backbeat' ? dyn.accentVel * dyn.gain : dyn.normalVel * dyn.gain
  return { ...blend, rimshot: false, vel }
}
