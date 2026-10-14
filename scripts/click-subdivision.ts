import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  applyClickSubdivision,
  barDurationSec,
  beatDurationSec,
  clickMeterSignature,
  clickPulsesInBar,
  clickSubdivSignature,
  DEFAULT_CLICK_SUBDIVISION,
  locateHeardBar,
  makeBar,
  nextClickBeatBoundary,
  setBarSubdivision,
  setBeatSubdivision,
} from '../src/lib/rhythm.ts'
import { makeDefaultClickBars, makeDefaultRockBars } from '../src/lib/rhythm-presets.ts'
import { migrateFactoryClickBars } from '../src/lib/rhythm-prefs.ts'

const BPM = 120
const BEAT = 0.5

const factory = makeDefaultClickBars()
assert.equal(factory.length, 1)
assert.equal(factory[0]?.beats, 1)
assert.equal(factory[0]?.beatUnit, 4)
assert.equal(factory[0]?.subdivision, 1)
assert.equal(DEFAULT_CLICK_SUBDIVISION, 1)
assert.ok(factory[0]?.beatSubdivisions.every((item) => item === 1))

const drums = makeDefaultRockBars()
assert.equal(drums[0]?.beats, 4)
assert.equal(drums[0]?.beatUnit, 4)

const eighths = makeBar(4, 4, 2)
const migratedEighths = migrateFactoryClickBars([eighths])
assert.equal(migratedEighths[0]?.beats, 1)
assert.equal(migratedEighths[0]?.beatUnit, 4)
assert.equal(migratedEighths[0]?.subdivision, 1)

const quarters = makeBar(4, 4, 1)
const migratedQuarters = migrateFactoryClickBars([quarters])
assert.equal(migratedQuarters[0]?.beats, 1)
assert.equal(migratedQuarters[0]?.subdivision, 1)

const custom = setBarSubdivision(makeBar(4, 4, 4), 4)
assert.equal(migrateFactoryClickBars([custom])[0]?.beats, 4)
assert.equal(migrateFactoryClickBars([custom])[0]?.subdivision, 4)

const fiveFour = makeBar(5, 4, 1)
assert.equal(migrateFactoryClickBars([fiveFour])[0]?.beats, 5)

const twoBars = [makeBar(4, 4, 2), makeBar(4, 4, 2)]
assert.equal(migrateFactoryClickBars(twoBars)[0]?.beats, 4)
assert.equal(migrateFactoryClickBars(twoBars)[0]?.subdivision, 2)

const mid = nextClickBeatBoundary(10.12, 10, BPM, 4, 4)
assert.equal(mid.wrap, false)
assert.equal(mid.beat, 1)
assert.ok(Math.abs(mid.time - 10.5) < 1e-9, `mid-beat lands on next beat, got ${mid.time}`)

const late = nextClickBeatBoundary(10.495, 10, BPM, 4, 4)
assert.equal(late.beat, 2)
assert.ok(Math.abs(late.time - 11) < 1e-9, `near-boundary uses the following beat, got ${late.time}`)

const last = nextClickBeatBoundary(11.6, 10, BPM, 4, 4)
assert.equal(last.wrap, true)
assert.equal(last.beat, 0)
assert.ok(Math.abs(last.time - 12) < 1e-9, `last beat wraps to bar end, got ${last.time}`)

const onDownbeat = nextClickBeatBoundary(10, 10, BPM, 4, 4)
assert.equal(onDownbeat.beat, 1)
assert.ok(Math.abs(onDownbeat.time - 10.5) < 1e-9)

const sixteenths = setBarSubdivision(makeBar(4, 4, 4), 4)
const applied = applyClickSubdivision(eighths, sixteenths)
assert.equal(applied.subdivision, 4)
assert.deepEqual(applied.beatAccents, eighths.beatAccents)
assert.equal(applied.beats, 4)
const pulses = clickPulsesInBar(applied, BPM)
assert.equal(pulses.length, 16)
assert.ok(Math.abs((pulses[5]?.offsetSec ?? 0) - (BEAT + BEAT / 4)) < 1e-9)

const live = [makeBar(4, 4, 2)]
const pending = [setBeatSubdivision(setBarSubdivision(makeBar(4, 4, 4), 4), 2, 3)]
assert.notEqual(clickSubdivSignature(live), clickSubdivSignature(pending))
assert.equal(clickMeterSignature('click', live), clickMeterSignature('click', pending))

function assertNextBeat(label: string, now: number, heardStart: number, bpm: number, beats: number) {
  const beatSec = beatDurationSec(bpm, 4)
  const plan = nextClickBeatBoundary(now, heardStart, bpm, beats, 4)
  const wait = plan.time - now
  assert.ok(wait > 0, `${label}: next beat must be in the future (${wait})`)
  assert.ok(
    wait <= beatSec + 0.1 + 1e-9,
    `${label}: next beat must be within one beat + 100ms, wait=${wait.toFixed(3)}s beat=${beatSec.toFixed(3)}s`,
  )
}

for (const bpm of [40, 200] as const) {
  for (const beats of [1, 4] as const) {
    const beatSec = beatDurationSec(bpm, 4)
    const barDur = barDurationSec(beats, bpm, 4)
    const queuedBars = Math.max(2, Math.ceil(1.5 / barDur))
    const now = 10.08
    const heardStart = 10
    const tipStart = heardStart + queuedBars * barDur
    const durations = [barDur]
    const heard = locateHeardBar(now, tipStart, 0, durations)
    assert.ok(
      Math.abs(heard.start - heardStart) < beatSec + 1e-6,
      `${beats}/4 @ ${bpm}: heard start from lookahead tip should be the playing bar, got ${heard.start} want ~${heardStart}`,
    )
    assertNextBeat(`${beats}/4 @ ${bpm} from heard bar`, now, heard.start, bpm, beats)
    const wrong = nextClickBeatBoundary(now, tipStart, bpm, beats, 4)
    assert.ok(
      wrong.time - now > beatSec,
      `${beats}/4 @ ${bpm}: retargeting from the lookahead tip would skip more than one beat (${wrong.time - now})`,
    )
  }
}

const engine = readFileSync(new URL('../src/hooks/useRhythmEngine.ts', import.meta.url), 'utf8')
assert.match(engine, /reason === 'subdivision'/)
assert.match(engine, /retargetClickSubdivision/)
assert.match(engine, /cancelFuture\(boundary, 'click'\)/)
assert.match(engine, /nextClickBeatBoundary/)
assert.match(engine, /locateHeardBar/)
assert.match(engine, /CLICK_SCHEDULE_AHEAD_SEC/)
assert.match(engine, /useLayoutEffect/)
assert.match(engine, /setHoldUntilCycle\(meterQueued\)/)
assert.doesNotMatch(engine, /setHoldUntilCycle\(queued\)/)

const audio = readFileSync(new URL('../src/lib/rhythm-audio.ts', import.meta.url), 'utf8')
assert.match(audio, /item\.node\.stop\(this\.ctx\.currentTime\)/)

const page = readFileSync(new URL('../src/pages/RhythmPage.tsx', import.meta.url), 'utf8')
assert.match(page, /setSubdivision/)
assert.match(page, /data-section="subdivision"/)

console.log('click-subdivision: ok')
