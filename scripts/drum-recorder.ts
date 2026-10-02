import assert from 'node:assert/strict'

import {
  applyPassHit,
  captureAudioTime,
  finestEvenSubdivision,
  offsetInBar,
  offsetInBarForPad,
  placeQuantizedHit,
  quantizeHit,
  quantizeToStep,
  requantizePassTo,
  shouldUpgradeSubdivision,
  smartQuantizePlan,
  stepError,
  stepInSubdivision,
  subdivisionForQuantize,
  totalQuantizeError,
  tripletsClearlyBetter,
  voiceForRecorderKey,
  loadRecordClick,
  saveRecordClick,
  usedVoices,
  usedVoicesInPatterns,
  DRUM_PAD_SLOTS,
  DRUM_PADS,
} from '../src/lib/drum-recorder.ts'
import { emptyPattern, makeBar, setHit, stepsInBar, VOICES } from '../src/lib/rhythm.ts'

const bar4 = makeBar(4, 4, 4)
const barDur = 2 // 120 BPM 4/4

assert.equal(quantizeToStep(0, barDur, 16), 0)
assert.equal(quantizeToStep(barDur - 0.001, barDur, 16), 0, 'late wrap to step 1')
assert.equal(quantizeToStep(barDur, barDur, 16), 0)
assert.equal(quantizeToStep(0.125, barDur, 16), 1, 'exactly one 16th')
assert.equal(quantizeToStep(0.0624, barDur, 16), 0, 'just under half a 16th stays')
assert.equal(quantizeToStep(0.0626, barDur, 16), 1, 'more than half a step late wraps next')

const eighths = makeBar(4, 4, 2)
assert.equal(subdivisionForQuantize('8', eighths), 2)
assert.equal(subdivisionForQuantize('16', eighths), 4)
assert.equal(subdivisionForQuantize('8t', eighths), 3)
assert.equal(subdivisionForQuantize('16t', eighths), 6)
assert.equal(subdivisionForQuantize('off', eighths), 4)
assert.equal(finestEvenSubdivision(2), 4)
assert.equal(finestEvenSubdivision(6), 6)

const nearTriplets = [0, 2 / 3, 4 / 3].map((beats) => beats * (barDur / 4))
assert.equal(tripletsClearlyBetter(nearTriplets, barDur, 16, 12), true)
assert.equal(tripletsClearlyBetter([0, 0.125, 0.25], barDur, 16, 12), false)

const plan = smartQuantizePlan(nearTriplets, bar4, barDur)
assert.equal(plan.offerTriplets, true)
assert.equal(plan.subdivision, 4, 'live Smart stays on the bar grid')
assert.equal(plan.tripletSubdivision, 6)

const evenPlan = smartQuantizePlan([0, 0.125, 0.5], bar4, barDur)
assert.equal(evenPlan.offerTriplets, false)
assert.equal(evenPlan.subdivision, 4)

const offHit = quantizeHit(0.03, eighths, barDur, 'off')
assert.equal(offHit.subdivision, 4)
assert.equal(offHit.step, 0)

const ctx = { currentTime: 1.2, outputLatency: 0.2, baseLatency: 0.01 }
assert.equal(captureAudioTime(ctx), 1.0)
assert.ok(Math.abs(offsetInBar(1.05, 0, 1) - 0.05) < 1e-9)
assert.ok(Math.abs(offsetInBar(2.05, 0, 1) - 0.05) < 1e-9)
assert.ok(offsetInBar(0.97, 1, 2) > 1.8, 'plain wrap sends a slightly-early hit to the last slot')
assert.equal(offsetInBarForPad(0.97, 1, 2), 0, 'pad slop keeps a slightly-early hit on beat 1')
assert.ok(Math.abs(offsetInBarForPad(1.5, 1, 2) - 0.5) < 1e-9)

let racing = makeBar(4, 4, 4)
const hitKick = placeQuantizedHit(racing, 0, barDur, '16', 'kick', 'overdub', new Set(), [0])
racing = hitKick.bar
const hitSnare = placeQuantizedHit(
  racing,
  0.5,
  barDur,
  '16',
  'snare',
  'overdub',
  hitKick.voicesTouched,
  [0, 0.5],
)
assert.equal(hitKick.bar.pattern.kick.length, 1)
assert.equal(hitSnare.bar.pattern.kick.length, 1, 'second pad keeps the first hit')
assert.equal(hitSnare.bar.pattern.snare.length, 1)

let pattern = emptyPattern()
const first = applyPassHit(
  pattern,
  bar4,
  { voice: 'kick', offsetSec: 0, step: 0, subdivision: 4 },
  'replace',
  new Set(),
)
pattern = first.pattern
assert.equal(pattern.kick.length, 1)
pattern = setHit(pattern, 'kick', 4, 4, 4, true)
const second = applyPassHit(
  pattern,
  bar4,
  { voice: 'kick', offsetSec: 0, step: 8, subdivision: 4 },
  'replace',
  new Set(),
)
assert.equal(second.pattern.kick.length, 1, 'replace clears the row on first touch')
assert.equal(
  second.pattern.kick[0] && second.pattern.kick[0].beat * 4 + (second.pattern.kick[0].num === 0 ? 0 : 1),
  second.pattern.kick[0].beat * 4,
)

