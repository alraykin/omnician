import assert from 'node:assert/strict'

import { emptyPattern, makeBar, setHit } from '../src/lib/rhythm.ts'
import {
  barsEqual,
  createUserBeat,
  deleteUserBeat,
  makeBlankBar,
  renameUserBeat,
  upsertUserBeat,
} from '../src/lib/user-beats.ts'

const blank = makeBlankBar({ beats: 4, beatUnit: 4, subdivision: 4 })
assert.equal(blank.beats, 4)
assert.equal(blank.pattern.kick.length, 0)
assert.equal(blank.pattern.snare.length, 0)

const filled = makeBar(4, 4, 4, setHit(emptyPattern(), 'kick', 0, 4, 4, true))
assert.equal(barsEqual([blank], [blank]), true)
assert.equal(barsEqual([blank], [filled]), false)

const saved = createUserBeat(' Practice groove ', 128, [filled], 'ub-test')
assert.equal(saved.name, 'Practice groove')
assert.equal(saved.bpm, 128)
assert.equal(saved.id, 'ub-test')
assert.equal(saved.bars[0]?.pattern.kick.length, 1)

let list = upsertUserBeat([], saved)
assert.equal(list.length, 1)
list = upsertUserBeat(list, { ...saved, bpm: 100 })
assert.equal(list.length, 1)
assert.equal(list[0]?.bpm, 100)

list = renameUserBeat(list, 'ub-test', '  Pocket  ')
assert.equal(list[0]?.name, 'Pocket')
list = renameUserBeat(list, 'ub-test', '   ')
assert.equal(list[0]?.name, 'Pocket')

list = deleteUserBeat(list, 'ub-test')
assert.equal(list.length, 0)

console.log('user-beats: ok')
