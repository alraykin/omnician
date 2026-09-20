export const A4_HZ = 440
export const IN_TUNE_CENTS = 8

export const SHARP_NAMES = [
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

export type InstrumentString = {
  id: string
  label: string
  midi: number
  stringNo: number
  octave: number
}

export function pitchClassName(midi: number): {
  sharpName: string
  flatName: string
  octave: number
  isNatural: boolean
} {
  const pitchClass = ((midi % 12) + 12) % 12
  const sharpName = SHARP_NAMES[pitchClass]
  const flatName = FLAT_NAMES[pitchClass]
  return {
    sharpName,
    flatName,
    octave: Math.floor(midi / 12) - 1,
    isNatural: sharpName === flatName,
  }
}

export function midiFromNote(pitchClass: number, octave: number): number {
  return pitchClass + (octave + 1) * 12
}

export function notesLabel(midis: readonly number[]): string {
  return midis.map((midi) => pitchClassName(midi).sharpName).join(' ')
}

export function stringsFromMidis(midis: readonly number[]): InstrumentString[] {
  const count = midis.length
  return midis.map((midi, index) => {
    const pitch = pitchClassName(midi)
    const stringNo = count - index
    return {
      id: `${pitch.sharpName}${pitch.octave}-${stringNo}`,
      label: pitch.sharpName,
      midi,
      stringNo,
      octave: pitch.octave,
    }
  })
}

export type DetectedNote = {
  frequency: number
  midi: number
  cents: number
  octave: number
  sharpName: string
  flatName: string
  isNatural: boolean
}

export function midiToFreq(midi: number, a4 = A4_HZ): number {
  return a4 * 2 ** ((midi - 69) / 12)
}

export function freqToMidi(frequency: number, a4 = A4_HZ): number {
  return 69 + 12 * Math.log2(frequency / a4)
}

export function analyzeFrequency(frequency: number, a4 = A4_HZ): DetectedNote {
  const midiExact = freqToMidi(frequency, a4)
  const midi = Math.round(midiExact)
  const pitch = pitchClassName(midi)

  return {
    frequency,
    midi,
    cents: (midiExact - midi) * 100,
    octave: pitch.octave,
    sharpName: pitch.sharpName,
    flatName: pitch.flatName,
    isNatural: pitch.isNatural,
  }
}

export function centsBetween(
  frequency: number,
  targetMidi: number,
  a4 = A4_HZ,
): number {
  return (freqToMidi(frequency, a4) - targetMidi) * 100
}

export const STRING_LOCK_CENTS = 90

export function nearestString(
  frequency: number,
  strings: readonly InstrumentString[],
  a4 = A4_HZ,
): InstrumentString {
  let best = strings[0]
  let bestDelta = Number.POSITIVE_INFINITY

  for (const string of strings) {
    const delta = Math.abs(centsBetween(frequency, string.midi, a4))
    if (delta < bestDelta) {
      best = string
      bestDelta = delta
    }
  }

  return best
}

export function matchString(
  frequency: number,
  strings: readonly InstrumentString[],
  a4 = A4_HZ,
  lockCents = STRING_LOCK_CENTS,
): { string: InstrumentString; cents: number } | null {
  if (strings.length === 0) return null
  const matched = nearestString(frequency, strings, a4)
  const cents = centsBetween(frequency, matched.midi, a4)
  if (Math.abs(cents) > lockCents) return null
  return { string: matched, cents }
}

export function rms(buffer: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buffer.length; i += 1) {
    const sample = buffer[i]
    sum += sample * sample
  }
  return Math.sqrt(sum / buffer.length)
}
