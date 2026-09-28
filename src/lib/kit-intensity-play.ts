import {
  characterFor,
  snareHitRole,
  styleIntensityProfile,
  type HitRole,
  type IntensityCharacter,
  type KitIntensity,
} from '@/lib/kit-intensity'
import {
  VOICES,
  clonePattern,
  dedupeHits,
  reduceHit,
  sameHit,
  stepsPerBeat,
  type HitPos,
  type Pattern,
  type RhythmBar,
  type VoiceId,
} from '@/lib/rhythm'
import type { RhythmStyleId } from '@/lib/rhythm-presets'

export type RealizedHit = {
  voice: VoiceId
  hit: HitPos
  role: HitRole
  tier: KitIntensity
  vel: number
  rimshot: boolean
}

const TOM_VOICES: VoiceId[] = ['highTom', 'midTom', 'floorTom']
const CYMBAL_VOICES: VoiceId[] = ['crash', 'china', 'splash']
const HAT_VOICES: VoiceId[] = ['closedHat', 'openHat']

/** Relative amplitude of Crocell velocity layers (t1…t5). */
export const TIER_AMP: Record<KitIntensity, number> = {
  1: 0.42,
  2: 0.55,
  3: 0.7,
  4: 0.86,
  5: 1,
}

/**
 * Perceptual weights (K-ish): hats/cymbals punch above their RMS,
 * kick sits a little under so sparse kick-snare grooves don't get over-gained.
 */
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

/**
 * Target mean energy per quarter-note: two kicks + two snares (t4) +
 * eight closed hats (t3) + one open + one crash — a 4/4 rock chorus.
 */
export const TARGET_ENERGY_PER_QUARTER =
  (2 * ampEnergy('kick', 4, 1) +
    2 * ampEnergy('snare', 4, 1) +
    8 * ampEnergy('closedHat', 3, 1) +
    ampEnergy('openHat', 3, 1) +
    ampEnergy('crash', 4, 1)) /
  4

function ampEnergy(voice: VoiceId, tier: KitIntensity, vel: number): number {
  const amp = VOICE_AMP[voice] * TIER_AMP[tier] * vel
  return amp * amp
}

function countToms(pattern: Pattern): number {
  return TOM_VOICES.reduce((sum, voice) => sum + (pattern[voice]?.length ?? 0), 0)
}

export function isFillBar(pattern: Pattern): boolean {
  return countToms(pattern) >= 3
}

function hasHit(pattern: Pattern, voices: readonly VoiceId[], pos: HitPos): boolean {
  return voices.some((voice) => (pattern[voice] ?? []).some((hit) => sameHit(hit, pos)))
}

function addHit(pattern: Pattern, voice: VoiceId, pos: HitPos): void {
  const row = pattern[voice] ?? (pattern[voice] = [])
  if (row.some((hit) => sameHit(hit, pos))) return
  row.push({ ...pos })
}

function removeHit(pattern: Pattern, voice: VoiceId, pos: HitPos): void {
  const row = pattern[voice]
  if (!row) return
  pattern[voice] = row.filter((hit) => !sameHit(hit, pos))
}

function moveVoiceHits(pattern: Pattern, from: VoiceId, to: VoiceId): void {
  for (const hit of pattern[from] ?? []) addHit(pattern, to, hit)
  pattern[from] = []
}

function lastSlot(beats: number, steps: number): HitPos {
  return reduceHit(beats - 1, steps - 1, steps)
}

function isDownbeat(hit: HitPos): boolean {
  return hit.num === 0
}

function isEighthLike(hit: HitPos): boolean {
  if (hit.num === 0) return true
  return hit.num * 2 === hit.den
}

function allSlots(beats: number, steps: number): HitPos[] {
  const out: HitPos[] = []
  for (let beat = 0; beat < beats; beat += 1) {
    for (let slot = 0; slot < steps; slot += 1) {
      out.push(reduceHit(beat, slot, steps))
    }
  }
  return out
}

