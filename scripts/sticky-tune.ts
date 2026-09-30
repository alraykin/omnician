import assert from 'node:assert/strict'

import { STICKY_HOLD_MS } from '../src/lib/feel.ts'
import { pegTone } from '../src/lib/peg-style.ts'
import { findBuiltinPreset } from '../src/lib/presets.ts'
import {
  allStringsSticky,
  indexForStringNo,
  parseFocusStringNo,
  seedTunedIds,
  STICKY_HOLD_MS as LIB_HOLD,
} from '../src/lib/sticky-tune.ts'

assert.equal(STICKY_HOLD_MS, 1500)
assert.equal(LIB_HOLD, 1500)
assert.ok(STICKY_HOLD_MS >= 1000 && STICKY_HOLD_MS <= 2000)

const guitar = findBuiltinPreset('guitar-6-standard')
assert.ok(guitar)
const strings = guitar.strings
assert.equal(strings.length, 6)

const empty = new Set<string>()
const first = strings[0]
assert.ok(first)

assert.equal(pegTone(first.id, first.id, empty, false, true), 'red')
assert.equal(pegTone(first.id, first.id, empty, true, true), 'green')
assert.equal(pegTone(first.id, first.id, empty, false, false), 'selected')
assert.equal(pegTone(first.id, null, empty, false, true), 'idle')

const locked = new Set([first.id])
assert.equal(
  pegTone(first.id, first.id, locked, false, true),
  'sticky',
  'locked selected string stays green when the live reading is off-pitch',
)
assert.equal(pegTone(first.id, first.id, locked, true, true), 'sticky')
assert.equal(pegTone(first.id, strings[1]?.id ?? null, locked, false, true), 'sticky')

const partial = seedTunedIds(strings, '3')
assert.equal(partial.size, 3)
assert.ok(partial.has(strings[0].id))
assert.ok(partial.has(strings[1].id))
assert.ok(partial.has(strings[2].id))
assert.ok(!partial.has(strings[3].id))
assert.equal(allStringsSticky(strings, partial), false)

const all = seedTunedIds(strings, 'all')
assert.equal(all.size, 6)
assert.equal(allStringsSticky(strings, all), true)
assert.equal(allStringsSticky([], all), false)

const byNo = seedTunedIds(strings, '6,5')
assert.equal(byNo.size, 2)
assert.ok(byNo.has(strings[0].id))

assert.equal(parseFocusStringNo('3'), 3)
assert.equal(parseFocusStringNo(''), null)
assert.equal(indexForStringNo(strings, 3), 3)
assert.equal(strings[3]?.label, 'G')

console.log('sticky-tune: ok')
