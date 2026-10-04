import assert from 'node:assert/strict'

import {
  addPickupKick,
  autoCompleteBars,
  detectFillFeel,
  fillStartBeat,
  makeFillBar,
  needsOverwriteConfirm,
  nextFillVariant,
  replaceFillBar,
  seedBars,
} from '../src/lib/auto-complete.ts'
import { BAR_LONG_PRESS_MS } from '../src/lib/bar-press.ts'
import {
  cloneBar,
  makeBar,
  patternsEqual,
  reduceHit,
  sameHit,
  setHitPos,
  type RhythmBar,
} from '../src/lib/rhythm.ts'
import { barsForPreset, findPreset } from '../src/lib/rhythm-presets.ts'

assert.equal(BAR_LONG_PRESS_MS, 450)

const rock = findPreset('rock-44')
assert.ok(rock)
const rockSeed = [cloneBar(barsForPreset(rock)[0]!)]
assert.equal(rockSeed[0]!.beats, 4)
assert.equal(rockSeed[0]!.beatUnit, 4)
assert.equal(detectFillFeel(rockSeed), 'straight16')
assert.equal(needsOverwriteConfirm(rockSeed), false)

const completed = autoCompleteBars(rockSeed)
assert.equal(completed.length, 8)
assert.ok(patternsEqual(completed[0]!.pattern, rockSeed[0]!.pattern), 'bar 1 stays the seed')
assert.equal(completed[0]!.beats, 4)
assert.equal(completed[4]!.pattern.crash.some((hit) => sameHit(hit, reduceHit(0, 0, 1))), true, 'bar 5 crash')
assert.ok(
  completed[3]!.pattern.kick.length > rockSeed[0]!.pattern.kick.length,
  'bar 4 adds a pickup kick',
)
assert.ok(completed[6]!.pattern.openHat.length >= 1, 'bar 7 keeps a phrase-end open hat')

const fill = completed[7]!
assert.equal(fill.beats, 4)
assert.equal(fillStartBeat(rockSeed[0]!, 0), 2)
assert.ok(fill.pattern.highTom.length + fill.pattern.midTom.length + fill.pattern.floorTom.length >= 6)
assert.ok(
  fill.pattern.highTom.every((hit) => hit.den === 4 || hit.beat >= 2),
  '16th tom fill lives on the last beats',
)
assert.equal(fill.pattern.crash.length, 0, 'fill has no crash')

const again = autoCompleteBars(rockSeed)
assert.ok(patternsEqual(again[7]!.pattern, fill.pattern), 'deterministic fill')

const other = replaceFillBar(completed, nextFillVariant(0))
assert.equal(other.length, 8)
assert.ok(patternsEqual(other[0]!.pattern, completed[0]!.pattern))
assert.ok(!patternsEqual(other[7]!.pattern, fill.pattern), 'try another fill changes bar 8 only')
for (let index = 0; index < 7; index += 1) {
  assert.ok(patternsEqual(other[index]!.pattern, completed[index]!.pattern))
}

const tripPattern = setHitPos(
  setHitPos(makeBar(4, 4, 3).pattern, 'kick', reduceHit(0, 0, 1), true),
  'snare',
  reduceHit(1, 0, 1),
  true,
)
const tripSeed = [makeBar(4, 4, 3, tripPattern)]
assert.equal(detectFillFeel(tripSeed), 'triplet')
const tripFill = makeFillBar(tripSeed, 0)
assert.ok(
  [...tripFill.pattern.highTom, ...tripFill.pattern.midTom, ...tripFill.pattern.floorTom].some(
    (hit) => hit.den === 3,
  ),
  'triplet seed writes a triplet fill',
)

const five = makeBar(5, 4, 4)
const fiveSeed: RhythmBar[] = [
  makeBar(
    5,
    4,
    4,
    setHitPos(setHitPos(five.pattern, 'kick', reduceHit(0, 0, 1), true), 'snare', reduceHit(2, 0, 1), true),
  ),
]
const fiveOut = autoCompleteBars(fiveSeed)
assert.ok(fiveOut.every((bar) => bar.beats === 5 && bar.beatUnit === 4))
assert.equal(fiveOut[7]!.beats, 5)

const factory = barsForPreset(rock)
assert.equal(needsOverwriteConfirm(factory), true)
assert.equal(seedBars(factory).length, 8)

const pickup = addPickupKick(rockSeed[0]!)
assert.ok(pickup.pattern.kick.some((hit) => sameHit(hit, reduceHit(3, 1, 2))))

const emptyFour = [makeBar(4, 4, 4), makeBar(4, 4, 4), makeBar(4, 4, 4), makeBar(4, 4, 4)]
emptyFour[0] = rockSeed[0]!
assert.equal(seedBars(emptyFour).length, 1)
assert.equal(needsOverwriteConfirm(emptyFour), false)

console.log('auto-complete: ok')
