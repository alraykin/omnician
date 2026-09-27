/**
 * Regular Drums precount shares the Speed Builder switch.
 * Run: npx --yes tsx scripts/drums-precount.ts
 */
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

if (failed) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nall drums precount checks passed')
