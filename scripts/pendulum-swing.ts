import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'

import {
  easePendulumToCenter,
  pendulumAtExtreme,
  pendulumBeatPhase,
  pendulumNorm,
  pendulumNormFromBeatPhase,
  rebasePendulumClock,
} from '../src/lib/fold-mode.ts'
import { beatDurationSec } from '../src/lib/rhythm.ts'

/** Simulate Click's default 1-beat bars wrapping every 0.5s at 120 BPM. */
const BPM = 120
const BEAT_SEC = beatDurationSec(BPM, 4)
const DT = 1 / 120

type Sample = { t: number; beatPhase: number; norm: number; side: 'L' | 'R' | 'C' }

const samples: Sample[] = []
const extremes: Sample[] = []
let originT = 0
let originPhase = 0
let beatSec = BEAT_SEC
let prev = 1
let maxJump = 0

for (let i = 0; i <= Math.round(4 / DT); i += 1) {
  const t = i * DT
  if (Math.abs(t - 2) < DT / 2) {
    const next = rebasePendulumClock(t, originT, originPhase, beatSec, beatDurationSec(90, 4))
    originT = next.originAudioTime
    originPhase = next.originBeatPhase
    beatSec = next.beatSec
  }
  const phase = pendulumBeatPhase(t, originT, originPhase, beatSec)
  const norm = pendulumNormFromBeatPhase(phase)
  maxJump = Math.max(maxJump, Math.abs(norm - prev))
  const side: Sample['side'] = pendulumAtExtreme(norm) ? (norm > 0 ? 'L' : 'R') : 'C'
  const row = { t, beatPhase: phase, norm, side }
  samples.push(row)
  if (side !== 'C' && (extremes.length === 0 || extremes.at(-1)?.side !== side)) {
    extremes.push(row)
  }
  prev = norm
}

assert.ok(maxJump < 0.12, `no snap, max Δnorm ${maxJump}`)
assert.ok(extremes.length >= 6)
for (let i = 1; i < extremes.length; i += 1) {
  assert.notEqual(extremes[i]?.side, extremes[i - 1]?.side)
}

let wrapJump = 0
let wrapPrev = pendulumNorm(0, 1)
for (let i = 1; i <= 200; i += 1) {
  const frac = (i / 200) % 1
  const n = pendulumNorm(frac, 1)
  wrapJump = Math.max(wrapJump, Math.abs(n - wrapPrev))
  wrapPrev = n
}
assert.ok(wrapJump > 1.5, 'old 1-beat bar wrap snaps ~2')

let stop = 1
for (let i = 0; i < 80; i += 1) stop = easePendulumToCenter(stop, DT)
assert.ok(Math.abs(stop) < 0.02, 'stop eases to center')

const lines = [
  `beatSec=${BEAT_SEC} maxJump=${maxJump.toFixed(4)} extremes=${extremes.map((e) => `${e.side}@${e.t.toFixed(3)}s`).join(' ')}`,
  ...extremes.map((e) => `${e.t.toFixed(3)}s  phase=${e.beatPhase.toFixed(3)}  norm=${e.norm.toFixed(3)}  ${e.side}`),
]
mkdirSync('/opt/cursor/artifacts', { recursive: true })
writeFileSync('/opt/cursor/artifacts/pendulum-frames.log', `${lines.join('\n')}\n`)
console.log(lines.join('\n'))
console.log('pendulum-swing ok')
