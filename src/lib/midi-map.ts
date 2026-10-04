import { VOICE_LABELS, VOICES, type VoiceId } from '@/lib/rhythm'

/** Middle C is C3 = MIDI 60, so C1 = 36. */
export const MIDI_MAP_KEY = 'omnician.drums.midi-map.v1'

export const MIDI_NOTE_MIN = 0
export const MIDI_NOTE_MAX = 127

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** Default drum note map (C3 = 60). */
export const DEFAULT_MIDI_MAP: Record<VoiceId, number> = {
  kick: 36, // C1
  rim: 37, // C#1
  snare: 38, // D1
  highTom: 42, // F#1
  midTom: 43, // G1
  floorTom: 45, // A1
  closedHat: 52, // E2
  openHat: 53, // F2
  crash: 64, // E3
  stack: 65, // F3
  ride: 68, // G#3
  rideBell: 69, // A3
  china: 74, // D4
  splash: 76, // E4
}

export type MidiNoteMap = Record<VoiceId, number>

export const MIDI_MAP_VOICES: readonly VoiceId[] = VOICES

export function midiOctave(note: number): number {
  return Math.floor(clampMidiNote(note) / 12) - 2
}

export function midiPitchClass(note: number): (typeof NOTE_NAMES)[number] {
  return NOTE_NAMES[clampMidiNote(note) % 12] as (typeof NOTE_NAMES)[number]
}

export function midiNoteName(note: number): string {
  return `${midiPitchClass(note)}${midiOctave(note)}`
}

export function midiNoteFromName(name: string, octave: number): number {
  const index = NOTE_NAMES.indexOf(name as (typeof NOTE_NAMES)[number])
  if (index < 0) return 60
  return clampMidiNote((octave + 2) * 12 + index)
}

export function formatMidiNote(note: number): string {
  return `${midiNoteName(note)} · ${clampMidiNote(note)}`
}

export function clampMidiNote(note: number): number {
  if (!Number.isFinite(note)) return 60
  return Math.min(MIDI_NOTE_MAX, Math.max(MIDI_NOTE_MIN, Math.round(note)))
}

export function cloneMidiMap(map: MidiNoteMap = DEFAULT_MIDI_MAP): MidiNoteMap {
  const next = { ...DEFAULT_MIDI_MAP }
  for (const voice of VOICES) {
    const value = map[voice]
    if (typeof value === 'number') next[voice] = clampMidiNote(value)
  }
  return next
}

export function voiceForMidiNote(note: number, map: MidiNoteMap): VoiceId | null {
  const pitch = clampMidiNote(note)
  for (const voice of VOICES) {
    if (map[voice] === pitch) return voice
  }
  return null
}

/** Assign a note to a drum. If another drum already has it, swap the two. */
export function assignMidiNote(map: MidiNoteMap, voice: VoiceId, note: number): MidiNoteMap {
  const pitch = clampMidiNote(note)
  const next = cloneMidiMap(map)
  const holder = VOICES.find((other) => other !== voice && next[other] === pitch)
  if (holder) next[holder] = next[voice]
  next[voice] = pitch
  return next
}

export function loadMidiMap(): MidiNoteMap {
  if (typeof localStorage === 'undefined') return cloneMidiMap()
  try {
    const raw = localStorage.getItem(MIDI_MAP_KEY)
    if (!raw) return cloneMidiMap()
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>
    const next = cloneMidiMap()
    for (const voice of VOICES) {
      const value = parsed[voice]
      if (typeof value === 'number') next[voice] = clampMidiNote(value)
    }
    return next
  } catch {
    return cloneMidiMap()
  }
}

export function saveMidiMap(map: MidiNoteMap): void {
  try {
    localStorage.setItem(MIDI_MAP_KEY, JSON.stringify(cloneMidiMap(map)))
  } catch {
    // Private mode.
  }
}

export function midiMapRows(map: MidiNoteMap): { voice: VoiceId; label: string; note: number }[] {
  return VOICES.map((voice) => ({ voice, label: VOICE_LABELS[voice], note: map[voice] }))
}

export const MIDI_NOTE_OPTIONS: { note: number; name: string; label: string }[] = Array.from(
  { length: MIDI_NOTE_MAX - MIDI_NOTE_MIN + 1 },
  (_, note) => ({
    note,
    name: midiNoteName(note),
    label: formatMidiNote(note),
  }),
)
