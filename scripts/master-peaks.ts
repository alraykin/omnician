import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { CLICK_ACCENT_GAIN, MASTER_CEILING_DB, MASTER_GAIN_DB } from '../src/lib/rhythm-audio.ts'
import { KIT_MIX_MAX_DB } from '../src/lib/kit-mix.ts'

assert.equal(MASTER_CEILING_DB, -0.3)
assert.ok(MASTER_GAIN_DB > 2, `master makeup should be hotter than the old +2.8 dB, got ${MASTER_GAIN_DB}`)
assert.equal(KIT_MIX_MAX_DB, 6)

const audio = readFileSync(new URL('../src/lib/rhythm-audio.ts', import.meta.url), 'utf8')
assert.match(audio, /makePeakLimiter/)
assert.match(audio, /MASTER_CEILING/)
assert.match(audio, /probeMasterPeaks/)
assert.match(audio, /CLICK_ACCENT_GAIN/)
assert.equal(CLICK_ACCENT_GAIN.wood, 0.87)
assert.equal(CLICK_ACCENT_GAIN.clave, 0.56)
assert.equal(CLICK_ACCENT_GAIN.digital, 0.75)
assert.equal(CLICK_ACCENT_GAIN.mechanical, 0.70)
assert.doesNotMatch(audio, /volumeDb/)
assert.doesNotMatch(audio, /setMasterVolume/)
assert.doesNotMatch(audio, /LIMITER_CEILING = Math\.pow\(10, -1 \/ 20\)/)

const card = readFileSync(new URL('../src/components/rhythm/RhythmTempoCard.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(card, /VolumeFader/)
assert.doesNotMatch(card, /VOLUME/)

const faders = readFileSync(new URL('../src/components/rhythm/KitFaders.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(faders, /VolumeFader/)
assert.doesNotMatch(faders, /data-volume/)
assert.match(faders, /data-section="kit-faders"/)

const page = readFileSync(new URL('../src/pages/RhythmPage.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(page, /volumeDb/)
assert.doesNotMatch(page, /onVolume/)

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
assert.doesNotMatch(css, /data-volume/)

console.log(`master-peaks: ceiling ${MASTER_CEILING_DB} dBFS, makeup +${MASTER_GAIN_DB} dB`)
