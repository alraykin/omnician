import assert from 'node:assert/strict'

import {
  A4_PRESETS,
  A4_RANGE,
  clampA4,
  parseDisplayMode,
  stepA4,
} from '../src/lib/custom-presets.ts'
import { A4_HZ, centsBetween, midiToFreq } from '../src/lib/notes.ts'

assert.equal(A4_RANGE.min, 415)
assert.equal(A4_RANGE.max, 466)
assert.equal(clampA4(440), 440)
assert.equal(clampA4(414), 415)
assert.equal(clampA4(467), 466)
assert.equal(clampA4('nope'), A4_HZ)
assert.equal(stepA4(440, 1), 441)
assert.equal(stepA4(440, -1), 439)
assert.equal(stepA4(415, -1), 415)
assert.equal(stepA4(466, 1), 466)

const presets = A4_PRESETS.map((item) => item.hz)
assert.deepEqual(presets, [415, 432, 440, 442, 443, 444])
assert.equal(A4_PRESETS[0].hint, 'Baroque')

const a4 = 442
const e2 = midiToFreq(40, a4)
assert.ok(Math.abs(e2 - a4 * 2 ** ((40 - 69) / 12)) < 1e-9)
assert.equal(Math.round(centsBetween(e2, 40, a4) * 10) / 10, 0)

const concertE = midiToFreq(40, 440)
const centsAt442 = centsBetween(concertE, 40, 442)
assert.ok(centsAt442 < -5, `concert E should read flat at A4=442, got ${centsAt442}`)

const baroqueA = midiToFreq(69, 415)
assert.equal(baroqueA, 415)
assert.ok(Math.abs(centsBetween(440, 69, 415)) > 90)

assert.equal(parseDisplayMode('target'), 'target')
assert.equal(parseDisplayMode('strobe'), 'strobe')
assert.equal(parseDisplayMode('nope'), 'strobe')

console.log('a4-reference: 16 checks ok')
