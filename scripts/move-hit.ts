import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { liveFactoryPatternKey } from '../src/lib/factory-library.ts'
import {
  cloneBar,
  emptyPattern,
  isHitSoft,
  makeBar,
  moveHitPos,
  reduceHit,
  sameHit,
  setHitPos,
} from '../src/lib/rhythm.ts'
import { barsForPreset, findPreset } from '../src/lib/rhythm-presets.ts'

let pattern = setHitPos(emptyPattern(), 'snare', reduceHit(1, 0, 1), true)
pattern = moveHitPos(pattern, 'snare', reduceHit(1, 0, 1), 'snare', reduceHit(2, 1, 2))
assert.equal(pattern.snare.length, 1)
assert.ok(sameHit(pattern.snare[0]!, reduceHit(2, 1, 2)))
assert.equal(isHitSoft(pattern.snare[0]!), false)

pattern = setHitPos(emptyPattern(), 'snare', reduceHit(1, 3, 4, true), true)
pattern = moveHitPos(pattern, 'snare', reduceHit(1, 3, 4), 'highTom', reduceHit(0, 0, 1))
assert.equal(pattern.snare.length, 0)
assert.equal(pattern.highTom.length, 1)
assert.ok(sameHit(pattern.highTom[0]!, reduceHit(0, 0, 1)))
assert.equal(isHitSoft(pattern.highTom[0]!), true, 'soft intensity travels with the hit')

pattern = setHitPos(emptyPattern(), 'kick', reduceHit(0, 0, 1), true)
pattern = setHitPos(pattern, 'snare', reduceHit(1, 0, 1, true), true)
const replaced = moveHitPos(pattern, 'snare', reduceHit(1, 0, 1), 'kick', reduceHit(0, 0, 1))
assert.equal(replaced.snare.length, 0)
assert.equal(replaced.kick.length, 1)
assert.equal(isHitSoft(replaced.kick[0]!), true, 'drop on occupied cell replaces and keeps source soft')

const same = moveHitPos(replaced, 'kick', reduceHit(0, 0, 1), 'kick', reduceHit(0, 0, 1))
assert.equal(same, replaced, 'drop on the same slot is a no-op')

const missing = moveHitPos(emptyPattern(), 'snare', reduceHit(1, 0, 1), 'highTom', reduceHit(0, 0, 1))
assert.equal(missing.highTom.length, 0)

const rock = findPreset('rock-44')
assert.ok(rock)
const bars = barsForPreset(rock)
const before = liveFactoryPatternKey(rock.bpm ?? 88, bars)
const movedBars = bars.map((bar, index) => {
  if (index !== 0) return cloneBar(bar)
  return {
    ...cloneBar(bar),
    pattern: moveHitPos(bar.pattern, 'snare', reduceHit(1, 0, 1), 'highTom', reduceHit(2, 0, 1)),
  }
})
assert.notEqual(
  liveFactoryPatternKey(rock.bpm ?? 88, movedBars),
  before,
  'moving a factory hit marks the live pattern dirty',
)
assert.equal(makeBar(4, 4, 4).beats, 4)

const gridSrc = readFileSync(new URL('../src/components/rhythm/DrumGrid.tsx', import.meta.url), 'utf8')
const stageSrc = readFileSync(new URL('../src/components/rhythm/DrumBarStage.tsx', import.meta.url), 'utf8')
const pageSrc = readFileSync(new URL('../src/pages/RhythmPage.tsx', import.meta.url), 'utf8')
const factorySrc = readFileSync(new URL('../src/hooks/useFactoryEditor.ts', import.meta.url), 'utf8')
assert.match(gridSrc, /onMoveHit/)
assert.match(gridSrc, /data-hit-ghost/)
assert.match(gridSrc, /data-drop-target/)
assert.match(gridSrc, /data-move-source/)
assert.match(gridSrc, /MOVE_ARM_MS/)
assert.match(gridSrc, /pending\.heldLong = true/)
assert.doesNotMatch(gridSrc, /if \(!pending\.filled\) return/)
assert.match(gridSrc, /onToggleSoft\(pending\.voice/)
assert.match(pageSrc, /placeOrToggleSoft/)
assert.match(gridSrc, /navigator\.vibrate/)
assert.match(gridSrc, /needsMoveArm/)
assert.match(stageSrc, /onMoveHit/)
assert.match(pageSrc, /moveHitPos/)
assert.match(pageSrc, /onMoveHit/)
assert.match(factorySrc, /patternDirty/)
assert.match(factorySrc, /liveFactoryPatternKey/)

console.log('move-hit: ok')
