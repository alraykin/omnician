import {
  dynamicsFor,
  snareHitRole,
  type CrocellTier,
  type HitRole,
  type IntensityDynamics,
  type KitIntensity,
} from '@/lib/kit-intensity'
import { VOICES, clonePattern, type HitPos, type RhythmBar, type VoiceId } from '@/lib/rhythm'

export type RealizedHit = {
  voice: VoiceId
  hit: HitPos
  role: HitRole
  tier: CrocellTier
  vel: number
  rimshot: false
}

const TOM_VOICES: VoiceId[] = ['highTom', 'midTom', 'floorTom']

/** Relative amplitude of Crocell velocity layers (t1…t5). */
export const TIER_AMP: Record<CrocellTier, number> = {
  1: 0.42,
  2: 0.55,
  3: 0.7,
  4: 0.86,
  5: 1,
}

export const VOICE_AMP: Record<VoiceId, number> = {
  kick: 1.05,
  snare: 1,
  rim: 0.55,
  highTom: 0.82,
  midTom: 0.8,
  floorTom: 0.84,
  closedHat: 0.28,
  openHat: 0.48,
  ride: 0.34,
  rideBell: 0.4,
  crash: 1.15,
  stack: 0.52,
  splash: 0.46,
  china: 1.08,
}

function ampEnergy(voice: VoiceId, tier: CrocellTier, vel: number): number {
  const amp = VOICE_AMP[voice] * TIER_AMP[tier] * vel
  return amp * amp
}

function countToms(pattern: Record<VoiceId, HitPos[]>): number {
  return TOM_VOICES.reduce((sum, voice) => sum + (pattern[voice]?.length ?? 0), 0)
}

export function isFillBar(pattern: Record<VoiceId, HitPos[]>): boolean {
  return countToms(pattern) >= 3
}

function isDownbeat(hit: HitPos): boolean {
  return hit.num === 0
}

function velFor(voice: VoiceId, role: HitRole, dyn: IntensityDynamics, hit: HitPos): number {
  if (voice === 'snare' || voice === 'rim') {
    if (role === 'ghost') return dyn.ghostVel
    if (role === 'backbeat') return dyn.accentVel
    return dyn.normalVel
  }
  if (voice === 'kick') {
    return isDownbeat(hit) ? dyn.accentVel : dyn.normalVel
  }
  if (voice === 'closedHat' || voice === 'ride' || voice === 'rideBell') {
    return isDownbeat(hit) ? dyn.hatVel : dyn.hatVel * 0.82
  }
  if (voice === 'openHat') return dyn.hatVel
  return dyn.accentVel
}

function tierFor(voice: VoiceId, role: HitRole, dyn: IntensityDynamics): CrocellTier {
  if (role === 'ghost') return dyn.ghostTier
  if (voice === 'closedHat' || voice === 'openHat' || voice === 'ride' || voice === 'rideBell') {
    return dyn.hatTier
  }
  return dyn.accentTier
}

function roleFor(voice: VoiceId, hit: HitPos): HitRole {
  if (voice === 'snare' || voice === 'rim') return snareHitRole(hit)
  return 'normal'
}

export function estimateHitEnergy(hit: RealizedHit): number {
  return ampEnergy(hit.voice, hit.tier, hit.vel)
}

export function estimateBarEnergy(hits: readonly RealizedHit[]): number {
  return hits.reduce((sum, hit) => sum + estimateHitEnergy(hit), 0)
}

export function quartersInBar(bar: Pick<RhythmBar, 'beats' | 'beatUnit'>): number {
  return Math.max(0.25, bar.beats * (4 / bar.beatUnit))
}

/**
 * Play the written groove as-is. Intensity only picks Crocell velocity
 * layers and a matching level — never adds, drops, or swaps notes.
 */
export function realizeDrumBar(
  bar: RhythmBar,
  intensity: KitIntensity,
): { hits: RealizedHit[]; gain: number; dynamics: IntensityDynamics; fill: boolean } {
  const dyn = dynamicsFor(intensity)
  const pattern = clonePattern(bar.pattern)
  const fill = isFillBar(bar.pattern)
  const hits: RealizedHit[] = []
  for (const voice of VOICES) {
    for (const hit of pattern[voice] ?? []) {
      if (hit.beat < 0 || hit.beat >= bar.beats) continue
      const role = roleFor(voice, hit)
      hits.push({
        voice,
        hit,
        role,
        tier: tierFor(voice, role, dyn),
        vel: velFor(voice, role, dyn, hit) * dyn.gain,
        rimshot: false,
      })
    }
  }
  return { hits, gain: dyn.gain, dynamics: dyn, fill }
}
