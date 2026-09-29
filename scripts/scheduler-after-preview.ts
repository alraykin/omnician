/**
 * Lab sequence in code: mic-stop (preview-owned sources cleared) → a few
 * preview beats → stop → real lookahead scheduler for 8 bars.
 *
 * Also proves the iPhone Safari stall: a frozen AudioContext.currentTime
 * after the first scheduled note must still produce 32 clicks, not one.
 *
 *   npx --yes tsx scripts/scheduler-after-preview.ts
 */
import {
  LOOKAHEAD_MS,
  SCHEDULE_AHEAD_SEC,
  START_LEAD_SEC,
  createClockWatch,
  pumpClickScheduler,
} from '../src/lib/lookahead-scheduler.ts'

let failed = 0

function assert(condition: unknown, message: string) {
  if (!condition) {
    failed += 1
    console.error(`FAIL  ${message}`)
    return
  }
  console.log(`ok    ${message}`)
}

const BPM = 120
const BEAT = 60 / BPM
const BARS = 8
const BEATS = BARS * 4
const TICKS = Math.ceil(((BEATS + 1) * BEAT * 1000) / LOOKAHEAD_MS)

function runScheduler(opts: {
  freezeAfterFirst: boolean
  staleNext?: number
  startAudio?: number
}): number[] {
  const audio0 = opts.startAudio ?? 12.4
  const watch = createClockWatch(audio0, 0)
  const times: number[] = []
  let nextTime = opts.staleNext ?? audio0 + START_LEAD_SEC
  let remaining = BEATS
  let audioTime = audio0
  for (let i = 0; i < TICKS && remaining > 0; i += 1) {
    const wallMs = i * LOOKAHEAD_MS
    if (!opts.freezeAfterFirst) audioTime = audio0 + wallMs / 1000
    const result = pumpClickScheduler({
      nextTime,
      remaining,
      audioTime,
      wallMs,
      beatSec: BEAT,
      watch,
      emit: (when) => {
        times.push(when)
      },
    })
    nextTime = result.nextTime
    remaining = result.remaining
    if (opts.freezeAfterFirst && times.length >= 1) {
      // currentTime stuck at the value from the first tick
      audioTime = audio0
    }
  }
  return times
}

console.log('==== frozen currentTime used to schedule only one click ====')
{
  // Old 0.12s lookahead against a frozen clock: first tick fits one 120 BPM beat.
  const audio0 = 5
  const next0 = audio0 + START_LEAD_SEC
  const horizon = audio0 + 0.12
  let next = next0
  let count = 0
  while (next < horizon) {
    count += 1
    next += BEAT
  }
  assert(count === 1, `legacy 0.12s window schedules ${count} click(s) at 120 BPM (the live-app stall)`)
  assert(SCHEDULE_AHEAD_SEC > BEAT * 2, 'live lookahead covers more than one beat at 120 BPM')
}

console.log('\n==== mic → preview → stop → precount (4) + 8-bar Play ====')
{
  const preview: number[] = []
  const audio0 = 20
  for (let i = 0; i < 4; i += 1) preview.push(audio0 + 0.03 + i * BEAT)
  assert(preview.length === 4, 'Listen-style preview queued 4 clicks')
  preview.length = 0
  assert(preview.length === 0, 'preview stopAll cleared those sources before Play')
  const precount = 4
  const watch = createClockWatch(audio0, 0)
  const times: number[] = []
  let nextTime = audio0 + START_LEAD_SEC
  let remaining = precount + BEATS
  let audioTime = audio0
  const ticks = Math.ceil(((precount + BEATS + 1) * BEAT * 1000) / LOOKAHEAD_MS)
  for (let i = 0; i < ticks && remaining > 0; i += 1) {
    const wallMs = i * LOOKAHEAD_MS
    audioTime = audio0 + wallMs / 1000
    const result = pumpClickScheduler({
      nextTime,
      remaining,
      audioTime,
      wallMs,
      beatSec: BEAT,
      watch,
      emit: (when) => {
        times.push(when)
      },
    })
    nextTime = result.nextTime
    remaining = result.remaining
  }
  assert(times.length === precount + BEATS, `precount + 8 bars scheduled ${times.length}/${precount + BEATS}`)
}

console.log('\n==== same sequence with currentTime frozen after the first Play note ====')
{
  const preview: number[] = []
  const audio0 = 33.7
  for (let i = 0; i < 6; i += 1) preview.push(audio0 + 0.03 + i * BEAT)
  preview.length = 0
  const play = runScheduler({ freezeAfterFirst: true, startAudio: audio0 })
  assert(play.length === BEATS, `frozen clock after preview still scheduled ${play.length}/${BEATS} clicks (8 bars)`)
  const immediate = play.filter((when) => when === 0).length
  assert(immediate >= BEATS - 8, `wall-clock start(0) recovered after the freeze (${immediate} immediate of ${BEATS})`)
}

console.log('\n==== stale nextNoteTime far ahead is rebased ====')
{
  const play = runScheduler({ freezeAfterFirst: false, staleNext: 9999, startAudio: 4 })
  assert(play.length === BEATS, `stale nextNoteTime 9999 still produced ${play.length}/${BEATS} clicks`)
}

console.log('\n==== stale nextNoteTime far behind is rebased ====')
{
  const play = runScheduler({ freezeAfterFirst: false, staleNext: 0.001, startAudio: 40 })
  assert(play.length === BEATS, `nextNoteTime behind the clock still produced ${play.length}/${BEATS} clicks`)
}

if (failed) {
  console.error(`\n${failed} scheduler check(s) failed`)
  process.exit(1)
}
console.log('\nok    lab sequence: mic/preview/stop then 8-bar scheduler passes')
