export const A4_HZ = 440
export const IN_TUNE_CENTS = 1

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
  pegLabel?: string
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

/** Expand 6 course fundamentals into a real 12-string: octave pairs on E A D G, unisons on B and high e. */
export function stringsFromTwelveCourses(
  courseMidis: readonly number[],
): InstrumentString[] {
  if (courseMidis.length !== 6) return stringsFromMidis(courseMidis)
  const nut: Array<{ midi: number; pegLabel: string }> = []
  for (let i = 0; i < 6; i++) {
    const fund = courseMidis[i]
    const letter = pitchClassName(fund).sharpName
    if (i === 0) {
      nut.push({ midi: fund + 12, pegLabel: 'E' })
      nut.push({ midi: fund, pegLabel: 'E' })
    } else if (i < 4) {
      nut.push({ midi: fund + 12, pegLabel: letter.toLowerCase() })
      nut.push({ midi: fund, pegLabel: letter })
    } else if (i === 4) {
      nut.push({ midi: fund, pegLabel: 'B' })
      nut.push({ midi: fund, pegLabel: 'B' })
    } else {
      nut.push({ midi: fund, pegLabel: 'e' })
      nut.push({ midi: fund, pegLabel: 'e' })
    }
  }
  const count = nut.length
  return nut.map((item, index) => {
    const pitch = pitchClassName(item.midi)
    const stringNo = count - index
    return {
      id: `${pitch.sharpName}${pitch.octave}-${stringNo}`,
      label: pitch.sharpName,
      pegLabel: item.pegLabel,
      midi: item.midi,
      stringNo,
      octave: pitch.octave,
    }
  })
}

export function twelveCourseNotes(courseMidis: readonly number[]): string {
  const names = courseMidis.map((midi) => pitchClassName(midi).sharpName)
  names[5] = names[5].toLowerCase()
  return names
    .map((name, index) =>
      index < 4 ? `${name}/${name.toLowerCase()}` : `${name}/${name}`,
    )
    .join(' ')
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

/** Concert-pitch anchors used to pin octave numbering and the A4=MIDI 69 formula. */
export const CONCERT_ANCHORS = [
  { name: 'B0', midi: 23, hz: 30.86770632850775 },
  { name: 'E2', midi: 40, hz: 82.40688922821748 },
  { name: 'A2', midi: 45, hz: 110 },
  { name: 'E4', midi: 64, hz: 329.6275569128699 },
  { name: 'A4', midi: 69, hz: 440 },
] as const

export function stringTargetHz(
  string: Pick<InstrumentString, 'midi'> | number,
  a4 = A4_HZ,
): number {
  const midi = typeof string === 'number' ? string : string.midi
  return midiToFreq(midi, a4)
}

/** Displayed Hz: two decimals, except whole numbers (A2 = 110 Hz). */
export function formatHz(hz: number): string {
  if (!(hz > 0) || !Number.isFinite(hz)) return '—'
  const hundredths = Math.round(hz * 100) / 100
  if (Math.abs(hundredths - Math.round(hundredths)) < 0.001) {
    return `${Math.round(hundredths)} Hz`
  }
  return `${hundredths.toFixed(2)} Hz`
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

export function trackString(
  frequency: number,
  strings: readonly InstrumentString[],
  currentId: string | null,
  a4 = A4_HZ,
  stayCents = 32,
): { string: InstrumentString; cents: number } {
  const nearest = nearestString(frequency, strings, a4)
  const nearestCents = centsBetween(frequency, nearest.midi, a4)
  if (!currentId) {
    return { string: nearest, cents: nearestCents }
  }
  const current = strings.find((item) => item.id === currentId)
  if (!current) {
    return { string: nearest, cents: nearestCents }
  }
  const currentCents = centsBetween(frequency, current.midi, a4)
  if (
    nearest.id !== current.id &&
    Math.abs(nearestCents) + stayCents < Math.abs(currentCents)
  ) {
    return { string: nearest, cents: nearestCents }
  }
  return { string: current, cents: currentCents }
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
