export const VOICES = [
  'kick',
  'snare',
  'closedHat',
  'openHat',
  'crash',
] as const

export type VoiceId = (typeof VOICES)[number]

export const VOICE_LABELS: Record<VoiceId, string> = {
  kick: 'Kick',
  snare: 'Snare',
  closedHat: 'Closed hat',
  openHat: 'Open hat',
  crash: 'Crash',
}

export const METER_IDS = [
  '2/4',
  '3/4',
  '4/4',
  '5/4',
  '6/8',
  '7/8',
  '9/8',
  '12/8',
] as const

export type MeterId = (typeof METER_IDS)[number]
export type RhythmMode = 'click' | 'drums'

export type Meter = {
  id: MeterId
  beats: number
  beatUnit: 4 | 8
  stepsPerBeat: number
  groupSizes: number[]
  pulseLabel: string
}

export type Pattern = Record<VoiceId, boolean[]>

export const METERS: Record<MeterId, Meter> = {
  '2/4': {
    id: '2/4',
    beats: 2,
    beatUnit: 4,
    stepsPerBeat: 4,
    groupSizes: [4, 4],
    pulseLabel: 'Quarter notes',
  },
  '3/4': {
    id: '3/4',
    beats: 3,
    beatUnit: 4,
    stepsPerBeat: 4,
    groupSizes: [4, 4, 4],
    pulseLabel: 'Quarter notes',
  },
  '4/4': {
    id: '4/4',
    beats: 4,
    beatUnit: 4,
    stepsPerBeat: 4,
    groupSizes: [4, 4, 4, 4],
    pulseLabel: 'Quarter notes',
  },
  '5/4': {
    id: '5/4',
    beats: 5,
    beatUnit: 4,
    stepsPerBeat: 2,
    groupSizes: [2, 2, 2, 2, 2],
    pulseLabel: 'Quarter notes',
  },
  '6/8': {
    id: '6/8',
    beats: 6,
    beatUnit: 8,
    stepsPerBeat: 1,
    groupSizes: [3, 3],
    pulseLabel: 'Dotted quarters',
  },
  '7/8': {
    id: '7/8',
    beats: 7,
    beatUnit: 8,
    stepsPerBeat: 1,
    groupSizes: [2, 2, 3],
    pulseLabel: 'Eighth notes',
  },
  '9/8': {
    id: '9/8',
    beats: 9,
    beatUnit: 8,
    stepsPerBeat: 1,
    groupSizes: [3, 3, 3],
    pulseLabel: 'Dotted quarters',
  },
  '12/8': {
    id: '12/8',
    beats: 12,
    beatUnit: 8,
    stepsPerBeat: 1,
    groupSizes: [3, 3, 3, 3],
    pulseLabel: 'Dotted quarters',
  },
}

export const MIN_BPM = 30
export const MAX_BPM = 300
export const DEFAULT_BPM = 100

export function stepsPerBar(meter: Meter): number {
  return meter.beats * meter.stepsPerBeat
}

export function emptyPattern(meter: Meter): Pattern {
  const length = stepsPerBar(meter)
  return Object.fromEntries(
    VOICES.map((voice) => [voice, Array.from({ length }, () => false)]),
  ) as Pattern
}

export function clonePattern(pattern: Pattern): Pattern {
  return Object.fromEntries(
    VOICES.map((voice) => [voice, [...pattern[voice]]]),
  ) as Pattern
}

export function resizePattern(pattern: Pattern, meter: Meter): Pattern {
  const length = stepsPerBar(meter)
  return Object.fromEntries(
    VOICES.map((voice) => [voice, resizeHits(pattern[voice] ?? [], length)]),
  ) as Pattern
}

export function resizeHits(hits: boolean[], length: number): boolean[] {
  if (hits.length === length) return [...hits]
  if (hits.length > length) return hits.slice(0, length)
  return [...hits, ...Array.from({ length: length - hits.length }, () => false)]
}

export function toggleHit(pattern: Pattern, voice: VoiceId, step: number): Pattern {
  const next = clonePattern(pattern)
  const row = next[voice]
  if (!row[step] && row.length > step) {
    next[voice] = row.map((on, index) => (index === step ? true : on))
    return next
  }
  next[voice] = row.map((on, index) => (index === step ? !on : on))
  return next
}

export function patternsEqual(a: Pattern, b: Pattern): boolean {
  return VOICES.every(
    (voice) =>
      a[voice].length === b[voice].length &&
      a[voice].every((on, index) => on === b[voice][index]),
  )
}

export function defaultAccents(meterId: MeterId): number[] {
  switch (meterId) {
    case '5/4':
      return [0, 3]
    case '6/8':
      return [0, 3]
    case '7/8':
      return [0, 2, 4]
    case '9/8':
      return [0, 3, 6]
    case '12/8':
      return [0, 3, 6, 9]
    default:
      return [0]
  }
}

export function toggleAccent(accents: number[], beat: number, beats: number): number[] {
  if (beat < 0 || beat >= beats) return accents
  const has = accents.includes(beat)
  const next = has ? accents.filter((item) => item !== beat) : [...accents, beat]
  next.sort((a, b) => a - b)
  if (next.length === 0) return [beat]
  return next
}

export function clampBpm(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BPM
  return Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, value)))
}

export function isMeterId(value: unknown): value is MeterId {
  return typeof value === 'string' && (METER_IDS as readonly string[]).includes(value)
}

export function stepDurationSec(bpm: number, meter: Meter): number {
  const tempo = Math.max(MIN_BPM, bpm)
  if (meter.id === '6/8' || meter.id === '9/8' || meter.id === '12/8') {
    return 60 / tempo / 3
  }
  if (meter.id === '7/8') {
    return 60 / tempo
  }
  return 60 / tempo / meter.stepsPerBeat
}

export function beatIndexForStep(step: number, meter: Meter): number {
  return Math.floor(step / meter.stepsPerBeat) % meter.beats
}

export function isBeatStep(step: number, meter: Meter): boolean {
  return step % meter.stepsPerBeat === 0
}

export function hitsFromSteps(length: number, steps: number[]): boolean[] {
  const row = Array.from({ length }, () => false)
  for (const step of steps) {
    if (step >= 0 && step < length) row[step] = true
  }
  return row
}

export function patternFromHits(
  meter: Meter,
  hits: Partial<Record<VoiceId, number[]>>,
): Pattern {
  const length = stepsPerBar(meter)
  const empty = emptyPattern(meter)
  return {
    kick: hits.kick ? hitsFromSteps(length, hits.kick) : empty.kick,
    snare: hits.snare ? hitsFromSteps(length, hits.snare) : empty.snare,
    closedHat: hits.closedHat ? hitsFromSteps(length, hits.closedHat) : empty.closedHat,
    openHat: hits.openHat ? hitsFromSteps(length, hits.openHat) : empty.openHat,
    crash: hits.crash ? hitsFromSteps(length, hits.crash) : empty.crash,
  }
}
