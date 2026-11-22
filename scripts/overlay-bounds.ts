import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { FOLD_DEAD_PX, FOLD_LAPTOP, FOLD_BOOK } from '../src/lib/fold-mode.ts'
import {
  clampMenuToOverlayHost,
  laptopTopHalfRect,
  overlayBottomStaysAboveFold,
  overlayCloseOnLeft,
  overlayHostRect,
  overlayListColumns,
  OVERLAY_CLUSTER_RIGHT_PX,
  OVERLAY_OUTER_CLUSTER_RIGHT_PX,
} from '../src/lib/overlay-bounds.ts'

const laptop = laptopTopHalfRect(FOLD_LAPTOP.width, FOLD_LAPTOP.height)
assert.equal(laptop.x, 0)
assert.equal(laptop.y, 0)
assert.equal(laptop.width, 626)
assert.equal(laptop.height, FOLD_LAPTOP.height / 2 - FOLD_DEAD_PX)
assert.ok(laptop.height < FOLD_LAPTOP.height / 2, 'top half stops above the 16px crease')
assert.equal(overlayBottomStaysAboveFold(laptop.height, FOLD_LAPTOP.height), true)
assert.equal(overlayBottomStaysAboveFold(laptop.height + 40, FOLD_LAPTOP.height), false)

assert.deepEqual(overlayHostRect('laptop', 626, 890), laptop)
assert.deepEqual(overlayHostRect('book', 890, 626), { x: 0, y: 0, width: 890, height: 626 })
assert.deepEqual(overlayHostRect('off', 466, 678), { x: 0, y: 0, width: 466, height: 678 })

assert.equal(overlayListColumns({ width: 466, outer: true }), 1, 'outer portrait is a single-column list')
assert.equal(overlayListColumns({ width: 678, outer: true }), 1, 'outer landscape is a single-column list')
assert.equal(overlayListColumns({ width: 626, outer: false }), 1, 'inner laptop width stays one column')
assert.equal(overlayListColumns({ width: 890, outer: false }), 2, 'inner book can use two columns, never three')
assert.equal(overlayListColumns({ width: 1280, outer: false }), 2)
assert.equal(overlayCloseOnLeft(), true)

const menu = clampMenuToOverlayHost(400, 800, 196, 280, laptop)
assert.ok(menu.top + 8 <= laptop.height, 'bar menu stays in the laptop top half')
assert.ok(menu.left >= 8)

assert.equal(OVERLAY_CLUSTER_RIGHT_PX, 88)
assert.equal(OVERLAY_OUTER_CLUSTER_RIGHT_PX, 68)

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
assert.match(css, /\.overlay-host/)
assert.match(css, /env\(safe-area-inset-right/)
assert.match(css, /env\(safe-area-inset-left/)
assert.match(css, /html\[data-fold-layout='laptop'\] \[data-overlay-host\]/)
assert.match(css, /bottom: calc\(50% \+ 16px\)/)
assert.match(css, /html\[data-duo-display='outer'\]/)
assert.match(css, /html\[data-fold-layout='book'\]/)

const overlayFiles = [
  '../src/pages/RhythmPage.tsx',
  '../src/components/rhythm/ClickPresets.tsx',
  '../src/components/rhythm/EditorTempoSheet.tsx',
  '../src/components/rhythm/MidiMapSheet.tsx',
  '../src/components/rhythm/ListenTempo.tsx',
  '../src/components/rhythm/DrumRecorderSheet.tsx',
  '../src/components/rhythm/BarMenu.tsx',
  '../src/components/tuner/TuningSheet.tsx',
  '../src/components/tuner/A4ReferenceControl.tsx',
  '../src/components/tuner/CustomPresetEditor.tsx',
  '../src/components/FactoryEditorBar.tsx',
  '../src/components/PostureDebugOverlay.tsx',
  '../src/components/rhythm/KitFaders.tsx',
]

for (const rel of overlayFiles) {
  const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
  assert.match(src, /data-overlay-host|OverlayHost/, `${rel} must use OverlayHost / data-overlay-host`)
}

const page = readFileSync(new URL('../src/pages/RhythmPage.tsx', import.meta.url), 'utf8')
assert.match(page, /data-library-columns/)
assert.match(page, /overlayListColumns/)
assert.match(page, /listLayout \? 'grid-cols-1'/)
assert.doesNotMatch(page, /compact \? 'grid-cols-3'/)
assert.match(page, /SheetHeader/)
assert.match(page, /whitespace-normal break-words/)

const header = readFileSync(new URL('../src/components/SheetClose.tsx', import.meta.url), 'utf8')
assert.match(header, /data-sheet-close-side="left"/)
assert.match(header, /SheetCloseX label=\{closeLabel/)
assert.ok(
  header.indexOf('{onClose ? <SheetCloseX') < header.indexOf('<h2'),
  'close X is rendered before the sheet title',
)

const bookInner = overlayHostRect('book', FOLD_BOOK.width, FOLD_BOOK.height)
assert.equal(bookInner.width, 890)
assert.ok(OVERLAY_CLUSTER_RIGHT_PX < bookInner.width / 4, 'right cluster is a side strip, not half the sheet')

console.log('overlay-bounds ok')
