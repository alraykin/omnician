import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  beatBoxView,
  coarsestDivision,
  exampleBarHitSeconds,
  hitForInputSlot,
  hitFromBarOffset,
  makeBeatBoxesExampleBar,
  snapBeatFraction,
} from '../src/lib/beat-boxes.ts'
import { barDurationSec, hitTimeInBar, reduceHit, toggleHitPos } from '../src/lib/rhythm.ts'

assert.equal(coarsestDivision([reduceHit(0, 0, 1)]), 1)
assert.equal(coarsestDivision([reduceHit(0, 0, 2), reduceHit(0, 1, 2)]), 2)
assert.equal(coarsestDivision([reduceHit(0, 1, 4)]), 4)
assert.equal(coarsestDivision([reduceHit(0, 2, 3)]), 3)
assert.equal(coarsestDivision([reduceHit(0, 1, 6)]), 6)
assert.equal(coarsestDivision([reduceHit(0, 1, 4), reduceHit(0, 1, 3)]), 12)
assert.equal(coarsestDivision([reduceHit(0, 1, 5)]), -1)
assert.equal(coarsestDivision([]), 0)

const eighths = beatBoxView([reduceHit(0, 0, 2), reduceHit(0, 1, 2)], 0, 4)
assert.equal(eighths.division, 2)
assert.equal(eighths.empty, false)
assert.deepEqual(
  eighths.slots.map((slot) => slot.filled),
  [true, true],
)

const empty = beatBoxView([], 2, 3)
assert.equal(empty.empty, true)
assert.equal(empty.division, 3)
assert.equal(empty.triplet, true)
assert.equal(empty.slots.length, 3)

let pattern = makeBeatBoxesExampleBar().pattern
pattern = toggleHitPos(pattern, 'closedHat', hitForInputSlot(0, 1, 4))
const after = beatBoxView(pattern.closedHat, 0, 4)
assert.equal(after.division, 4, 'adding a 16th into 8ths becomes 4 slots')
assert.equal(after.slots.filter((slot) => slot.filled).length, 3)

const third = snapBeatFraction(1 / 3)
assert.equal(third.hit.num / third.hit.den, 1 / 3)
const mixed = snapBeatFraction(1 / 12)
assert.equal(mixed.hit.num / mixed.hit.den, 1 / 12)

const barDur = barDurationSec(4, 120, 4)
const tripHit = hitFromBarOffset(barDur * (1 / 3 / 4), barDur, 4)
assert.equal(tripHit.beat, 0)
assert.equal(tripHit.num / tripHit.den, 1 / 3)

const example = makeBeatBoxesExampleBar()
assert.equal(beatBoxView(example.pattern.closedHat, 0, 4).division, 2)
assert.equal(beatBoxView(example.pattern.closedHat, 3, 4).division, 4)
assert.equal(beatBoxView(example.pattern.snare, 2, 4).division, 3)
assert.equal(beatBoxView(example.pattern.kick, 2, 4).division, 4)
assert.equal(beatBoxView(example.pattern.highTom, 3, 4).division, 1)
assert.equal(beatBoxView(example.pattern.midTom, 3, 4).triplet, true)
assert.equal(beatBoxView(example.pattern.floorTom, 3, 4).triplet, true)

const gridSrc = readFileSync(new URL('../src/components/rhythm/DrumGrid.tsx', import.meta.url), 'utf8')
assert.match(gridSrc, /data-hit-dot/)
assert.match(gridSrc, /data-hit-align="start"/)
assert.match(gridSrc, /size-3 shrink-0 rounded-full/)
assert.match(gridSrc, /bg-\[#6D28D9\]\/50/)
assert.match(gridSrc, /justify-start/)
assert.match(gridSrc, /pl-\[3px\]/)
assert.match(gridSrc, /data-beat-label/)
assert.match(gridSrc, /text-left tabular-nums/)
assert.doesNotMatch(gridSrc, /justify-center/)
assert.doesNotMatch(gridSrc, /text-center/)

console.log('beat-boxes: ok')

const times = exampleBarHitSeconds(120)
const kick = times.filter((item) => item.voice === 'kick').map((item) => item.sec)
assert.deepEqual(
  kick.map((sec) => Math.round(sec * 1000)),
  [0, 750, 1375],
)
assert.equal(Math.round(hitTimeInBar(example.pattern.snare[1]!, 120, 4) * 1000), 1333)

console.log('beat-boxes: ok')
