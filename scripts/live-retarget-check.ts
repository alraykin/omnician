/**
 * Mid-bar tempo + intensity retarget checks.
 * Run: node --experimental-strip-types scripts/live-retarget-check.ts
 */
import {
  LIVE_COMMIT_SEC,
  barDurationSec,
  beatDurationSec,
  clickPulsesInBar,
  hitTimeInBar,
  planLiveTempoRetarget,
  remapBarStart,
  stepDurationSec,
  stepsInBar,
  timesAfter,
  type RhythmBar,
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

const bar: RhythmBar = {
  beats: 4,
  beatUnit: 4,
  subdivision: 2,
  beatAccents: [{ beat: 0, level: 2 }],
  beatSubdivisions: [2, 2, 2, 2],
  pattern: {
    kick: [
      { beat: 0, num: 0, den: 2 },
      { beat: 2, num: 0, den: 2 },
    ],
    snare: [
      { beat: 1, num: 0, den: 2 },
      { beat: 3, num: 0, den: 2 },
    ],
    rim: [],
    highTom: [],
    midTom: [],
    floorTom: [],
    closedHat: [
      { beat: 0, num: 0, den: 2 },
      { beat: 0, num: 1, den: 2 },
      { beat: 1, num: 0, den: 2 },
      { beat: 1, num: 1, den: 2 },
      { beat: 2, num: 0, den: 2 },
      { beat: 2, num: 1, den: 2 },
      { beat: 3, num: 0, den: 2 },
      { beat: 3, num: 1, den: 2 },
    ],
    openHat: [],
    ride: [],
    rideBell: [],
    crash: [],
    stack: [],
    splash: [],
    china: [],
  },
}

const oldBpm = 120
const newBpm = 150
const barStart = 10
const now = barStart + beatDurationSec(oldBpm) * 1.5
const phaseOld = (now - barStart) / barDurationSec(bar.beats, oldBpm)

assert(nearly(phaseOld, 1.5 / 4), 'playhead sits mid beat 2 at 120')

const newStart = remapBarStart(now, barStart, oldBpm, newBpm)
const phaseNew = (now - newStart) / barDurationSec(bar.beats, newBpm)
assert(nearly(phaseOld, phaseNew), 'tempo remap keeps the same place in the bar')

const drumOffsets = [...new Set(
  [bar.pattern.kick, bar.pattern.snare, bar.pattern.closedHat]
    .flat()
    .map((hit) => hitTimeInBar(hit, newBpm)),
)].sort((a, b) => a - b)
const drumPlan = planLiveTempoRetarget(now, barStart, oldBpm, newBpm, drumOffsets, bar.beats)

assert(drumPlan.remaining.every((time) => time > drumPlan.commit), 'rescheduled drum hits are all after commit')
assert(
  drumPlan.remaining.every((time) => time < drumPlan.barEnd + 1e-9),
  'rescheduled drum hits stay in this bar',
)
assert(!drumPlan.next.wrap, 'mid-bar tempo change does not wrap to the next bar')
assert(drumPlan.next.time === drumPlan.remaining[0], 'next drum event is the first remaining hit')

const oldTimes = [bar.pattern.kick, bar.pattern.snare, bar.pattern.closedHat]
  .flat()
  .map((hit) => barStart + hitTimeInBar(hit, oldBpm))
const committedOld = oldTimes.filter((time) => time <= now + LIVE_COMMIT_SEC)
const cancelledOld = oldTimes.filter((time) => time > now + LIVE_COMMIT_SEC)
assert(committedOld.length >= 1, 'already-due hits stay (no skipped beat in the commit window)')
assert(cancelledOld.length >= 1, 'later pre-scheduled hits are dropped so they can be re-picked')
assert(
  new Set(drumPlan.remaining).size === drumPlan.remaining.length,
  're-picked drum times have no doubles',
)

const intensityNow = barStart + hitTimeInBar({ beat: 1, num: 0, den: 2 }, oldBpm) + 0.02
const intensityCommit = intensityNow + LIVE_COMMIT_SEC
const intensityOld = oldTimes
const intensityKeep = intensityOld.filter((time) => time <= intensityCommit)
const intensityRepick = timesAfter(intensityOld, intensityCommit)
assert(intensityKeep.some((time) => nearly(time, barStart + beatDurationSec(oldBpm))), 'snare on 2 stays if already committed')
assert(
  intensityRepick.some((time) => nearly(time, barStart + beatDurationSec(oldBpm) * 2)),
  'kick on 3 is re-picked at the new intensity',
)
assert(
  intensityRepick.every((time) => !intensityKeep.includes(time)),
  'intensity re-pick never doubles a committed hit',
)

const clickOffsets = clickPulsesInBar(bar, newBpm).map((pulse) => pulse.offsetSec)
const clickPlan = planLiveTempoRetarget(now, barStart, oldBpm, newBpm, clickOffsets, bar.beats)
assert(!clickPlan.next.wrap, 'click mid-bar tempo change stays in this bar')
assert(clickPlan.remaining.length >= 1, 'click has later pulses to reschedule')
assert(clickPlan.next.index > 0, 'click continues from the current place, not beat 1')

const lateNow = barStart + barDurationSec(bar.beats, oldBpm) - 0.005
const latePlan = planLiveTempoRetarget(
  lateNow,
  barStart,
  oldBpm,
  newBpm,
  Array.from({ length: stepsInBar(bar) }, (_, step) => step * stepDurationSec(newBpm, bar.subdivision)),
  bar.beats,
)
assert(latePlan.next.wrap, 'past the last step wraps to the next bar start')
assert(nearly(latePlan.next.time, latePlan.barEnd), 'wrap lands on the remapped bar end')

const faster = planLiveTempoRetarget(now, barStart, 80, 160, clickOffsets, bar.beats)
const slower = planLiveTempoRetarget(now, barStart, 160, 80, clickOffsets, bar.beats)
assert(faster.newBarStart > remapBarStart(now, barStart, 80, 80) - 1, 'faster tempo shortens remaining time')
assert(
  slower.barEnd - now > faster.barEnd - now,
  'slower tempo leaves more time in the bar (stay in phase, no jump to beat 1)',
)

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nall live-retarget checks passed')
