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

export function rms(buffer: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buffer.length; i += 1) {
    const sample = buffer[i]
    sum += sample * sample
  }
  return Math.sqrt(sum / buffer.length)
}