function applyHats(pattern: Pattern, bar: RhythmBar, ch: IntensityCharacter): void {
  const steps = stepsPerBeat(bar.subdivision)

  if (ch.hatDensity < 0.55) {
    pattern.closedHat = (pattern.closedHat ?? []).filter((hit) =>
      ch.hatDensity < 0.2 ? isDownbeat(hit) : isEighthLike(hit),
    )
  } else if (ch.hatDensity > 1.15 && !isFillBar(pattern)) {
    for (const pos of allSlots(bar.beats, steps)) {
      if (hasHit(pattern, HAT_VOICES, pos)) continue
      const sixteenthOff = !isEighthLike(pos)
      if (sixteenthOff && ch.hatDensity < 1.7) {
        const eSlot = pos.den >= 2 && pos.num * 4 === pos.den
        if (!eSlot) continue
      }
      addHit(pattern, 'closedHat', pos)
    }
  }

  if (ch.hatOpenness <= 0.05) {
    moveVoiceHits(pattern, 'openHat', 'closedHat')
  } else if (ch.hatOpenness < 0.7) {
    const opens = [...(pattern.openHat ?? [])]
    if (opens.length > 1) {
      const keep = opens[opens.length - 1]
      pattern.openHat = keep ? [keep] : []
      for (const hit of opens) {
        if (keep && sameHit(hit, keep)) continue
        addHit(pattern, 'closedHat', hit)
      }
    }
  }

  if (ch.hatOpenness > 1.15 && steps >= 2) {
    for (let beat = 1; beat < bar.beats; beat += 2) {
      const pos = reduceHit(beat, steps - 1, steps)
      if (hasHit(pattern, ['closedHat'], pos) && !hasHit(pattern, ['openHat'], pos)) {
        removeHit(pattern, 'closedHat', pos)
        addHit(pattern, 'openHat', pos)
      } else if (ch.hatOpenness > 1.5 && !hasHit(pattern, HAT_VOICES, pos)) {
        addHit(pattern, 'openHat', pos)
      }
    }
  }
}

function applyGhosts(pattern: Pattern, bar: RhythmBar, ch: IntensityCharacter): void {
  const steps = stepsPerBeat(bar.subdivision)
  if (ch.ghostDensity < 0.55) {
    pattern.snare = (pattern.snare ?? []).filter((hit) => snareHitRole(hit) !== 'ghost' || ch.ghostDensity > 0.25)
    if (ch.ghostDensity < 0.2) {
      pattern.rim = (pattern.rim ?? []).filter((hit) => isDownbeat(hit))
    }
  }
  if (ch.ghostDensity > 1.15 && !isFillBar(pattern) && steps >= 2) {
    for (let beat = 0; beat < bar.beats; beat += 1) {
      if (beat % 2 === 1) continue
      for (const slot of [1, steps - 1]) {
        if (slot <= 0 || slot >= steps) continue
        const pos = reduceHit(beat, slot, steps)
        if (hasHit(pattern, ['snare', 'rim'], pos)) continue
        addHit(pattern, 'snare', pos)
      }
    }
  }
}

function applyKicks(pattern: Pattern, bar: RhythmBar, ch: IntensityCharacter): void {
  const steps = stepsPerBeat(bar.subdivision)
  if (ch.kickDensity < 0.6) {
    pattern.kick = (pattern.kick ?? []).filter((hit) =>
      ch.kickDensity < 0.35 ? isDownbeat(hit) : isEighthLike(hit),
    )
  }
  if (ch.kickDensity > 1.12 && steps >= 2 && !isFillBar(pattern)) {
    for (const snare of pattern.snare ?? []) {
      if (snareHitRole(snare) !== 'backbeat') continue
      const slot = snare.num === 0 ? steps - 1 : null
      const beat = snare.num === 0 ? snare.beat - 1 : snare.beat
      if (slot === null || beat < 0) continue
      const pos = reduceHit(beat, slot, steps)
      if (!hasHit(pattern, ['kick'], pos)) addHit(pattern, 'kick', pos)
    }
  }
}

