import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { makeBar, setBarSubdivision } from '../src/lib/rhythm.ts'
import { DEFAULT_SPEED_BUILDER } from '../src/lib/speed-builder.ts'
import {
  CLICK_PRESETS_KEY,
  clickBarsEqual,
  clickPresetMatches,
  clickPresetSummary,
  createClickPreset,
  deleteClickPreset,
  emptyClickPresetStore,
  findClickPreset,
  nextClickPresetName,
  parseClickPresetStore,
  renameClickPreset,
  upsertClickPreset,
} from '../src/lib/click-presets.ts'

const oneFour = makeBar(1, 4, 1)
const snap = {
  bpm: 88,
  clickSound: 'wood' as const,
  bars: [oneFour],
  speedBuilder: { ...DEFAULT_SPEED_BUILDER, enabled: false, fromPct: 70, toPct: 100 },
}

const saved = createClickPreset('Warm-up 88', snap, 'cp-warm')
assert.equal(saved.name, 'Warm-up 88')
assert.equal(saved.bpm, 88)
assert.equal(saved.clickSound, 'wood')
assert.equal(saved.bars[0]?.beats, 1)
assert.equal(saved.bars[0]?.subdivision, 1)
assert.equal(clickPresetMatches(saved, snap), true)

const shuffled = createClickPreset('Shuffle 120', {
  bpm: 120,
  clickSound: 'clave',
  bars: [setBarSubdivision(makeBar(4, 4, 3), 3), setBarSubdivision(makeBar(4, 4, 3), 3)],
  speedBuilder: { ...DEFAULT_SPEED_BUILDER },
}, 'cp-shuffle')
assert.equal(clickBarsEqual(saved.bars, shuffled.bars), false)
assert.equal(clickPresetMatches(saved, { ...snap, bpm: 90 }), false)

let store = emptyClickPresetStore()
store = upsertClickPreset(store, saved)
assert.equal(store.loadedId, 'cp-warm')
assert.equal(store.presets.length, 1)
store = upsertClickPreset(store, shuffled)
assert.equal(store.presets[0]?.id, 'cp-shuffle')
assert.equal(findClickPreset(store, 'cp-warm')?.name, 'Warm-up 88')

store = renameClickPreset(store, 'cp-warm', '  Pocket 88  ')
assert.equal(findClickPreset(store, 'cp-warm')?.name, 'Pocket 88')
store = renameClickPreset(store, 'cp-warm', '   ')
assert.equal(findClickPreset(store, 'cp-warm')?.name, 'Pocket 88')

store = deleteClickPreset(store, 'cp-warm')
assert.equal(store.presets.length, 1)
assert.equal(store.loadedId, 'cp-shuffle')
store = deleteClickPreset(store, 'cp-shuffle')
assert.equal(store.loadedId, null)

assert.equal(nextClickPresetName([]), 'Click preset 1')
assert.equal(nextClickPresetName([saved]), 'Click preset 2')

const summary = clickPresetSummary(snap, { alwaysSpeed: true })
assert.match(summary, /88 BPM/)
assert.match(summary, /1\/4/)
assert.match(summary, /Wood/)
assert.match(summary, /1 bar/)
assert.match(summary, /Speed 70 → 100%/)
assert.match(clickPresetSummary(shuffled), /2 bars/)

const parsed = parseClickPresetStore({
  loadedId: 'cp-warm',
  presets: [{ id: 'cp-warm', name: 'Warm-up 88', bpm: 88, clickSound: 'wood', bars: [oneFour], speedBuilder: snap.speedBuilder }],
})
assert.equal(parsed.loadedId, 'cp-warm')
assert.equal(parsed.presets[0]?.bars[0]?.beatAccents[0]?.beat, 0)

assert.equal(CLICK_PRESETS_KEY, 'omnician.click.presets.v1')

const page = readFileSync(new URL('../src/pages/RhythmPage.tsx', import.meta.url), 'utf8')
assert.match(page, /ClickPresetChip/)
assert.match(page, /ClickPresetsSheet/)
assert.match(page, /clickPresets/)
assert.doesNotMatch(page, /ListenTempoSheet/)
assert.doesNotMatch(page, /listenDemo/)
const sheet = readFileSync(new URL('../src/components/rhythm/ClickPresets.tsx', import.meta.url), 'utf8')
assert.match(sheet, /Save current/)
assert.match(sheet, /Loaded/)
assert.match(sheet, /data-click-preset-save/)
assert.match(sheet, /data-click-preset-edit/)
assert.match(sheet, /data-click-preset-delete/)
assert.match(sheet, /SheetBackdrop/)
assert.match(sheet, /SheetCloseX/)
assert.doesNotMatch(sheet, />Done</)

console.log('click-presets: ok')
