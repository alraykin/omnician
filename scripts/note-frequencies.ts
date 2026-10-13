/**
 * Every preset string target, fork tone, and displayed Hz must follow
 * f = A4ref * 2^((midi-69)/12) with A4 = MIDI 69 and scientific octave
 * numbering (E2 = 82.41 Hz, A2 = 110 Hz, E4 = 329.63 Hz, B0 = 30.87 Hz).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  A4_HZ,
  CONCERT_ANCHORS,
  formatHz,
  midiFromNote,
  midiToFreq,
  pitchClassName,
  stringTargetHz,
} from '../src/lib/notes.ts'
import { BUILTIN_PRESETS } from '../src/lib/presets.ts'

const A4S = [415, 432, 440, 442, 444] as const

function expectedHz(midi: number, a4: number): number {
  return a4 * 2 ** ((midi - 69) / 12)
}

const mismatches: string[] = []

function note(ok: boolean, message: string) {
  if (!ok) mismatches.push(message)
}

for (const anchor of CONCERT_ANCHORS) {
  const hz = midiToFreq(anchor.midi, 440)
  note(
    Math.abs(hz - anchor.hz) < 1e-9,
    `${anchor.name}: midiToFreq(${anchor.midi}) = ${hz}, expected ${anchor.hz}`,
  )
  const pitch = pitchClassName(anchor.midi)
  note(
    `${pitch.sharpName}${pitch.octave}` === anchor.name,
    `${anchor.name}: octave/name was ${pitch.sharpName}${pitch.octave}`,
  )
}

note(Math.abs(midiToFreq(69, 440) - 440) < 1e-12, 'A4 MIDI 69 must be the A4 reference')
note(midiFromNote(4, 2) === 40, 'midiFromNote(E, 2) must be 40')
note(midiFromNote(9, 2) === 45, 'midiFromNote(A, 2) must be 45')
note(midiFromNote(4, 4) === 64, 'midiFromNote(E, 4) must be 64')
note(midiFromNote(11, 0) === 23, 'midiFromNote(B, 0) must be 23')

note(formatHz(midiToFreq(23, 440)) === '30.87 Hz', `B0 displayed ${formatHz(midiToFreq(23, 440))}`)
note(formatHz(midiToFreq(40, 440)) === '82.41 Hz', `E2 displayed ${formatHz(midiToFreq(40, 440))}`)
note(formatHz(midiToFreq(45, 440)) === '110 Hz', `A2 displayed ${formatHz(midiToFreq(45, 440))}`)
note(formatHz(midiToFreq(64, 440)) === '329.63 Hz', `E4 displayed ${formatHz(midiToFreq(64, 440))}`)
note(formatHz(440) === '440 Hz', `A4 displayed ${formatHz(440)}`)

let stringsChecked = 0
let presetsChecked = 0

for (const preset of BUILTIN_PRESETS) {
  if (preset.strings.length === 0) continue
  presetsChecked += 1
  for (const string of preset.strings) {
    stringsChecked += 1
    const pitch = pitchClassName(string.midi)
    note(
      pitch.sharpName === string.label,
      `${preset.id} ${string.id}: label ${string.label} != ${pitch.sharpName} for midi ${string.midi}`,
    )
    note(
      pitch.octave === string.octave,
      `${preset.id} ${string.id}: octave ${string.octave} != ${pitch.octave} for midi ${string.midi}`,
    )

    const concert = stringTargetHz(string, 440)
    const formula = expectedHz(string.midi, 440)
    note(
      Math.abs(concert - formula) < 1e-12,
      `${preset.id} ${string.id}: target ${concert} != formula ${formula}`,
    )

    for (const a4 of A4S) {
      const hz = stringTargetHz(string, a4)
      const want = expectedHz(string.midi, a4)
      note(
        Math.abs(hz - want) < 1e-12,
        `${preset.id} ${string.id} @ A4=${a4}: ${hz} != ${want}`,
      )
      const scaled = concert * (a4 / 440)
      note(
        Math.abs(hz - scaled) < 1e-9,
        `${preset.id} ${string.id} @ A4=${a4}: ${hz} did not scale from 440 (${scaled})`,
      )
    }
  }
}

note(presetsChecked >= 40, `expected many presets, got ${presetsChecked}`)
note(stringsChecked >= 200, `expected many strings, got ${stringsChecked}`)

const guitar = BUILTIN_PRESETS.find((item) => item.id === 'guitar-6-standard')
assert.ok(guitar)
const [e2, a2, d3, g3, b3, e4] = guitar.strings
assert.ok(e2 && a2 && d3 && g3 && b3 && e4)
note(e2.midi === 40 && Math.abs(stringTargetHz(e2, 440) - 82.40688922821748) < 1e-9, 'guitar low E is E2')
note(a2.midi === 45 && stringTargetHz(a2, 440) === 110, 'guitar A is A2 = 110 Hz')
note(e4.midi === 64 && Math.abs(stringTargetHz(e4, 440) - 329.6275569128699) < 1e-9, 'guitar high E is E4')

const bass = BUILTIN_PRESETS.find((item) => item.id === 'bass-4')
assert.ok(bass)
note(bass.strings[0]?.midi === 28, '4-string bass low string is E1')
note(
  Math.abs(stringTargetHz(bass.strings[0]!, 440) - 41.20344461410874) < 1e-9,
  'bass E1 Hz',
)

const bead = BUILTIN_PRESETS.find((item) => item.id === 'bass-4-bead')
assert.ok(bead)
note(bead.strings[0]?.midi === 23, 'BEAD low string is B0')
note(formatHz(stringTargetHz(bead.strings[0]!, 440)) === '30.87 Hz', 'BEAD B0 displayed Hz')

const twelve = BUILTIN_PRESETS.find((item) => item.id === 'guitar-12-standard')
assert.ok(twelve)
const octaveE = twelve.strings.find((item) => item.midi === 52)
const fundE = twelve.strings.find((item) => item.midi === 40)
note(Boolean(octaveE && fundE), '12-string has E3 + E2 pair')
note(
  Boolean(octaveE && Math.abs(stringTargetHz(octaveE, 440) / stringTargetHz(fundE!, 440) - 2) < 1e-12),
  '12-string E pair is a true octave',
)

const pageSrc = readFileSync(new URL('../src/pages/TunerPage.tsx', import.meta.url), 'utf8')
note(pageSrc.includes('stringTargetHz'), 'TunerPage displays target Hz from stringTargetHz')
note(pageSrc.includes('data-target-hz'), 'TunerPage has data-target-hz for the displayed target')
note(pageSrc.includes('midiToFreq(string.midi, a4Hz)'), 'fork tones use midiToFreq(string.midi, a4Hz)')
note(pageSrc.includes('retunePlayingTone(midiToFreq(string.midi, a4Hz))'), 'fork retune follows A4')

const toneSrc = readFileSync(new URL('../src/lib/reference-tone.ts', import.meta.url), 'utf8')
note(toneSrc.includes('fundamental.frequency.setValueAtTime(frequency, now)'), 'fork oscillator uses the passed Hz')
note(toneSrc.includes('playing.osc[0]?.frequency.setTargetAtTime(frequency, now, 0.02)'), 'fork retune writes the new Hz')

const notesSrc = readFileSync(new URL('../src/lib/notes.ts', import.meta.url), 'utf8')
note(
  notesSrc.includes('return a4 * 2 ** ((midi - 69) / 12)'),
  'midiToFreq is exactly f = A4ref * 2^((midi-69)/12)',
)

if (mismatches.length) {
  console.error(`\n${mismatches.length} note-frequency mismatch(es):`)
  for (const line of mismatches) console.error(`  ${line}`)
  process.exit(1)
}

console.log(
  `note-frequencies: ${presetsChecked} presets, ${stringsChecked} strings, anchors + A4 scale + fork/display wiring ok`,
)