function applyTimekeeper(pattern: Pattern, bar: RhythmBar, ch: IntensityCharacter): void {
  const steps = stepsPerBeat(bar.subdivision)
  if (ch.timekeeper === 'hats') {
    pattern.ride = []
    pattern.rideBell = []
    return
  }
  if (ch.timekeeper === 'ride') {
    const rideSource = (pattern.ride?.length ? pattern.ride : pattern.closedHat) ?? []
    if (!pattern.ride?.length) {
      pattern.ride = rideSource.filter((hit) => isEighthLike(hit) || isDownbeat(hit)).map((hit) => ({ ...hit }))
    }
    pattern.closedHat = []
    if (ch.hatOpenness < 0.3) pattern.openHat = []
    if (!pattern.ride.length) {
      for (let beat = 0; beat < bar.beats; beat += 1) {
        addHit(pattern, 'ride', reduceHit(beat, 0, steps))
        if (steps >= 2) addHit(pattern, 'ride', reduceHit(beat, Math.floor(steps / 2) || 0, steps))
      }
    }
  }
}

function applyCymbals(pattern: Pattern, bar: RhythmBar, ch: IntensityCharacter): void {
  const steps = stepsPerBeat(bar.subdivision)
  if (ch.cymbalExtra <= 0.05) {
    for (const voice of CYMBAL_VOICES) pattern[voice] = []
    return
  }
  if (ch.cymbalExtra < 0.7) {
    pattern.crash = (pattern.crash ?? []).filter((hit) => hit.beat === 0 && hit.num === 0)
    pattern.china = []
    pattern.splash = []
    return
  }
  if (ch.cymbalExtra > 1.35) {
    for (const crash of pattern.crash ?? []) {
      addHit(pattern, 'china', crash)
    }
    if (!(pattern.crash ?? []).length) {
      addHit(pattern, 'crash', reduceHit(0, 0, steps))
    }
    addHit(pattern, 'splash', lastSlot(bar.beats, steps))
  }
}

function applyFills(pattern: Pattern, ch: IntensityCharacter): void {
  if (!isFillBar(pattern)) return
  if (ch.fillAmount <= 0.05) {
    for (const voice of TOM_VOICES) pattern[voice] = []
    return
  }
  if (ch.fillAmount < 0.7) {
    for (const voice of TOM_VOICES) {
      pattern[voice] = (pattern[voice] ?? []).filter((_, index) => index % 2 === 0)
    }
  }
}

function applySideStick(pattern: Pattern, ch: IntensityCharacter): void {
  if (!ch.sideStickBackbeat) return
  const keep: HitPos[] = []
  for (const hit of pattern.snare ?? []) {
    if (snareHitRole(hit) === 'backbeat') addHit(pattern, 'rim', hit)
    else keep.push(hit)
  }
  pattern.snare = keep
}

function transformPattern(bar: RhythmBar, ch: IntensityCharacter): Pattern {
  const pattern = clonePattern(bar.pattern)
  applyFills(pattern, ch)
  applyHats(pattern, bar, ch)
  applyGhosts(pattern, bar, ch)
  applyKicks(pattern, bar, ch)
  applyTimekeeper(pattern, bar, ch)
  applyCymbals(pattern, bar, ch)
  applySideStick(pattern, ch)
  for (const voice of VOICES) {
    pattern[voice] = dedupeHits(pattern[voice] ?? [])
  }
  return pattern
}

