import {
  MAX_BARS,
  VOICES,
  cloneBar,
  emptyPattern,
  hitFraction,
  patternsEqual,
  reduceHit,
  sameHit,
  setHitPos,
  type HitPos,
  type RhythmBar,
  type VoiceId,
} from '@/lib/rhythm'

export const AUTO_COMPLETE_BARS = MAX_BARS
export const FILL_VARIANT_COUNT = 3

export type FillFeel = 'straight16' | 'triplet' | 'eighth'

export function barHasHits(bar: RhythmBar): boolean {
  return VOICES.some((voice) => (bar.pattern[voice] ?? []).length > 0)
}

/** Bars from the start through the last bar that still has notes. */
export function seedBars(bars: readonly RhythmBar[]): RhythmBar[] {
  let last = -1
  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index]
    if (bar && barHasHits(bar)) last = index
  }
  if (last < 0) return []
  return bars.slice(0, last + 1).map(cloneBar)
}

export function needsOverwriteConfirm(bars: readonly RhythmBar[]): boolean {
  return bars.slice(1).some(barHasHits)
}

function hitDenominators(bars: readonly RhythmBar[]): number[] {
  const dens: number[] = []
  for (const bar of bars) {
    dens.push(bar.subdivision, ...bar.beatSubdivisions)
    for (const voice of VOICES) {
      for (const hit of bar.pattern[voice] ?? []) {
        dens.push(hit.den)
      }
    }
  }
  return dens
}

export function detectFillFeel(bars: readonly RhythmBar[]): FillFeel {
  const dens = hitDenominators(bars)
  if (dens.some((den) => den === 3 || den === 6)) return 'triplet'
  if (dens.some((den) => den === 4)) return 'straight16'
  return 'eighth'
}

function fillSteps(feel: FillFeel): 2 | 3 | 4 {
  if (feel === 'triplet') return 3
  if (feel === 'eighth') return 2
  return 4
}

function withoutCymbals(bar: RhythmBar): RhythmBar {
  const next = cloneBar(bar)
  next.pattern.crash = []
  next.pattern.splash = []
  next.pattern.china = []
  next.pattern.stack = []
  return next
}

function withCrashDownbeat(bar: RhythmBar): RhythmBar {
  const next = cloneBar(bar)
  next.pattern = setHitPos(next.pattern, 'crash', reduceHit(0, 0, 1), true)
  return next
}

function hasHit(bar: RhythmBar, voice: VoiceId, target: HitPos): boolean {
  return (bar.pattern[voice] ?? []).some((hit) => sameHit(hit, target))
}

/** Pickup kick on the & of the last beat, or the last 16th if that slot is taken. */
export function addPickupKick(bar: RhythmBar): RhythmBar {
  const next = cloneBar(bar)
  const lastBeat = next.beats - 1
  const andOf = reduceHit(lastBeat, 1, 2)
  if (!hasHit(next, 'kick', andOf)) {
    next.pattern = setHitPos(next.pattern, 'kick', andOf, true)
    return next
  }
  const late = reduceHit(lastBeat, 3, 4)
  if (!hasHit(next, 'kick', late)) {
    next.pattern = setHitPos(next.pattern, 'kick', late, true)
  }
  return next
}

/** Open hat at the end of the phrase; if & is already open, use the last grid slot. */
export function phraseEndOpenHat(bar: RhythmBar, feel: FillFeel): RhythmBar {
  const next = cloneBar(bar)
  const lastBeat = next.beats - 1
  const steps = fillSteps(feel)
  const andOf = reduceHit(lastBeat, 1, 2)
  const late = reduceHit(lastBeat, steps - 1, steps)
  const target = hasHit(next, 'openHat', andOf) ? late : andOf
  next.pattern = setHitPos(next.pattern, 'openHat', target, true)
  next.pattern = setHitPos(next.pattern, 'closedHat', target, false)
  return next
}

export function varyBar(bar: RhythmBar, index: number, feel: FillFeel): RhythmBar {
  if (index === 0) return cloneBar(bar)
  let next = withoutCymbals(bar)
  if (index === 3) next = addPickupKick(next)
  if (index === 4) next = withCrashDownbeat(next)
  if (index === 6) next = phraseEndOpenHat(next, feel)
  return next
}

function pulseGroup(bar: Pick<RhythmBar, 'beats' | 'beatUnit'>): number {
  return bar.beatUnit === 8 && bar.beats % 3 === 0 ? 3 : 1
}

/** Last 1–2 beats (or two dotted-quarter groups in 12/8). */
export function fillStartBeat(bar: Pick<RhythmBar, 'beats' | 'beatUnit'>, variant: number): number {
  const group = pulseGroup(bar)
  const v = ((variant % FILL_VARIANT_COUNT) + FILL_VARIANT_COUNT) % FILL_VARIANT_COUNT
  const maxFill = bar.beats <= 3 * group ? group : 2 * group
  const fillBeats = v === 1 ? Math.min(maxFill, group === 1 ? 1 : group) : maxFill
  return Math.max(0, bar.beats - fillBeats)
}

