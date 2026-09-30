import assert from 'node:assert/strict'

import { parseLayoutMode } from '../src/lib/custom-presets.ts'
import { INLINE_EDGE_DEG, inlinePegsFromTip } from '../src/lib/inline-layout.ts'
import { findBuiltinPreset } from '../src/lib/presets.ts'

assert.equal(parseLayoutMode('inline'), 'inline')
assert.equal(parseLayoutMode('headstock'), 'headstock')
assert.equal(parseLayoutMode('nope'), 'headstock')
assert.equal(INLINE_EDGE_DEG, 16)

const guitar6 = findBuiltinPreset('guitar-6-standard')
assert.ok(guitar6)
const g6 = inlinePegsFromTip(guitar6.strings)
assert.deepEqual(
  g6.map((item) => item.stringNo),
  [1, 2, 3, 4, 5, 6],
)
assert.equal(g6[0]?.label, 'E')
assert.equal(g6.at(-1)?.midi, 40)

const guitar7 = findBuiltinPreset('guitar-7')
assert.ok(guitar7)
assert.equal(inlinePegsFromTip(guitar7.strings).at(-1)?.midi, 35)

const guitar8 = findBuiltinPreset('guitar-8')
assert.ok(guitar8)
assert.equal(inlinePegsFromTip(guitar8.strings).length, 8)
assert.equal(inlinePegsFromTip(guitar8.strings).at(-1)?.midi, 30)

const bass4 = findBuiltinPreset('bass-4')
assert.ok(bass4)
const b4 = inlinePegsFromTip(bass4.strings)
assert.equal(b4[0]?.label, 'G')
assert.equal(b4.at(-1)?.label, 'E')

console.log('tuner-layout: ok')
