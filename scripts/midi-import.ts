import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { encodeMidi, parseMidi } from '../src/lib/midi-file.ts'
import { importMidiFile, importNoteLine, ticksPerBar } from '../src/lib/midi-import.ts'
import {
  DEFAULT_MIDI_MAP,
  assignMidiNote,
  midiNoteFromName,
  midiNoteName,
  voiceForMidiNote,
} from '../src/lib/midi-map.ts'
import { stepsInBar } from '../src/lib/rhythm.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(here, '..', 'public', 'test-midi')
mkdirSync(fixtureDir, { recursive: true })

assert.equal(midiNoteName(60), 'C3')
assert.equal(midiNoteName(36), 'C1')
assert.equal(midiNoteName(38), 'D1')
assert.equal(midiNoteFromName('C3', 3), 60)
assert.equal(voiceForMidiNote(36, DEFAULT_MIDI_MAP), 'kick')
assert.equal(voiceForMidiNote(42, DEFAULT_MIDI_MAP), 'highTom')
assert.equal(voiceForMidiNote(46, DEFAULT_MIDI_MAP), null)

const swapped = assignMidiNote(DEFAULT_MIDI_MAP, 'kick', 38)
assert.equal(swapped.kick, 38)
assert.equal(swapped.snare, 36)

const ppq = 480

function rockNotes(bars: number) {
  const notes: { tick: number; note: number; velocity: number }[] = []
  const barTicks = 4 * ppq
  for (let bar = 0; bar < bars; bar += 1) {
    const base = bar * barTicks
    notes.push({ tick: base, note: 36, velocity: 110 })
    notes.push({ tick: base + ppq * 2, note: 36, velocity: 100 })
    notes.push({ tick: base + ppq, note: 38, velocity: 108 })
    notes.push({ tick: base + ppq * 3, note: 38, velocity: 108 })
    if (bar === 0) notes.push({ tick: base, note: 64, velocity: 90 })
    for (let eighth = 0; eighth < 8; eighth += 1) {
      notes.push({ tick: base + eighth * (ppq / 2), note: 52, velocity: 80 })
    }
  }
  return notes
}

const rock4 = encodeMidi({ ppq, bpm: 96, beats: 4, beatUnit: 4, notes: rockNotes(4) })
const rock12 = encodeMidi({ ppq, bpm: 96, beats: 4, beatUnit: 4, notes: rockNotes(12) })
const gm = encodeMidi({
  ppq,
  bpm: 120,
  beats: 4,
  beatUnit: 4,
  notes: [
    { tick: 0, note: 36, velocity: 100 },
    { tick: ppq, note: 38, velocity: 100 },
    { tick: ppq * 2, note: 42, velocity: 90 },
    { tick: ppq * 2 + ppq / 2, note: 46, velocity: 90 },
    { tick: 0, note: 49, velocity: 100 },
    { tick: ppq * 3, note: 51, velocity: 90 },
    { tick: ppq, note: 57, velocity: 90 },
  ],
})

writeFileSync(join(fixtureDir, 'rock-4bar-96.mid'), rock4)
writeFileSync(join(fixtureDir, 'rock-12bar-96.mid'), rock12)
writeFileSync(join(fixtureDir, 'gm-unmapped.mid'), gm)

const parsedRock = parseMidi(rock4)
assert.equal(Math.round(parsedRock.tempoBpm ?? 0), 96)
assert.equal(parsedRock.timeSig?.beats, 4)
assert.equal(parsedRock.timeSig?.beatUnit, 4)
assert.ok(parsedRock.notes.length > 10)
assert.ok(parsedRock.notes.every((note) => note.channel === 9))

const imported4 = importMidiFile(rock4, DEFAULT_MIDI_MAP, 'rock-4bar-96.mid')
assert.equal(imported4.name, 'rock-4bar-96')
assert.equal(imported4.bpm, 96)
assert.equal(imported4.bars.length, 4)
assert.equal(imported4.truncated, false)
assert.equal(imported4.skipped, 0)
assert.equal(imported4.bars[0]?.subdivision, 4)
assert.ok((imported4.bars[0]?.pattern.kick.length ?? 0) >= 2)
assert.ok((imported4.bars[0]?.pattern.snare.length ?? 0) >= 2)
assert.ok((imported4.bars[0]?.pattern.closedHat.length ?? 0) >= 8)
assert.ok((imported4.bars[0]?.pattern.crash.length ?? 0) >= 1)
assert.equal(imported4.notes.length, 0)

const imported12 = importMidiFile(rock12, DEFAULT_MIDI_MAP, 'long-groove.mid')
assert.equal(imported12.bars.length, 8)
assert.equal(imported12.truncated, true)
assert.equal(imported12.bpm, 96)
assert.ok(imported12.notes.includes('Imported first 8 bars'))
assert.equal(importNoteLine(imported12), 'Imported first 8 bars')

const importedGm = importMidiFile(gm, DEFAULT_MIDI_MAP, 'gm-kit.mid')
assert.equal(importedGm.skipped, 4, 'GM open hat / crashes / ride are unmapped')
assert.equal(importedGm.bars[0]?.pattern.kick.length, 1)
assert.equal(importedGm.bars[0]?.pattern.snare.length, 1)
assert.equal(importedGm.bars[0]?.pattern.highTom.length, 1, 'GM closed HH 42 maps to Tom 1')
assert.ok(importedGm.notes[0]?.includes('4 notes skipped (no drum mapped)'))

const tripPpq = 480
const tripNotes = [0, 1 / 3, 2 / 3, 1, 4 / 3, 5 / 3].map((beat) => ({
  tick: Math.round(beat * tripPpq),
  note: 36,
  velocity: 100,
}))
const triplets = encodeMidi({ ppq: tripPpq, bpm: 120, notes: tripNotes })
const importedTrip = importMidiFile(triplets, DEFAULT_MIDI_MAP, 'triplets.mid')
assert.equal(importedTrip.bars[0]?.subdivision, 6, 'Smart quantize upgrades 16ths to triplets')
assert.equal(stepsInBar(importedTrip.bars[0]!), 24)
assert.equal(importedTrip.bars[0]?.pattern.kick.length, 6)

assert.equal(ticksPerBar(480, 4, 4), 1920)
assert.equal(ticksPerBar(480, 6, 8), 1440)

const noTempo = encodeMidi({ ppq, notes: [{ tick: 0, note: 36 }] })
// encode always writes tempo; parse a hand-built file without tempo/time-sig
const bare = Uint8Array.from([
  0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0,
  0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 8,
  0x00, 0x90, 36, 100, 0x00, 0xff, 0x2f, 0x00,
])
const importedBare = importMidiFile(bare, DEFAULT_MIDI_MAP, 'bare.mid')
assert.equal(importedBare.bpm, 120)
assert.equal(importedBare.beats, 4)
assert.equal(importedBare.beatUnit, 4)
assert.equal(importedBare.bars[0]?.pattern.kick.length, 1)
assert.ok(noTempo.byteLength > 20)

console.log('midi-import: ok')
console.log(`wrote ${fixtureDir}`)
