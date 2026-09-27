/**
 * Meter denominator is real: BPM is always the quarter note.
 * Run: npx --yes tsx scripts/meter-timing.ts
 */
import {
  barDurationSec,
  beatDurationSec,
  clickPulsesInBar,
  hitTimeInBar,
  makeBar,
  stepDurationSec,
  subdivisionLabel,
  type BeatUnit,
} from '../src/lib/rhythm.ts'

let failed = 0

function assert(condition: unknown, message: string) {
  if (!condition) {
    failed += 1
    console.error(`FAIL  ${message}`)
    return
  }
  console.log(`ok    ${message}`)
}

function nearly(a: number, b: number, eps = 1e-9) {
  return Math.abs(a - b) <= eps
}

const BPM = 120
const Q = 0.5

const cases: Array<{
  beats: number
  unit: BeatUnit
  beat: number
  bar: number
}> = [
  { beats: 4, unit: 4, beat: Q, bar: 2 },
  { beats: 4, unit: 8, beat: Q / 2, bar: 1 },
  { beats: 6, unit: 8, beat: Q / 2, bar: 1.5 },
  { beats: 2, unit: 2, beat: Q * 2, bar: 2 },
  { beats: 4, unit: 16, beat: Q / 4, bar: 0.5 },
  { beats: 3, unit: 8, beat: Q / 2, bar: 0.75 },
]

console.log(`==== beat / bar length @ ${BPM} BPM (quarter = ${Q}s) ====`)
for (const item of cases) {
  const beat = beatDurationSec(BPM, item.unit)
  const bar = barDurationSec(item.beats, BPM, item.unit)
  assert(
    nearly(beat, item.beat) && nearly(bar, item.bar),
    `${item.beats}/${item.unit}  beat ${beat.toFixed(4)}s  bar ${bar.toFixed(4)}s`,
  )
}

assert(
  beatDurationSec(BPM, 8) * 2 === beatDurationSec(BPM, 4),
  '4/8 beats are twice as fast as 4/4 at the same BPM',
)
assert(
  beatDurationSec(BPM, 16) * 4 === beatDurationSec(BPM, 4),
  '4/16 beats are four times as fast as 4/4',
)
assert(beatDurationSec(BPM, 2) / 2 === beatDurationSec(BPM, 4), '2/2 beats are half as fast as 4/4')

console.log('\n==== same click count per beat; step length follows the beat ====')
for (const unit of [2, 4, 8, 16] as const) {
  const bar = makeBar(4, unit, 2)
  const pulses = clickPulsesInBar(bar, BPM)
  assert(pulses.length === 8, `4/${unit} with 2-subdiv still has 8 clicks`)
  const step = stepDurationSec(BPM, 2, unit)
  assert(nearly(step, beatDurationSec(BPM, unit) / 2), `4/${unit} 2-subdiv step is half a beat`)
  assert(nearly(pulses[1].offsetSec, step), `4/${unit} second click sits on the first off-beat`)
}

const drums48 = makeBar(4, 8, 4)
assert(
  nearly(hitTimeInBar({ beat: 1, num: 0, den: 4 }, BPM, 8), beatDurationSec(BPM, 8)),
  'drums 4/8: beat 2 lands at 0.25s',
)
assert(
  nearly(hitTimeInBar({ beat: 0, num: 1, den: 4 }, BPM, 8), beatDurationSec(BPM, 8) / 4),
  'drums 4/8: first 32nd after the downbeat is 0.0625s',
)

console.log('\n==== subdivision labels follow the denominator ====')
assert(subdivisionLabel(1, 4) === 'quarter note', `4/4 beat: ${subdivisionLabel(1, 4)}`)
assert(subdivisionLabel(2, 4) === 'eighth notes', `4/4 2-sub: ${subdivisionLabel(2, 4)}`)
assert(subdivisionLabel(3, 4) === 'eighth-note triplets', `4/4 trip: ${subdivisionLabel(3, 4)}`)
assert(subdivisionLabel(4, 4) === 'sixteenth notes', `4/4 4-sub: ${subdivisionLabel(4, 4)}`)
assert(subdivisionLabel(1, 8) === 'eighth note', `4/8 beat: ${subdivisionLabel(1, 8)}`)
assert(subdivisionLabel(2, 8) === 'sixteenth notes', `4/8 2-sub: ${subdivisionLabel(2, 8)}`)
assert(subdivisionLabel(3, 8) === 'sixteenth-note triplets', `4/8 trip: ${subdivisionLabel(3, 8)}`)
assert(subdivisionLabel(4, 8) === '32nd notes', `4/8 4-sub: ${subdivisionLabel(4, 8)}`)
assert(subdivisionLabel(5, 8).includes('sixteenth'), `4/8 5: ${subdivisionLabel(5, 8)}`)
assert(subdivisionLabel(1, 2) === 'half note', `2/2 beat: ${subdivisionLabel(1, 2)}`)
assert(subdivisionLabel(2, 2) === 'quarter notes', `2/2 2-sub: ${subdivisionLabel(2, 2)}`)
assert(subdivisionLabel(4, 2) === 'eighth notes', `2/2 4-sub: ${subdivisionLabel(4, 2)}`)
assert(subdivisionLabel(4, 16) === '64th notes', `4/16 4-sub: ${subdivisionLabel(4, 16)}`)
assert(subdivisionLabel(1, 16) === 'sixteenth note', `4/16 beat: ${subdivisionLabel(1, 16)}`)
assert(subdivisionLabel(1, 32) === '32nd note', `4/32 beat: ${subdivisionLabel(1, 32)}`)

console.log('\n==== Speed Builder / tap stay on quarter-note BPM ====')
assert(nearly(beatDurationSec(180, 8), (60 / 180) * (4 / 8)), '180 BPM in /8 still uses quarter = 60/180')
assert(nearly(beatDurationSec(60, 2), 2), '60 BPM in /2 is a 2s half note (quarter = 1s)')

if (failed) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nall meter timing checks passed')
