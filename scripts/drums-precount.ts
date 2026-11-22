/**
 * Regular Drums precount shares the Speed Builder switch.
 * Visual step index must match the audible step across count-in and wrap.
 * Run: npx --yes tsx scripts/drums-precount.ts
 */
import { readFileSync } from 'node:fs'

import { fracInBar } from '../src/lib/editor-playhead.ts'
import {
  audibleStepIndex,
  visualPlayheadFromSchedule,
  type ScheduledStep,
} from '../src/lib/playhead-clock.ts'
import { barDurationSec, beatDurationSec } from '../src/lib/rhythm.ts'
import { DEFAULT_SPEED_BUILDER, shouldStartPrecount } from '../src/lib/speed-builder.ts'

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

assert(
  shouldStartPrecount('drums', { enabled: false, precount: true }),
  'Drums + SB off + precount on → count in',
)
assert(
  !shouldStartPrecount('drums', { enabled: false, precount: false }),
  'Drums + SB off + precount off → no count in',
)
assert(
  shouldStartPrecount('drums', { enabled: true, precount: true }),
  'Drums + SB on + precount on → one shared count in',
)
assert(
  !shouldStartPrecount('drums', { enabled: true, precount: false }),
  'Drums + SB on + precount off → no count in',
)
assert(
  !shouldStartPrecount('click', { enabled: false, precount: true }),
  'Click + SB off → no regular precount',
)
assert(
  shouldStartPrecount('click', { enabled: true, precount: true }),
  'Click + SB on + precount on → Speed Builder count in',
)
assert(
  DEFAULT_SPEED_BUILDER.precount === true && DEFAULT_SPEED_BUILDER.enabled === false,
  'default: Precount on, Speed Builder off',
)

const BPM = 120
const cases: Array<{ beats: number; unit: 2 | 4 | 8 | 16; bar: number }> = [
  { beats: 4, unit: 4, bar: 2 },
  { beats: 4, unit: 8, bar: 1 },
  { beats: 6, unit: 8, bar: 1.5 },
  { beats: 2, unit: 2, bar: 2 },
]

console.log(`\n==== 1-bar precount then groove @ ${BPM} BPM ====`)
for (const item of cases) {
  const clicks: number[] = []
  for (let beat = 0; beat < item.beats; beat += 1) {
    clicks.push(beat * beatDurationSec(BPM, item.unit))
  }
  const groove = barDurationSec(item.beats, BPM, item.unit)
  assert(clicks.length === item.beats, `${item.beats}/${item.unit} precount has ${item.beats} clicks`)
  assert(nearly(clicks[0], 0), `${item.beats}/${item.unit} first count at 0`)
  assert(nearly(groove, item.bar), `${item.beats}/${item.unit} groove starts at ${item.bar}s`)
  assert(
    nearly(clicks[clicks.length - 1] + beatDurationSec(BPM, item.unit), groove),
    `${item.beats}/${item.unit} last count + one beat = bar 1 beat 1 (no gap)`,
  )
}

function cue(
  time: number,
  bar: number,
  step: number,
  beat: number,
  precount: boolean,
): ScheduledStep {
  return { time, bar, step, beat, accent: 0, subdivision: false, precount }
}

console.log('\n==== visual step === audible step (count-in + loop wrap) ====')
{
  const beat = 0.5
  const countUntil = 4 * beat
  const cues: ScheduledStep[] = []
  for (let i = 0; i < 4; i += 1) cues.push(cue(i * beat, 0, 0, i, true))
  const bars = 2
  const steps = 4
  for (let cycle = 0; cycle < 2; cycle += 1) {
    for (let bar = 0; bar < bars; bar += 1) {
      for (let step = 0; step < steps; step += 1) {
        const time = countUntil + cycle * bars * steps * beat + bar * steps * beat + step * beat
        cues.push(cue(time, bar, step, step, false))
      }
    }
  }
  const samples = [0, 0.1, 0.6, 1.4, 1.9, 2.0, 2.5, 3.9, 4.0, 5.5, 6.0, 7.9]
  for (const t of samples) {
    const visual = visualPlayheadFromSchedule({ cues, audioTime: t, countUntil, startBar: 0 })
    const audible = audibleStepIndex({ cues, audioTime: t, countUntil, startBar: 0 })
    assert(visual.bar === audible.bar && visual.step === audible.step && visual.precount === audible.precount, `t=${t} visual ${visual.bar}:${visual.step} pre=${visual.precount} === audible ${audible.bar}:${audible.step} pre=${audible.precount}`)
  }
  const midCount = visualPlayheadFromSchedule({ cues, audioTime: 0.6, countUntil, startBar: 0 })
  assert(midCount.precount === true, 'during count-in precount flag is on')
  assert(midCount.bar === 0 && midCount.step === -1, 'during count-in playhead stays parked at bar 1 start')
  assert(midCount.beat === 1, 'count-in indicator shows the sounding count beat')
  const justBeforeGroove = visualPlayheadFromSchedule({ cues, audioTime: 1.99, countUntil, startBar: 0 })
  assert(justBeforeGroove.precount === true && justBeforeGroove.step === -1, 'still parked just before groove')
  const firstGroove = visualPlayheadFromSchedule({ cues, audioTime: 2.0, countUntil, startBar: 0 })
  assert(firstGroove.precount === false && firstGroove.bar === 0 && firstGroove.step === 0, 'groove bar 1 step 0 when count-in ends')
  const bar2 = visualPlayheadFromSchedule({ cues, audioTime: 4.0, countUntil, startBar: 0 })
  assert(bar2.precount === false && bar2.bar === 1 && bar2.step === 0, 'bar 2 starts at the right time — not still on bar 1')
  const wrap = visualPlayheadFromSchedule({ cues, audioTime: 6.0, countUntil, startBar: 0 })
  assert(wrap.precount === false && wrap.bar === 0 && wrap.step === 0, 'loop wrap returns to bar 1 step 0')
  const lateCount = visualPlayheadFromSchedule({
    cues,
    audioTime: 1.95,
    outputLatency: 0.1,
    countUntil,
    startBar: 0,
  })
  assert(lateCount.precount === false && lateCount.bar === 0 && lateCount.step === 0, 'outputLatency is included in the audible clock')
  assert(fracInBar({ audioTime: 2, barStart: 2, barDur: 2, precount: true, playing: true }) === 0, 'frac parked during count-in')
  assert(
    Math.abs(fracInBar({ audioTime: 2, barStart: 2, barDur: 2, outputLatency: 0.1, playing: true }) - 0.05) < 1e-9,
    'frac uses currentTime + outputLatency',
  )
}

const engineSrc = readFileSync(new URL('../src/hooks/useRhythmEngine.ts', import.meta.url), 'utf8')
assert(engineSrc.includes('visualPlayheadFromSchedule'), 'engine paints from the scheduled cue clock')
assert(engineSrc.includes('countUntilRef'), 'engine keeps count-in until grooveStart sounds')
assert(!engineSrc.includes('VISUAL_LEAD'), 'visuals are not a separate VISUAL_LEAD timer')
assert(engineSrc.includes('endPrecount(nextTimeRef.current)'), 'groove start is the first pattern slot')

if (failed) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nall drums precount checks passed')
