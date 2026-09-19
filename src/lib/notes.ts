export const A4_HZ = 440
export const IN_TUNE_CENTS = 8

const SHARP_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const

const FLAT_NAMES = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'G♭',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
] as const

export type InstrumentPreset = 'chromatic' | 'guitar' | 'bass'

export type InstrumentString = {
  id: string
  label: string
  midi: number
  stringNo: number
}

export const GUITAR_STRINGS: InstrumentString[] = [
  { id: 'E2', label: 'E', midi: 40, stringNo: 6 },
  { id: 'A2', label: 'A', midi: 45, stringNo: 5 },
  { id: 'D3', label: 'D', midi: 50, stringNo: 4 },
  { id: 'G3', label: 'G', midi: 55, stringNo: 3 },
  { id: 'B3', label: 'B', midi: 59, stringNo: 2 },
  { id: 'E4', label: 'e', midi: 64, stringNo: 1 },
]

export const BASS_STRINGS: InstrumentString[] = [
  { id: 'E1', label: 'E', midi: 28, stringNo: 4 },
  { id: 'A1', label: 'A', midi: 33, stringNo: 3 },
  { id: 'D2', label: 'D', midi: 38, stringNo: 2 },
  { id: 'G2', label: 'G', midi: 43, stringNo: 1 },
]

export type DetectedNote = {
  frequency: number
  midi: number
  cents: number
  octave: number
  sharpName: string
  flatName: string
  isNatural: boolean
}

export function midiToFreq(midi: number): number {
  return A4_HZ * 2 ** ((midi - 69) / 12)
}

export function freqToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / A4_HZ)
}

export function analyzeFrequency(frequency: number): DetectedNote {
  const midiExact = freqToMidi(frequency)
  const midi = Math.round(midiExact)
  const pitchClass = ((midi % 12) + 12) % 12
  const sharpName = SHARP_NAMES[pitchClass]
  const flatName = FLAT_NAMES[pitchClass]

  return {
    frequency,
    midi,
    cents: (midiExact - midi) * 100,
    octave: Math.floor(midi / 12) - 1,
    sharpName,
    flatName,
    isNatural: sharpName === flatName,
  }
}

export function centsBetween(frequency: number, targetMidi: number): number {
  return (freqToMidi(frequency) - targetMidi) * 100
}

export function nearestString(
  frequency: number,
  strings: readonly InstrumentString[],
): InstrumentString {
  let best = strings[0]
  let bestDelta = Number.POSITIVE_INFINITY

  for (const string of strings) {
    const delta = Math.abs(centsBetween(frequency, string.midi))
    if (delta < bestDelta) {
      best = string
      bestDelta = delta
    }
  }

  return best
}

export function stringsForPreset(
  preset: InstrumentPreset,
): readonly InstrumentString[] {
  if (preset === 'guitar') return GUITAR_STRINGS
  if (preset === 'bass') return BASS_STRINGS
  return []
}

export function rms(buffer: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buffer.length; i += 1) {
    const sample = buffer[i]
    sum += sample * sample
  }
  return Math.sqrt(sum / buffer.length)
}
