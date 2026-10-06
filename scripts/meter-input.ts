import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  BEAT_UNITS,
  MAX_BEATS,
  MIN_BEATS,
  parseMeterBeatUnit,
  parseMeterBeats,
  snapBeatUnit,
} from '../src/lib/rhythm.ts'

assert.equal(parseMeterBeats(''), null)
assert.equal(parseMeterBeats('  '), null)
assert.equal(parseMeterBeats('4'), 4)
assert.equal(parseMeterBeats('1'), MIN_BEATS)
assert.equal(parseMeterBeats('0'), MIN_BEATS)
assert.equal(parseMeterBeats('30'), MAX_BEATS)
assert.equal(parseMeterBeats('99'), MAX_BEATS)
assert.equal(parseMeterBeats('7'), 7)

assert.equal(parseMeterBeatUnit(''), null)
assert.equal(parseMeterBeatUnit('4'), 4)
assert.equal(parseMeterBeatUnit('2'), 2)
assert.equal(parseMeterBeatUnit('8'), 8)
assert.equal(parseMeterBeatUnit('16'), 16)
assert.equal(parseMeterBeatUnit('32'), 32)
assert.equal(parseMeterBeatUnit('3'), 2)
assert.equal(parseMeterBeatUnit('5'), 4)
assert.equal(parseMeterBeatUnit('12'), 8)
assert.equal(parseMeterBeatUnit('20'), 16)
assert.equal(parseMeterBeatUnit('28'), 32)
assert.deepEqual(BEAT_UNITS, [2, 4, 8, 16, 32])
assert.equal(snapBeatUnit(Number.NaN), 4)

const meterSrc = readFileSync(new URL('../src/components/rhythm/CompactMeter.tsx', import.meta.url), 'utf8')
assert.match(meterSrc, /data-meter-edit/)
assert.match(meterSrc, /inputMode="numeric"/)
assert.match(meterSrc, /pattern="\[0-9\]\*"/)
assert.match(meterSrc, /node\.select/)
assert.match(meterSrc, /Escape/)
assert.match(meterSrc, /Enter/)
assert.match(meterSrc, /onBlur/)
assert.match(meterSrc, /parseMeterBeats/)
assert.match(meterSrc, /parseMeterBeatUnit/)
assert.match(meterSrc, /Decrease \$\{label\}/)
assert.match(meterSrc, /Increase \$\{label\}/)

console.log('meter-input: ok')
