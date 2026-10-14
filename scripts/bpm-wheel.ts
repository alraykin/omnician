import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  ITEM_PX,
  PX_PER_BPM,
  bpmDeltaFromFinger,
  centeredBpm,
  flickVelocityBpm,
  stripOffsetPx,
} from '../src/lib/bpm-wheel-physics.ts'

assert.equal(PX_PER_BPM, ITEM_PX)
assert.equal(ITEM_PX, 28)
assert.equal(centeredBpm(36.4, 30, 300), 36)
assert.equal(centeredBpm(36.6, 30, 300), 37)

const slowUp = bpmDeltaFromFinger(-28, 0.12)
assert.ok(slowUp > 0.85 && slowUp < 1.15, `slow drag-up should be ~+1 BPM, got ${slowUp}`)

const slowDown = bpmDeltaFromFinger(28, 0.12)
assert.ok(slowDown < -0.85 && slowDown > -1.15, `slow drag-down should be ~-1 BPM, got ${slowDown}`)

const fastUp = bpmDeltaFromFinger(-140, 0.08)
assert.ok(fastUp > 5, `fast swipe should accelerate, got ${fastUp}`)

assert.ok(stripOffsetPx(88.4) < 0, 'higher visual BPM must shift the strip up')
assert.ok(stripOffsetPx(87.6) > 0, 'lower visual BPM must shift the strip down')

const flickUp = flickVelocityBpm([
  { t: 1000, y: 200 },
  { t: 1040, y: 160 },
  { t: 1080, y: 120 },
])
assert.ok(flickUp > 30, `finger-up flick must be +BPM/s, got ${flickUp}`)

const flickDown = flickVelocityBpm([
  { t: 1000, y: 120 },
  { t: 1040, y: 160 },
  { t: 1080, y: 200 },
])
assert.ok(flickDown < -30, `finger-down flick must be -BPM/s, got ${flickDown}`)

const stale = flickVelocityBpm(
  [
    { t: 1000, y: 200 },
    { t: 1040, y: 120 },
  ],
  1200,
)
assert.equal(stale, 0, 'a paused finger must not coast')

const src = readFileSync(new URL('../src/components/rhythm/BpmWheel.tsx', import.meta.url), 'utf8')
assert.match(src, /data-bpm-wheel="vertical"/)
assert.match(src, /data-higher-below="true"/)
assert.match(src, /touchstart/)
assert.match(src, /touchmove/)
assert.match(src, /setPointerCapture/)
assert.match(src, /touchAction: 'none'/)
assert.match(src, /startCoast/)
assert.match(src, /stopCoast/)
assert.match(src, /data-bpm-edit/)
assert.match(src, /inputMode="numeric"/)
assert.match(src, /center \+ offset/)
assert.match(src, /startSnap/)
assert.match(src, /const NEIGHBORS = \[-2, -1, 0, 1, 2\]/)
assert.match(src, /\{hidden \? '—' : bpm\}/)
assert.doesNotMatch(src, /\{face\}/)
assert.doesNotMatch(src, /bpm-dial-ring/)
assert.doesNotMatch(src, /DRAG_DEADZONE_PX/)
assert.doesNotMatch(src, /const PX_PER_BPM = 16/)
assert.doesNotMatch(src, /const PX_PER_BPM = 9/)

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
assert.match(css, /\.bpm-wheel \{/)
assert.match(css, /touch-action: none/)
assert.match(css, /\.bpm-wheel-drum/)
assert.match(css, /--wheel-y/)
assert.doesNotMatch(css, /\.bpm-dial \{/)

const card = readFileSync(new URL('../src/components/rhythm/RhythmTempoCard.tsx', import.meta.url), 'utf8')
assert.match(card, /<BpmWheel/)
assert.match(card, /onBpm\(next, true\)/)

console.log('bpm-wheel: ok')
