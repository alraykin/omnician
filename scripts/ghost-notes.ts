import assert from 'node:assert/strict'

import { realizeDrumBar } from '../src/lib/kit-intensity-play.ts'
import { SOFT_VEL_RATIO, playOptsForRole, snareHitRole } from '../src/lib/kit-intensity.ts'
import { MIDI_SOFT_VELOCITY, importNotesFromParsed } from '../src/lib/midi-import.ts'
import { DEFAULT_MIDI_MAP } from '../src/lib/midi-map.ts'
import { encodeMidi, parseMidi } from '../src/lib/midi-file.ts'
import {
  isHitSoft,
  makeBar,
  markHitsSoft,
  reduceHit,
  setHitPos,
  toggleHitSoft,
} from '../src/lib/rhythm.ts'
import { barsForPreset, findPreset } from '../src/lib/rhythm-presets.ts'

assert.equal(SOFT_VEL_RATIO, 0.5)
assert.equal(MIDI_SOFT_VELOCITY, 70)

const offbeat = reduceHit(0, 1, 2)
assert.equal(snareHitRole(offbeat), 'normal', 'offbeat snare is full unless marked soft')
assert.equal(snareHitRole({ ...offbeat, soft: true }), 'ghost')

const empty = makeBar(4, 4, 4)
const withSnare = {
  ...empty,
  pattern: setHitPos(setHitPos(empty.pattern, 'snare', reduceHit(1, 0, 1), true), 'snare', reduceHit(1, 3, 4, true), true),
}
const realized = realizeDrumBar(withSnare, 'high')
const full = realized.hits.find((hit) => hit.hit.num === 0)
const soft = realized.hits.find((hit) => hit.hit.num !== 0)
assert.ok(full && soft)
assert.equal(full.role, 'normal')
assert.equal(soft.role, 'ghost')
assert.ok(Math.abs(soft.vel / full.vel - SOFT_VEL_RATIO) < 1e-9)
assert.equal(full.vel, realizeDrumBar({
  ...empty,
  pattern: setHitPos(empty.pattern, 'snare', reduceHit(0, 1, 2), true),
}, 'high').hits[0]!.vel, 'offbeat snare matches downbeat when not soft')

const ghostPreview = playOptsForRole('high', 'ghost')
const normalPreview = playOptsForRole('high', 'normal')
assert.ok(Math.abs(ghostPreview.vel / normalPreview.vel - SOFT_VEL_RATIO) < 1e-9)

const toggled = toggleHitSoft(withSnare.pattern, 'snare', reduceHit(1, 0, 1))
assert.equal(isHitSoft(toggled.snare.find((hit) => hit.num === 0)!), true)
assert.equal(isHitSoft(toggleHitSoft(toggled, 'snare', reduceHit(1, 0, 1)).snare.find((hit) => hit.num === 0)!), false)

const rock = findPreset('rock-44')
assert.ok(rock)
const rockBars = barsForPreset(rock)
assert.equal(isHitSoft(rockBars[0]!.pattern.snare.find((hit) => hit.beat === 1)!), false)
assert.equal(isHitSoft(rockBars[1]!.pattern.snare.find((hit) => hit.beat === 3 && hit.num === 3)!), true, 'Rock 1 bar 2 last-16th ghost')

const funk = findPreset('funk-44')
assert.ok(funk)
const funkBar = barsForPreset(funk)[0]!
assert.ok(funkBar.pattern.rim.every(isHitSoft), 'Funk 1 rims are authored ghosts')
assert.ok(funkBar.pattern.snare.every((hit) => !isHitSoft(hit)), 'Funk 1 backbeats stay full')

const marked = markHitsSoft(empty.pattern, 4, 4, { kick: [0] })
assert.equal(marked.kick.length, 0)

const midi = encodeMidi({
  ppq: 480,
  bpm: 100,
  beats: 4,
  beatUnit: 4,
  notes: [
    { tick: 0, note: 38, velocity: 108 },
    { tick: 240, note: 38, velocity: 55 },
  ],
})
const imported = importNotesFromParsed(parseMidi(midi), DEFAULT_MIDI_MAP, 'ghosts.mid')
const snares = imported.bars[0]!.pattern.snare
assert.equal(snares.length, 2)
assert.equal(isHitSoft(snares.find((hit) => hit.num === 0)!), false)
assert.equal(isHitSoft(snares.find((hit) => hit.num !== 0)!), true)

console.log('ghost-notes: ok')
