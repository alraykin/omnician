import { stepsPerBeat, type HitPos, type SubdivisionId } from '@/lib/rhythm'

export const KIT_INTENSITIES = [1, 2, 3, 4, 5] as const
export type KitIntensity = (typeof KIT_INTENSITIES)[number]
export const DEFAULT_KIT_INTENSITY: KitIntensity = 4

export type HitRole = 'backbeat' | 'ghost' | 'normal'

export function clampKitIntensity(value: unknown): KitIntensity {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_KIT_INTENSITY
  return Math.min(5, Math.max(1, Math.round(value))) as KitIntensity
}

export function intensityLabel(value: KitIntensity): string {
  if (value === 1) return 'Light'
  if (value === 5) return 'Max'
  return `Level ${value}`
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

export function resolveTier(intensity: KitIntensity, role: HitRole): KitIntensity {
  if (role === 'ghost') return clampKitIntensity(intensity - 2)
  return intensity
}

export function useRimshotBackbeat(intensity: KitIntensity, role: HitRole): boolean {
  return role === 'backbeat' && intensity >= 4
}
