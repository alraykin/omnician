import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { emptyPattern, makeBar, setHitPos, reduceHit } from '../src/lib/rhythm.ts'
import {
  MAX_DRUM_HISTORY,
  captureDrumSnapshot,
  emptyDrumHistory,
  pushDrumHistory,
  redoDrumHistory,
  undoDrumHistory,
} from '../src/lib/drum-history.ts'

const a = [makeBar(4, 4, 4)]
const b = [makeBar(4, 4, 4, setHitPos(emptyPattern(), 'kick', reduceHit(0, 0, 1), true))]
const snapA = captureDrumSnapshot(a, 0, 0, 4)
const snapB = captureDrumSnapshot(b, 0, 0, 4)

let history = emptyDrumHistory()
history = pushDrumHistory(history, snapA)
assert.equal(history.past.length, 1)
assert.equal(history.future.length, 0)

const undone = undoDrumHistory(history, snapB)
assert.ok(undone)
assert.equal(undone.snapshot.bars[0]?.pattern.kick.length, 0)
assert.equal(undone.history.past.length, 0)
assert.equal(undone.history.future.length, 1)

const redone = redoDrumHistory(undone.history, undone.snapshot)
assert.ok(redone)
assert.equal(redone.snapshot.bars[0]?.pattern.kick.length, 1)
assert.equal(redone.history.future.length, 0)

history = emptyDrumHistory()
for (let i = 0; i < MAX_DRUM_HISTORY + 8; i += 1) {
  history = pushDrumHistory(history, captureDrumSnapshot(a, 0, i, 4))
}
assert.equal(history.past.length, MAX_DRUM_HISTORY)
assert.equal(history.past[0]?.fillVariant, 8)

const none = undoDrumHistory(emptyDrumHistory(), snapA)
assert.equal(none, null)
assert.equal(redoDrumHistory(emptyDrumHistory(), snapA), null)

const overlay = readFileSync(new URL('../src/components/rhythm/DrumEditorOverlay.tsx', import.meta.url), 'utf8')
assert.match(overlay, /data-editor-undo/)
assert.match(overlay, /data-editor-redo/)
assert.match(overlay, /disabled=\{\!canRedo\}/)
assert.match(overlay, /CompactMeter compact/)
assert.doesNotMatch(overlay, /\{playing \? 'Stop' : 'Play'\}<\/button>/)

const page = readFileSync(new URL('../src/pages/RhythmPage.tsx', import.meta.url), 'utf8')
assert.match(page, /data-drum-history/)
assert.match(page, /rememberDrums/)
assert.match(page, /resetDrumHistory/)
assert.match(page, /MAX_DRUM_HISTORY|pushDrumHistory/)

console.log('drum-history: ok')
