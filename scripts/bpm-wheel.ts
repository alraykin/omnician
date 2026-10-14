import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/components/rhythm/BpmWheel.tsx', import.meta.url), 'utf8')
assert.match(src, /data-bpm-wheel="vertical"/)
assert.match(src, /const PX_PER_BPM = 16/)
assert.match(src, /drag\.y - event\.clientY/)
assert.match(src, /first\.y - last\.y/)
assert.match(src, /rotateX/)
assert.match(src, /bpm-wheel-knurl/)
assert.match(src, /boostFlick/)
assert.match(src, /startCoast/)
assert.match(src, /stopCoast/)
assert.match(src, /data-bpm-edit/)
assert.match(src, /inputMode="numeric"/)
assert.doesNotMatch(src, /bpm-dial-ring/)
assert.doesNotMatch(src, /pointAngle/)

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
assert.match(css, /\.bpm-wheel \{/)
assert.match(css, /\.bpm-wheel-drum/)
assert.doesNotMatch(css, /\.bpm-dial \{/)

const card = readFileSync(new URL('../src/components/rhythm/RhythmTempoCard.tsx', import.meta.url), 'utf8')
assert.match(card, /<BpmWheel/)
assert.match(card, /onBpm\(next, true\)/)
assert.match(card, /data-tempo-taps/)
assert.match(card, /data-tap/)

const page = readFileSync(new URL('../src/pages/RhythmPage.tsx', import.meta.url), 'utf8')
assert.match(page, /RhythmTempoCard/)
assert.equal((page.match(/<RhythmTempoCard/g) ?? []).length, 2)

console.log('bpm-wheel: ok')
