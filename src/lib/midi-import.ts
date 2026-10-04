import { mergeHit, quantizeToStep, smartQuantizePlan } from '@/lib/drum-recorder'
import { parseMidi, type ParsedMidi } from '@/lib/midi-file'
import { voiceForMidiNote, type MidiNoteMap } from '@/lib/midi-map'
import {
  MAX_BARS,
  barDurationSec,
  clampBeats,
  clampBpm,
  isBeatUnit,
  makeBar,
  stepsInBar,
  type BeatUnit,
  type RhythmBar,
  type VoiceId,
} from '@/lib/rhythm'

export const MIDI_IMPORT_MAX_BARS = MAX_BARS
export const MIDI_IMPORT_DEFAULT_BPM = 120
export const MIDI_IMPORT_DEFAULT_BEATS = 4
export const MIDI_IMPORT_DEFAULT_BEAT_UNIT: BeatUnit = 4

export type MidiImportHit = {
  voice: VoiceId
  barIndex: number
  offsetSec: number
}

export type MidiImportResult = {
  name: string
  bpm: number
  beats: number
  beatUnit: BeatUnit
  bars: RhythmBar[]
  importedNotes: number
  skipped: number
  truncated: boolean
  notes: string[]
}

export function beatNameFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, '').replace(/\.(midi?|MID|MIDI)$/i, '').trim()
  const cleaned = base.replace(/\s+/g, ' ').slice(0, 40).trim()
  return cleaned || 'Imported beat'
}

export function ticksPerBar(ppq: number, beats: number, beatUnit: BeatUnit): number {
  return clampBeats(beats) * ppq * (4 / beatUnit)
}

function safeBeatUnit(value: number | undefined): BeatUnit {
  return isBeatUnit(value) ? value : MIDI_IMPORT_DEFAULT_BEAT_UNIT
}

export function importNotesFromParsed(
  parsed: ParsedMidi,
  map: MidiNoteMap,
  fileName = 'Imported beat',
): MidiImportResult {
  const bpm = clampBpm(parsed.tempoBpm ?? MIDI_IMPORT_DEFAULT_BPM)
  const beats = clampBeats(parsed.timeSig?.beats ?? MIDI_IMPORT_DEFAULT_BEATS)
  const beatUnit = safeBeatUnit(parsed.timeSig?.beatUnit)
  const barTicks = ticksPerBar(parsed.ppq, beats, beatUnit)
  const barDur = barDurationSec(beats, bpm, beatUnit)

  let skipped = 0
  const placed: MidiImportHit[] = []
  let lastNoteBar = -1

  for (const event of parsed.notes) {
    const voice = voiceForMidiNote(event.note, map)
    const barIndex = barTicks > 0 ? Math.floor(event.tick / barTicks) : 0
    if (event.tick >= 0) lastNoteBar = Math.max(lastNoteBar, barIndex)
    if (!voice) {
      skipped += 1
      continue
    }
    const offsetTick = event.tick - barIndex * barTicks
    const offsetSec = barTicks > 0 ? (offsetTick / barTicks) * barDur : 0
    placed.push({ voice, barIndex, offsetSec })
  }

  const fileBars =
    lastNoteBar >= 0
      ? lastNoteBar + 1
      : parsed.lastTick > 0 && barTicks > 0
        ? Math.max(1, Math.ceil(parsed.lastTick / barTicks - 1e-9))
        : 4
  const truncated = fileBars > MIDI_IMPORT_MAX_BARS
  const barCount = Math.min(MIDI_IMPORT_MAX_BARS, Math.max(1, lastNoteBar >= 0 ? Math.min(fileBars, lastNoteBar + 1) : fileBars))

  const bars: RhythmBar[] = []
  let importedNotes = 0
  for (let index = 0; index < barCount; index += 1) {
    const hits = placed.filter((hit) => hit.barIndex === index)
    const offsets = hits.map((hit) => hit.offsetSec)
    const seed = makeBar(beats, beatUnit, 4)
    const plan = smartQuantizePlan(offsets, seed, barDur)
    const subdivision = plan.offerTriplets ? plan.tripletSubdivision : 4
    let bar = makeBar(beats, beatUnit, subdivision)
    const steps = stepsInBar(bar)
    for (const hit of hits) {
      const step = quantizeToStep(hit.offsetSec, barDur, steps)
      bar = { ...bar, pattern: mergeHit(bar.pattern, hit.voice, step, bar.beats, subdivision) }
      importedNotes += 1
    }
    bars.push(bar)
  }

  const notes: string[] = []
  if (truncated) notes.push('Imported first 8 bars')
  if (skipped > 0) notes.push(`${skipped} notes skipped (no drum mapped)`)

  return {
    name: beatNameFromFileName(fileName),
    bpm,
    beats,
    beatUnit,
    bars,
    importedNotes,
    skipped,
    truncated,
    notes,
  }
}

export function importMidiFile(data: ArrayBuffer | Uint8Array, map: MidiNoteMap, fileName = 'Imported beat'): MidiImportResult {
  return importNotesFromParsed(parseMidi(data), map, fileName)
}

export function importNoteLine(result: MidiImportResult): string | null {
  if (result.notes.length === 0) return null
  return result.notes.join(' · ')
}
