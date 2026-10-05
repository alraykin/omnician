import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  beatBoxView,
  coarsestDivision,
  exampleBarHitSeconds,
  hitForInputSlot,
  hitFromBarOffset,
  evenBeatChunks,
  INPUT_CHIPS,
  kitBeatBlocks,
  kitBlockColumns,
  kitRowCount,
  SLOT_MIN_PX,
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
assert.equal(eighths.division, 4, 'selected 1/16 stays 4 slots even when hits are 8ths')
assert.equal(eighths.empty, false)
assert.equal(eighths.slots.length, 4)
assert.deepEqual(
  eighths.slots.map((slot) => slot.filled),
  [true, false, true, false],
)

const downbeat = beatBoxView([reduceHit(0, 0, 1)], 0, 4)
assert.equal(downbeat.division, 4, 'a kick on 1 does not coarsen to one long pill')
assert.equal(downbeat.slots.length, 4)
assert.deepEqual(
  downbeat.slots.map((slot) => slot.filled),
  [true, false, false, false],
)
assert.equal(downbeat.dots, false)

const empty = beatBoxView([], 2, 3)
assert.equal(empty.empty, true)
assert.equal(empty.division, 3)
assert.equal(empty.triplet, true)
assert.equal(empty.slots.length, 3)

const empty16 = beatBoxView([], 1, 4)
assert.equal(empty16.division, 4)
assert.equal(empty16.slots.length, 4)
assert.equal(empty16.empty, true)

let pattern = makeBeatBoxesExampleBar().pattern
pattern = toggleHitPos(pattern, 'closedHat', hitForInputSlot(0, 1, 4))
const after = beatBoxView(pattern.closedHat, 0, 4)
assert.equal(after.division, 4, 'adding a 16th into 8ths stays 4 slots')
assert.equal(after.slots.filter((slot) => slot.filled).length, 3)

const tripOnSixteenths = beatBoxView([reduceHit(0, 1, 3)], 0, 4)
assert.equal(tripOnSixteenths.division, 4)
assert.equal(tripOnSixteenths.slots.length, 4)
assert.equal(tripOnSixteenths.dots, true)
assert.deepEqual(tripOnSixteenths.dotsAt, [1 / 3])

const third = snapBeatFraction(1 / 3)
assert.equal(third.hit.num / third.hit.den, 1 / 3)
const mixed = snapBeatFraction(1 / 12)
assert.equal(mixed.hit.num / mixed.hit.den, 1 / 12)

const barDur = barDurationSec(4, 120, 4)
const tripHit = hitFromBarOffset(barDur * (1 / 3 / 4), barDur, 4)
assert.equal(tripHit.beat, 0)
assert.equal(tripHit.num / tripHit.den, 1 / 3)

const example = makeBeatBoxesExampleBar()
assert.equal(beatBoxView(example.pattern.closedHat, 0, 4).division, 4)
assert.deepEqual(
  beatBoxView(example.pattern.closedHat, 0, 4).slots.map((slot) => slot.filled),
  [true, false, true, false],
)
assert.equal(beatBoxView(example.pattern.closedHat, 3, 4).division, 4)
assert.equal(beatBoxView(example.pattern.snare, 2, 4).division, 4)
assert.equal(beatBoxView(example.pattern.snare, 2, 4).dots, true)
assert.equal(beatBoxView(example.pattern.kick, 2, 4).division, 4)
assert.deepEqual(
  beatBoxView(example.pattern.kick, 0, 4).slots.map((slot) => slot.filled),
  [true, false, false, false],
)
assert.equal(beatBoxView(example.pattern.highTom, 3, 4).division, 4)
assert.equal(beatBoxView(example.pattern.highTom, 3, 4).slots[0]?.filled, true)
assert.equal(beatBoxView(example.pattern.midTom, 3, 4).division, 4)
assert.equal(beatBoxView(example.pattern.midTom, 3, 4).dots, true)
assert.equal(beatBoxView(example.pattern.floorTom, 3, 4).dots, true)
assert.equal(beatBoxView(example.pattern.floorTom, 3, 3).triplet, true)
assert.equal(beatBoxView(example.pattern.floorTom, 3, 3).division, 3)

