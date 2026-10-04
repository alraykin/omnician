import assert from 'node:assert/strict'

import { barsForPreset, findPreset } from '../src/lib/rhythm-presets.ts'
import { VOICES, type HitPos, type VoiceId } from '../src/lib/rhythm.ts'

function stepOf(hit: HitPos): number {
  return hit.beat * 4 + (hit.num * 4) / hit.den
}

function steps(bar: ReturnType<typeof barsForPreset>[number], voice: VoiceId): number[] {
  return bar.pattern[voice].map(stepOf).sort((a, b) => a - b)
}

function grid(hits: number[]): string {
  return Array.from({ length: 16 }, (_, step) => (hits.includes(step) ? 'x' : '.'))
    .join('')
    .replace(/(.{4})/g, '$1 ')
    .trim()
}

const backbeat = findPreset('rock-44')
assert.ok(backbeat)
assert.equal(backbeat.name, 'Backbeat')
assert.equal(backbeat.bpm, 88)
assert.deepEqual(backbeat.hits.kick, [0, 7, 8, 10])
assert.deepEqual(backbeat.hits.snare, [4, 12])

const chameleon = findPreset('funk-44')
assert.ok(chameleon)
assert.equal(chameleon.name, 'Chameleon')
assert.equal(chameleon.bpm, 90)
assert.equal(chameleon.beats, 4)
assert.equal(chameleon.beatUnit, 4)
assert.equal(chameleon.subdivision, 4)

const bars = barsForPreset(chameleon)
assert.equal(bars.length, 8)

const expected: Array<Partial<Record<VoiceId, number[]>>> = [
  { kick: [0, 7, 8, 10, 12], snare: [4, 12], closedHat: [0, 4, 8, 12], crash: [0] },
  { kick: [0, 7, 8, 10, 12], snare: [4, 12], closedHat: [0, 4, 8, 12] },
  { kick: [0, 7, 8, 10, 12], snare: [4, 12], closedHat: [0, 4, 8, 12] },
  { kick: [0, 4, 7, 8, 10, 12, 13], snare: [4, 12], closedHat: [0, 4, 8, 12] },
  { kick: [0, 7, 8, 10, 12], snare: [4, 12], closedHat: [0, 4, 8, 12], splash: [0] },
  { kick: [0, 7, 8, 10, 12], snare: [4, 12], closedHat: [0, 4, 8, 12] },
  { kick: [0, 7, 8, 10, 12], snare: [4, 12], closedHat: [0, 4, 8, 12] },
  { kick: [0, 7, 8, 9, 10], snare: [4, 8, 9, 10, 11], closedHat: [0, 4, 8], highTom: [12, 13], midTom: [14], floorTom: [15] },
]

for (const [index, want] of expected.entries()) {
  const bar = bars[index]!
  assert.equal(bar.beats, 4)
  assert.equal(bar.beatUnit, 4)
  assert.equal(bar.subdivision, 4)
  for (const voice of VOICES) {
    assert.deepEqual(steps(bar, voice), want[voice] ?? [], `bar ${index + 1} ${voice}`)
    assert.ok(bar.pattern[voice].every((hit) => !hit.soft), `bar ${index + 1} ${voice} full velocity`)
  }
}

assert.ok(steps(bars[0]!, 'crash').includes(0), 'bar 1 crash on 1')
assert.equal(steps(bars[4]!, 'crash').length, 0, 'bar 5 has no crash')
assert.ok(steps(bars[4]!, 'splash').includes(0), 'bar 5 splash on 1')

console.log('Chameleon transcription')
for (const [index, bar] of bars.entries()) {
  console.log(`\nBar ${index + 1}`)
  for (const voice of VOICES) {
    const hits = steps(bar, voice)
    if (!hits.length) continue
    console.log(`${voice.padEnd(10)} ${grid(hits)}`)
  }
}

console.log('\nchameleon ok')
