import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { midiToFreq, stringTargetHz } from '../src/lib/notes.ts'
import { findBuiltinPreset } from '../src/lib/presets.ts'
import {
  isReferenceToneLeak,
  nextToneAction,
} from '../src/lib/reference-tone.ts'

assert.equal(nextToneAction(null, 'A2-5'), 'start')
assert.equal(nextToneAction('A2-5', 'A2-5'), 'stop')
assert.equal(nextToneAction('A2-5', 'E2-6'), 'switch')
assert.equal(nextToneAction('E4-1', 'E4-1'), 'stop')

assert.equal(isReferenceToneLeak(110, 110, 0.01), true)
assert.equal(isReferenceToneLeak(110.2, 110, 0.012), true)
assert.equal(isReferenceToneLeak(220, 110, 0.01), true)
assert.equal(isReferenceToneLeak(110, 110, 0.08), false)
assert.equal(isReferenceToneLeak(146.8, 110, 0.02), false)
assert.equal(isReferenceToneLeak(110, null, 0.01), false)
assert.equal(isReferenceToneLeak(0, 110, 0.01), false)

const guitar = findBuiltinPreset('guitar-6-standard')
assert.ok(guitar)
for (const string of guitar.strings) {
  const forkHz = midiToFreq(string.midi, 440)
  assert.equal(forkHz, stringTargetHz(string, 440))
  assert.ok(
    Math.abs(midiToFreq(string.midi, 432) - forkHz * (432 / 440)) < 1e-9,
    `${string.id} fork must scale with A4`,
  )
}

const toneSrc = readFileSync(new URL('../src/lib/reference-tone.ts', import.meta.url), 'utf8')
assert.match(toneSrc, /type = 'sine'/)
assert.match(toneSrc, /exponentialRampToValueAtTime/)
assert.match(toneSrc, /export function stopReferenceTone/)
assert.match(toneSrc, /export function toggleReferenceTone/)
assert.doesNotMatch(toneSrc, /createBufferSource/)
assert.doesNotMatch(toneSrc, /duration = /)

const sessionSrc = readFileSync(new URL('../src/lib/tuner-session.ts', import.meta.url), 'utf8')
assert.match(sessionSrc, /stopReferenceTone/)
assert.match(sessionSrc, /isReferenceToneLeak/)
assert.match(sessionSrc, /forkNotch/)
assert.match(sessionSrc, /notch\.type = 'notch'/)
assert.match(sessionSrc, /onHiddenReleaseCapture/)

const pageSrc = readFileSync(new URL('../src/pages/TunerPage.tsx', import.meta.url), 'utf8')
assert.match(pageSrc, /toggleReferenceTone/)
assert.match(pageSrc, /playingId/)
assert.match(pageSrc, /visibilityState === 'hidden'/)
assert.match(pageSrc, /InputPicker alwaysShow/)
assert.doesNotMatch(pageSrc, /Volume slider|data-fork-volume/)
assert.doesNotMatch(pageSrc, /playReferenceTone\(/)

const speakerSrc = readFileSync(new URL('../src/components/tuner/PegSpeaker.tsx', import.meta.url), 'utf8')
assert.match(speakerSrc, /data-peg-speaker/)
assert.match(speakerSrc, /data-peg-pulse/)
assert.match(speakerSrc, /omni-fork-ring/)

const splitSrc = readFileSync(new URL('../src/components/tuner/SplitHeadstock.tsx', import.meta.url), 'utf8')
const inlineSrc = readFileSync(new URL('../src/components/tuner/InlineHeadstock.tsx', import.meta.url), 'utf8')
for (const src of [splitSrc, inlineSrc]) {
  assert.match(src, /PegSpeakerIcon/)
  assert.match(src, /PegPulseRings/)
  assert.match(src, /data-peg-playing/)
  assert.match(src, /playingId/)
}

console.log('reference-tone: ok')