function keepBefore(bar: RhythmBar, beat: number, voices: readonly VoiceId[]): RhythmBar {
  const next = cloneBar(bar)
  for (const voice of voices) {
    next.pattern[voice] = (next.pattern[voice] ?? []).filter((hit) => hit.beat < beat)
  }
  return next
}

function splitToms(total: number): VoiceId[] {
  const high = Math.ceil(total / 3)
  const floor = Math.ceil(total / 3)
  const mid = Math.max(0, total - high - floor)
  return [
    ...Array.from({ length: high }, () => 'highTom' as const),
    ...Array.from({ length: mid }, () => 'midTom' as const),
    ...Array.from({ length: floor }, () => 'floorTom' as const),
  ]
}

function fillFigure(startBeat: number, beatCount: number, steps: number, variant: number): { voice: VoiceId; hit: HitPos }[] {
  const total = beatCount * steps
  const v = ((variant % FILL_VARIANT_COUNT) + FILL_VARIANT_COUNT) % FILL_VARIANT_COUNT
  const mix: VoiceId[] = ['snare', 'highTom', 'snare', 'midTom', 'snare', 'floorTom', 'snare', 'floorTom']
  const voices =
    v === 0
      ? splitToms(total)
      : v === 1
        ? Array.from({ length: total }, (_, index) =>
            index >= total - Math.max(1, Math.floor(steps / 2)) ? 'floorTom' : 'snare',
          )
        : Array.from({ length: total }, (_, index) => mix[index % mix.length]!)
  const figure: { voice: VoiceId; hit: HitPos }[] = []
  for (let index = 0; index < total; index += 1) {
    const beat = startBeat + Math.floor(index / steps)
    const slot = index % steps
    figure.push({ voice: voices[index]!, hit: reduceHit(beat, slot, steps) })
  }
  return figure
}

const FILL_CLEAR: VoiceId[] = [
  'snare',
  'rim',
  'highTom',
  'midTom',
  'floorTom',
  'openHat',
  'crash',
  'splash',
  'china',
  'stack',
]

export function makeFillBar(seed: readonly RhythmBar[], variant = 0): RhythmBar {
  const groove = cloneBar(seed[0] ?? { beats: 4, beatUnit: 4, subdivision: 4, beatSubdivisions: [4, 4, 4, 4], beatAccents: [], pattern: emptyPattern() })
  const feel = detectFillFeel(seed.length ? seed : [groove])
  const steps = fillSteps(feel)
  const fillStart = fillStartBeat(groove, variant)
  const fillBeats = groove.beats - fillStart

  let next = keepBefore(withoutCymbals(groove), fillStart, FILL_CLEAR)
  next = keepBefore(next, fillStart, ['kick', 'closedHat', 'openHat', 'ride', 'rideBell'])
  next.pattern = setHitPos(next.pattern, 'kick', reduceHit(0, 0, 1), true)

  for (const item of fillFigure(fillStart, fillBeats, steps, variant)) {
    if (item.hit.beat < 0 || item.hit.beat >= next.beats) continue
    next.pattern = setHitPos(next.pattern, item.voice, item.hit, true)
  }
  return next
}

export function autoCompleteBars(bars: readonly RhythmBar[], fillVariant = 0): RhythmBar[] {
  const seed = seedBars(bars)
  if (seed.length === 0) return bars.map(cloneBar)
  const feel = detectFillFeel(seed)
  const body: RhythmBar[] = []
  for (let index = 0; index < AUTO_COMPLETE_BARS - 1; index += 1) {
    const base = seed[index % seed.length]!
    body.push(varyBar(base, index, feel))
  }
  return [...body, makeFillBar(seed, fillVariant)]
}

export function replaceFillBar(bars: readonly RhythmBar[], fillVariant: number): RhythmBar[] {
  if (bars.length === 0) return []
  const groove = bars.length >= AUTO_COMPLETE_BARS ? bars.slice(0, AUTO_COMPLETE_BARS - 1) : bars
  const next = autoCompleteBars(groove, fillVariant)
  if (bars.length >= AUTO_COMPLETE_BARS) {
    return [...bars.slice(0, AUTO_COMPLETE_BARS - 1).map(cloneBar), next[AUTO_COMPLETE_BARS - 1]!]
  }
  return next
}

export function nextFillVariant(current: number): number {
  return (current + 1) % FILL_VARIANT_COUNT
}

export function barsMatchExcept(left: RhythmBar, right: RhythmBar, ignore: readonly VoiceId[]): boolean {
  const a = cloneBar(left)
  const b = cloneBar(right)
  for (const voice of ignore) {
    a.pattern[voice] = []
    b.pattern[voice] = []
  }
  return (
    a.beats === b.beats &&
    a.beatUnit === b.beatUnit &&
    a.subdivision === b.subdivision &&
    patternsEqual(a.pattern, b.pattern)
  )
}

export function latestFillHit(bar: RhythmBar): number {
  let latest = -1
  for (const voice of VOICES) {
    for (const hit of bar.pattern[voice] ?? []) {
      latest = Math.max(latest, hitFraction(hit))
    }
  }
  return latest
}
