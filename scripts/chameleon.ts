import assert from 'node:assert/strict'

import { barsForPreset, findPreset } from '../src/lib/rhythm-presets.ts'
import { VOICES, type HitPos, type VoiceId } from '../src/lib/rhythm.ts'

function stepOf(hit: HitPos): number {
  return hit.beat * 6 + (hit.num * 6) / hit.den
}

function steps(bar: ReturnType<typeof barsForPreset>[number], voice: VoiceId): number[] {
  return bar.pattern[voice].map(stepOf).sort((a, b) => a - b)
}

function grid(hits: number[]): string {
  return Array.from({ length: 24 }, (_, step) => (hits.includes(step) ? 'x' : '.'))
    .join('')
    .replace(/(.{6})/g, '$1 ')
    .trim()
}

const backbeat = findPreset('rock-44')
assert.ok(backbeat)
assert.equal(backbeat.name, 'Backbeat')
assert.equal(backbeat.bpm, 88)
assert.equal(backbeat.subdivision, 4)
assert.deepEqual(backbeat.hits.kick, [0, 7, 8, 10])
assert.deepEqual(backbeat.hits.snare, [4, 12])

const chameleon = findPreset('funk-44')
assert.ok(chameleon)
assert.equal(chameleon.name, 'Chameleon')
assert.equal(chameleon.bpm, 90)
assert.equal(chameleon.beats, 4)
assert.equal(chameleon.beatUnit, 4)
assert.equal(chameleon.subdivision, 6)

const bars = barsForPreset(chameleon)
assert.equal(bars.length, 8)

const expected: Array<Partial<Record<VoiceId, number[]>>> = [
  { kick: [0, 9, 14, 15, 21], snare: [5, 18], closedHat: [6, 12, 18], crash: [0] },
  { kick: [0, 9, 14, 15, 20, 21], snare: [5, 18], closedHat: [0, 6, 12, 18] },
  { kick: [0, 9, 14, 15, 21], snare: [5, 18], closedHat: [0, 6, 12, 18] },
  { kick: [0, 9, 14, 15, 20, 21], snare: [5, 18], closedHat: [0, 6, 12, 18] },
  { kick: [0, 9, 14, 15, 21], snare: [5, 18], closedHat: [6, 12, 18], splash: [0] },
  { kick: [0, 9, 14, 15, 20, 21], snare: [5, 18], closedHat: [0, 6, 12, 18] },
  { kick: [0, 9, 14, 15, 21], snare: [5, 18], closedHat: [0, 6, 12, 18] },
  {
    kick: [0, 9, 16, 17],
    snare: [5, 14, 15, 18, 19],
    closedHat: [0, 6, 12, 18],
    highTom: [20, 21],
    midTom: [22],
    floorTom: [23],
  },
]

for (const [index, want] of expected.entries()) {
  const bar = bars[index]!
  assert.equal(bar.beats, 4)
  assert.equal(bar.beatUnit, 4)
  assert.equal(bar.subdivision, 6)
  for (const voice of VOICES) {
    assert.deepEqual(steps(bar, voice), want[voice] ?? [], `bar ${index + 1} ${voice}`)
    assert.ok(bar.pattern[voice].every((hit) => !hit.soft), `bar ${index + 1} ${voice} full velocity`)
  }
}

assert.ok(steps(bars[0]!, 'crash').includes(0), 'bar 1 crash on 1')
assert.equal(steps(bars[4]!, 'crash').length, 0, 'bar 5 has no crash')
assert.ok(steps(bars[4]!, 'splash').includes(0), 'bar 5 splash on 1')
assert.ok(
  bars.every((bar) => steps(bar, 'snare').includes(5)),
  'snare at 1.5 in every bar',
)

console.log('Chameleon transcription (6 per beat)')
for (const [index, bar] of bars.entries()) {
  console.log(`\nBar ${index + 1}`)
  for (const voice of VOICES) {
    const hits = steps(bar, voice)
    if (!hits.length) continue
    console.log(`${voice.padEnd(10)} ${grid(hits)}`)
  }
}

console.log('\nchameleon ok')