const gridSrc = readFileSync(new URL('../src/components/rhythm/DrumGrid.tsx', import.meta.url), 'utf8')
assert.match(gridSrc, /data-hit-dot/)
assert.match(gridSrc, /data-hit-align="start"/)
assert.match(gridSrc, /aspect-square h-auto w-3 max-w-full/)
assert.match(gridSrc, /bg-\[#6D28D9\]\/50/)
assert.match(gridSrc, /justify-start/)
assert.match(gridSrc, /pl-\[2px\]/)
assert.match(gridSrc, /overflow-hidden/)
assert.match(gridSrc, /data-beat-label/)
assert.match(gridSrc, /text-left tabular-nums/)
assert.doesNotMatch(gridSrc, /justify-center/)
assert.doesNotMatch(gridSrc, /text-center/)
assert.doesNotMatch(gridSrc, /pl-\[3px\]/)
assert.match(gridSrc, /relative flex w-full min-w-0 gap-0.5/)
assert.doesNotMatch(gridSrc, /view\.division === 1/)
assert.match(gridSrc, /data-beats-per-row/)
assert.match(gridSrc, /data-kit-block/)
assert.match(gridSrc, /data-kit-blocks/)
assert.match(gridSrc, /data-kit-track/)
assert.match(gridSrc, /ResizeObserver/)
assert.match(gridSrc, /kitBeatBlocks\(\{ beats, input, trackPx \}\)/)
assert.doesNotMatch(gridSrc, /overflow-y-auto/)
assert.doesNotMatch(gridSrc, /max-h-\[min\(34vh/)
assert.doesNotMatch(gridSrc, /bg-\[#A855F7\]\/8/)
assert.deepEqual(
  INPUT_CHIPS.map((chip) => chip.id),
  [2, 3, 4, 6],
)
assert.match(gridSrc, /SubdivIcon/)
assert.match(gridSrc, /subdivisionLabel/)
assert.match(gridSrc, /data-subdivision-label/)
assert.match(gridSrc, /data-drum-beat-unit/)
assert.doesNotMatch(gridSrc, /1\/8T/)
assert.doesNotMatch(gridSrc, /1\/16T/)

const PHONE = 330
const DESK = 900

assert.equal(SLOT_MIN_PX, 28)
assert.deepEqual(evenBeatChunks(6, 2), [
  { index: 0, start: 0, count: 3 },
  { index: 1, start: 3, count: 3 },
])
assert.deepEqual(evenBeatChunks(8, 2), [
  { index: 0, start: 0, count: 4 },
  { index: 1, start: 4, count: 4 },
])
assert.deepEqual(evenBeatChunks(5, 2), [
  { index: 0, start: 0, count: 3 },
  { index: 1, start: 3, count: 2 },
])
assert.deepEqual(evenBeatChunks(7, 2), [
  { index: 0, start: 0, count: 4 },
  { index: 1, start: 4, count: 3 },
])
assert.deepEqual(evenBeatChunks(13, 3), [
  { index: 0, start: 0, count: 5 },
  { index: 1, start: 5, count: 4 },
  { index: 2, start: 9, count: 4 },
])

assert.equal(kitRowCount({ beats: 4, input: 2, trackPx: PHONE }), 1)
assert.equal(kitRowCount({ beats: 4, input: 4, trackPx: PHONE }), 2)
assert.equal(kitRowCount({ beats: 6, input: 6, trackPx: PHONE }), 2)
assert.equal(kitRowCount({ beats: 7, input: 2, trackPx: DESK }), 2)
assert.equal(kitRowCount({ beats: 13, input: 2, trackPx: DESK }), 3)

assert.deepEqual(kitBeatBlocks({ beats: 4, input: 2, trackPx: PHONE }), [
  { index: 0, start: 0, count: 4 },
])
assert.deepEqual(kitBeatBlocks({ beats: 6, input: 2, trackPx: DESK }), [
  { index: 0, start: 0, count: 6 },
])
assert.deepEqual(kitBeatBlocks({ beats: 6, input: 6, trackPx: PHONE }), [
  { index: 0, start: 0, count: 3 },
  { index: 1, start: 3, count: 3 },
])
assert.deepEqual(kitBeatBlocks({ beats: 4, input: 6, trackPx: PHONE }), [
  { index: 0, start: 0, count: 2 },
  { index: 1, start: 2, count: 2 },
])
assert.deepEqual(kitBeatBlocks({ beats: 4, input: 4, trackPx: PHONE }), [
  { index: 0, start: 0, count: 2 },
  { index: 1, start: 2, count: 2 },
])
assert.deepEqual(kitBeatBlocks({ beats: 5, input: 6, trackPx: PHONE }), [
  { index: 0, start: 0, count: 3 },
  { index: 1, start: 3, count: 2 },
])
assert.deepEqual(kitBeatBlocks({ beats: 7, input: 4, trackPx: DESK }), [
  { index: 0, start: 0, count: 4 },
  { index: 1, start: 4, count: 3 },
])
assert.deepEqual(kitBeatBlocks({ beats: 8, input: 2, trackPx: DESK }), [
  { index: 0, start: 0, count: 4 },
  { index: 1, start: 4, count: 4 },
])
assert.deepEqual(kitBeatBlocks({ beats: 9, input: 2, trackPx: DESK }), [
  { index: 0, start: 0, count: 5 },
  { index: 1, start: 5, count: 4 },
])
assert.equal(kitBeatBlocks({ beats: 12, input: 2, trackPx: DESK }).length, 2)
assert.equal(kitBeatBlocks({ beats: 13, input: 2, trackPx: DESK }).length, 3)
assert.equal(
  kitBlockColumns(kitBeatBlocks({ beats: 4, input: 2, trackPx: PHONE })),
  4,
)
assert.equal(
  kitBlockColumns(kitBeatBlocks({ beats: 6, input: 6, trackPx: PHONE })),
  3,
)
assert.equal(
  kitBlockColumns(kitBeatBlocks({ beats: 7, input: 4, trackPx: DESK })),
  4,
)
assert.equal(
  kitBlockColumns(kitBeatBlocks({ beats: 5, input: 6, trackPx: PHONE })),
  3,
)

console.log('beat-boxes: ok')

const times = exampleBarHitSeconds(120)
const kick = times.filter((item) => item.voice === 'kick').map((item) => item.sec)
assert.deepEqual(
  kick.map((sec) => Math.round(sec * 1000)),
  [0, 750, 1375],
)
assert.equal(Math.round(hitTimeInBar(example.pattern.snare[1]!, 120, 4) * 1000), 1333)

console.log('beat-boxes: ok')