const overdub = applyPassHit(
  setHit(emptyPattern(), 'snare', 4, 4, 4, true),
  bar4,
  { voice: 'snare', offsetSec: 0, step: 8, subdivision: 4 },
  'overdub',
  new Set(),
)
assert.equal(overdub.pattern.snare.length, 2)

const merged = applyPassHit(
  overdub.pattern,
  bar4,
  { voice: 'snare', offsetSec: 0, step: 8, subdivision: 4 },
  'overdub',
  overdub.voicesTouched,
)
assert.equal(merged.pattern.snare.length, 2, 'duplicate step/row merges')

assert.equal(stepsInBar(bar4), 16)
assert.ok(stepError(0.01, barDur, 16) < stepError(0.06, barDur, 16))
assert.ok(totalQuantizeError([0, 0.125], barDur, 16) < 0.01)

const kickEvent = { repeat: false, metaKey: false, ctrlKey: false, altKey: false, code: 'Space', key: ' ' } as KeyboardEvent
assert.equal(voiceForRecorderKey(kickEvent), 'kick')
const snareJ = { repeat: false, metaKey: false, ctrlKey: false, altKey: false, code: 'KeyJ', key: 'j' } as KeyboardEvent
assert.equal(voiceForRecorderKey(snareJ), 'snare')
const repeat = { ...kickEvent, repeat: true }
assert.equal(voiceForRecorderKey(repeat as KeyboardEvent), null)

assert.equal(shouldUpgradeSubdivision(2, 4), true)
assert.equal(shouldUpgradeSubdivision(4, 2), false)
assert.equal(shouldUpgradeSubdivision(4, 6), true)
assert.equal(stepInSubdivision(1, 2, 4, 4), 2)
assert.equal(stepInSubdivision(3, 2, 4, 4), 6)

const eighthBar = makeBar(4, 4, 2)
const placed16 = placeQuantizedHit(
  eighthBar,
  0.125,
  barDur,
  '16',
  'snare',
  'overdub',
  new Set(),
  [0.125],
)
assert.equal(placed16.bar.subdivision, 4)
assert.equal(placed16.hit.step, 1)

const kept8 = placeQuantizedHit(bar4, 0.5, barDur, '8', 'kick', 'overdub', new Set(), [0.5])
assert.equal(kept8.bar.subdivision, 4, '1/8 quantize does not coarsen a 16th bar')
assert.equal(kept8.hit.step, 4)

const rebuilt = requantizePassTo(
  bar4,
  [{ voice: 'snare', offsetSec: (2 / 3) * (barDur / 4) }],
  barDur,
  6,
  'overdub',
)
assert.equal(rebuilt.bar.subdivision, 6)
assert.equal(rebuilt.hits[0]?.step, 4)

const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  },
})
assert.equal(loadRecordClick(), true)
saveRecordClick(false)
assert.equal(loadRecordClick(), false)
saveRecordClick(true)
assert.equal(loadRecordClick(), true)

assert.equal(DRUM_PAD_SLOTS.length, 15)
assert.equal(DRUM_PAD_SLOTS[2], null, 'top-center spare slot')
assert.deepEqual(
  DRUM_PADS.map((pad) => pad.voice),
  [
    'splash',
    'stack',
    'china',
    'rideBell',
    'crash',
    'rim',
    'highTom',
    'midTom',
    'floorTom',
    'openHat',
    'closedHat',
    'snare',
    'kick',
    'ride',
  ],
)

const empty = emptyPattern()
assert.deepEqual(usedVoices(empty), [])
const withTom = setHit(empty, 'highTom', 0, 4, 4, true)
assert.deepEqual(usedVoices(withTom), ['highTom'])
const withKickTom = setHit(withTom, 'kick', 0, 4, 4, true)
assert.deepEqual(usedVoices(withKickTom), ['kick', 'highTom'], 'kit order, kick before tom')
const barA = makeBar(4, 4, 4)
barA.pattern = setHit(emptyPattern(), 'crash', 0, 4, 4, true)
const barB = makeBar(4, 4, 4)
barB.pattern = setHit(emptyPattern(), 'snare', 4, 4, 4, true)
assert.deepEqual(usedVoicesInPatterns([barA.pattern, barB.pattern]), ['snare', 'crash'])
assert.deepEqual(usedVoicesInPatterns([barA.pattern], new Set(['highTom'])), ['highTom', 'crash'])
assert.deepEqual(VOICES.slice(0, 3), ['kick', 'snare', 'rim'])

console.log('drum-recorder: ok')
