import assert from 'node:assert/strict'

import { parseLayoutMode } from '../src/lib/custom-presets.ts'
import { stringsFromMidis } from '../src/lib/notes.ts'
import { findBuiltinPreset } from '../src/lib/presets.ts'
import { inlineStringsForView } from '../src/lib/inline-layout.ts'

assert.equal(parseLayoutMode('inline'), 'inline')
assert.equal(parseLayoutMode('headstock'), 'headstock')
assert.equal(parseLayoutMode('nope'), 'headstock')
assert.equal(parseLayoutMode(undefined), 'headstock')

const guitar6 = findBuiltinPreset('guitar-6-standard')
assert.ok(guitar6)
const g6 = inlineStringsForView(guitar6.strings)
assert.equal(g6.map((item) => item.label).join(''), 'EADGBE')
assert.deepEqual(
  g6.map((item) => item.midi),
  [40, 45, 50, 55, 59, 64],
)
assert.equal(g6[0]?.stringNo, 6)
assert.equal(g6.at(-1)?.stringNo, 1)

const bass4 = findBuiltinPreset('bass-4')
assert.ok(bass4)
const b4 = inlineStringsForView(bass4.strings)
assert.deepEqual(
  b4.map((item) => item.midi),
  [28, 33, 38, 43],
)
assert.equal(b4[0]?.label, 'E')
assert.equal(b4.at(-1)?.label, 'G')

const guitar8 = findBuiltinPreset('guitar-8')
assert.ok(guitar8)
const g8 = inlineStringsForView(guitar8.strings)
assert.equal(g8.length, 8)
assert.equal(g8[0]?.midi, 30)
assert.equal(g8.at(-1)?.midi, 64)

const guitar10 = findBuiltinPreset('guitar-10')
assert.ok(guitar10)
assert.equal(inlineStringsForView(guitar10.strings).length, 10)

const custom = inlineStringsForView(stringsFromMidis([43, 38, 33, 28]))
assert.deepEqual(
  custom.map((item) => item.midi),
  [28, 33, 38, 43],
)

console.log('tuner-layout: ok')