function velFor(voice: VoiceId, role: HitRole, ch: IntensityCharacter, hit: HitPos): number {
  if (voice === 'snare' || voice === 'rim') {
    if (role === 'ghost') return 0.34 + (1 - ch.dynamics) * 0.28
    if (role === 'backbeat') return 0.84 + ch.dynamics * 0.2
    return 0.7
  }
  if (voice === 'kick') {
    return isDownbeat(hit) ? 0.9 + (1 - ch.dynamics) * 0.08 : 0.62 + (1 - ch.dynamics) * 0.2
  }
  if (voice === 'closedHat') {
    return isDownbeat(hit) ? 0.78 : 0.55 + (1 - ch.dynamics) * 0.18
  }
  if (voice === 'openHat') return 0.82
  if (voice === 'ride' || voice === 'rideBell') {
    return isDownbeat(hit) ? 0.85 : 0.62
  }
  if (voice === 'crash' || voice === 'china' || voice === 'splash' || voice === 'stack') return 0.92
  return 0.8
}

function tierFor(voice: VoiceId, role: HitRole, ch: IntensityCharacter): KitIntensity {
  if (role === 'ghost' || voice === 'rim') return ch.ghostTier
  if (voice === 'closedHat' || voice === 'openHat' || voice === 'ride' || voice === 'rideBell') return ch.hatTier
  return ch.accentTier
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

/** Brightness high-shelf makes the kit seem a bit louder; pull gain back ~0.22 per dB. */
export function brightnessLoudnessOffset(brightnessDb: number): number {
  return 10 ** ((-0.22 * brightnessDb) / 20)
}

export function loudnessGainFor(
  hits: readonly RealizedHit[],
  bar: Pick<RhythmBar, 'beats' | 'beatUnit'>,
  brightnessDb: number,
): number {
  const quarters = quartersInBar(bar)
  const energy = estimateBarEnergy(hits) / quarters
  const raw = Math.sqrt(TARGET_ENERGY_PER_QUARTER / Math.max(1e-6, energy))
  const withShelf = raw * brightnessLoudnessOffset(brightnessDb)
  return Math.min(3.1, Math.max(0.38, withShelf))
}

export function realizeDrumBar(
  bar: RhythmBar,
  styleId: RhythmStyleId | null | undefined,
  intensity: KitIntensity,
): { hits: RealizedHit[]; gain: number; character: IntensityCharacter; fill: boolean } {
  const ch = characterFor(styleId, intensity)
  const pattern = transformPattern(bar, ch)
  const fill = isFillBar(bar.pattern)
  const pending: RealizedHit[] = []
  for (const voice of VOICES) {
    for (const hit of pattern[voice] ?? []) {
      if (hit.beat < 0 || hit.beat >= bar.beats) continue
      const role = roleFor(voice, hit)
      pending.push({
        voice,
        hit,
        role,
        tier: tierFor(voice, role, ch),
        vel: velFor(voice, role, ch, hit),
        rimshot: voice === 'snare' && role === 'backbeat' && ch.rimshotBackbeat && !ch.sideStickBackbeat,
      })
    }
  }
  const gain = loudnessGainFor(pending, bar, ch.brightnessDb) * (fill ? 1.06 : 1)
  const hits = pending.map((hit) => ({ ...hit, vel: hit.vel * gain }))
  return { hits, gain, character: ch, fill }
}

export const STYLE_ORDER: RhythmStyleId[] = [
  'rock',
  'funk',
  'metal',
  'pop',
  'hiphop',
  'house',
  'latin',
  'shuffle',
  'jazz',
  'waltz',
  'odd',
]

export function intensityReportRows(): Array<{
  style: RhythmStyleId
  level: KitIntensity
  name: string
  blurb: string
}> {
  const rows: Array<{ style: RhythmStyleId; level: KitIntensity; name: string; blurb: string }> = []
  for (const id of STYLE_ORDER) {
    const profile = styleIntensityProfile(id)
    for (const level of profile.levels) {
      const c = profile.characters[level]
      if (!c) continue
      rows.push({ style: profile.styleId, level, name: c.name, blurb: c.blurb })
    }
  }
  return rows
}
