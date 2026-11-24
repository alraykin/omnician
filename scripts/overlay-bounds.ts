import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { FOLD_DEAD_PX, FOLD_LAPTOP, FOLD_BOOK } from '../src/lib/fold-mode.ts'
import {
  clampMenuToOverlayHost,
  laptopBottomHalfRect,
  laptopTopHalfRect,
  overlayCloseOnLeft,
  overlayHostRect,
  overlayListColumns,
  overlaySheetVisibleInLaptopBottom,
  overlayStaysInLaptopBottom,
  OVERLAY_CLUSTER_RIGHT_PX,
  OVERLAY_OUTER_CLUSTER_RIGHT_PX,
} from '../src/lib/overlay-bounds.ts'
import { clickBeatCircleClass } from '../src/components/rhythm/ClickBeatCircles.tsx'
import { chunkRows, CLICK_BEATS_PER_ROW } from '../src/lib/utils.ts'

const laptopTop = laptopTopHalfRect(FOLD_LAPTOP.width, FOLD_LAPTOP.height)
assert.equal(laptopTop.x, 0)
assert.equal(laptopTop.y, 0)
assert.equal(laptopTop.width, 626)
assert.equal(laptopTop.height, FOLD_LAPTOP.height / 2 - FOLD_DEAD_PX)

const laptop = laptopBottomHalfRect(FOLD_LAPTOP.width, FOLD_LAPTOP.height)
assert.equal(laptop.x, 0)
assert.equal(laptop.y, FOLD_LAPTOP.height / 2 + FOLD_DEAD_PX)
assert.equal(laptop.width, 626)
assert.equal(laptop.height, FOLD_LAPTOP.height / 2 - FOLD_DEAD_PX)
assert.ok(laptop.y > FOLD_LAPTOP.height / 2, 'bottom half starts below the 16px crease')
assert.equal(overlayStaysInLaptopBottom(laptop.y, laptop.y + laptop.height, FOLD_LAPTOP.height), true)
assert.equal(overlayStaysInLaptopBottom(0, laptop.y + 40, FOLD_LAPTOP.height), false)
assert.equal(
  overlaySheetVisibleInLaptopBottom(
    { top: laptop.y, bottom: laptop.y + laptop.height, height: laptop.height, width: 626 },
    FOLD_LAPTOP.height,
  ),
  true,
)
assert.equal(
  overlaySheetVisibleInLaptopBottom(
    { top: 0, bottom: 40, height: 40, width: 626 },
    FOLD_LAPTOP.height,
  ),
  false,
  'a sheet parked in the top half is not visible',
)
assert.equal(
  overlaySheetVisibleInLaptopBottom(
    { top: laptop.y, bottom: laptop.y, height: 0, width: 626 },
    FOLD_LAPTOP.height,
  ),
  false,
  'zero-height sheets are not visible',
)

assert.deepEqual(overlayHostRect('laptop', 626, 890), laptop)
assert.deepEqual(overlayHostRect('book', 890, 626), { x: 0, y: 0, width: 890, height: 626 })
assert.deepEqual(overlayHostRect('off', 466, 678), { x: 0, y: 0, width: 466, height: 678 })

assert.equal(overlayListColumns({ width: 466, outer: true }), 1, 'outer portrait is a single-column list')
assert.equal(overlayListColumns({ width: 678, outer: true }), 1, 'outer landscape is a single-column list')
assert.equal(overlayListColumns({ width: 626, outer: false }), 1, 'inner laptop width stays one column')
assert.equal(overlayListColumns({ width: 890, outer: false }), 2, 'inner book can use two columns, never three')
assert.equal(overlayListColumns({ width: 1280, outer: false }), 2)
assert.equal(overlayCloseOnLeft(), true)

const menu = clampMenuToOverlayHost(400, 100, 196, 280, laptop)
assert.ok(menu.top >= laptop.y, 'bar menu stays in the laptop bottom half')
assert.ok(menu.top + 8 <= laptop.y + laptop.height)
assert.ok(menu.left >= 8)

assert.equal(OVERLAY_CLUSTER_RIGHT_PX, 88)
assert.equal(OVERLAY_OUTER_CLUSTER_RIGHT_PX, 68)

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
assert.match(css, /\.overlay-host/)
assert.match(css, /env\(safe-area-inset-right/)
assert.match(css, /env\(safe-area-inset-left/)
assert.match(css, /html\[data-fold-layout='laptop'\] \[data-overlay-host\]/)
assert.match(css, /top: calc\(50% \+ 16px\)/)
assert.doesNotMatch(
  css,
  /html\[data-fold-layout='laptop'\] \[data-overlay-host\][\s\S]{0,180}bottom: calc\(50% \+ 16px\)/,
)
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
assert.match(page, /flex-wrap items-center/)

const header = readFileSync(new URL('../src/components/SheetClose.tsx', import.meta.url), 'utf8')
assert.match(header, /createPortal/)
assert.match(header, /z-\[90\]/)
assert.match(header, /OVERLAY_HOST_Z_CLASS/)
assert.match(readFileSync(new URL('../src/components/fold/FoldShell.tsx', import.meta.url), 'utf8'), /z-\[82\]/)
assert.match(readFileSync(new URL('../src/components/rhythm/BarMenu.tsx', import.meta.url), 'utf8'), /className="fixed overflow-hidden/)
assert.match(header, /data-sheet-close-side="left"/)
assert.match(header, /SheetCloseX label=\{closeLabel/)
assert.ok(
  header.indexOf('{onClose ? <SheetCloseX') < header.indexOf('<h2'),
  'close X is rendered before the sheet title',
)
assert.match(header, /laptop bottom half/)

const bookInner = overlayHostRect('book', FOLD_BOOK.width, FOLD_BOOK.height)
assert.equal(bookInner.width, 890)
assert.ok(OVERLAY_CLUSTER_RIGHT_PX < bookInner.width / 4, 'right cluster is a side strip, not half the sheet')

assert.equal(CLICK_BEATS_PER_ROW, 8)
const sixteen = chunkRows(Array.from({ length: 16 }, (_, i) => i), CLICK_BEATS_PER_ROW)
assert.equal(sixteen.length, 2)
assert.deepEqual(sixteen[0], [0, 1, 2, 3, 4, 5, 6, 7])
assert.equal(sixteen[1]?.[0], 8, 'beat 9 sits under beat 1')
assert.match(clickBeatCircleClass(0, false), /text-slate-400/)
assert.match(clickBeatCircleClass(0, true), /bg-white/)
assert.match(clickBeatCircleClass(2, true), /bg-\[#A855F7\]/)
assert.match(clickBeatCircleClass(1, false), /text-\[#C4B5FD\]/)
assert.match(clickBeatCircleClass(2, false), /text-\[#E9D5FF\]/)

const circles = readFileSync(new URL('../src/components/rhythm/ClickBeatCircles.tsx', import.meta.url), 'utf8')
assert.match(circles, /data-click-beat-circles/)
assert.match(circles, /onCycleAccent/)
assert.match(circles, /CLICK_BEATS_PER_ROW/)

const accent = readFileSync(new URL('../src/components/rhythm/ClickAccentGrid.tsx', import.meta.url), 'utf8')
assert.match(accent, /grid-cols-8/)
assert.match(accent, /data-beat-wrap="true"/)
assert.doesNotMatch(accent, /flex w-full justify-center gap-1/)

const laptopClick = readFileSync(new URL('../src/components/fold/ClickLaptop.tsx', import.meta.url), 'utf8')
assert.match(laptopClick, /ClickBeatCircles/)
assert.match(laptopClick, /FoldPlayButton/)
assert.doesNotMatch(laptopClick, /flex h-11 items-center gap-1" data-fold-click-accent-edit/)

const tent = readFileSync(new URL('../src/components/fold/ClickTent.tsx', import.meta.url), 'utf8')
assert.match(tent, /ClickBeatCircles/)
assert.match(tent, /tap a number to accent/)
assert.doesNotMatch(tent, /block size-4 rounded-full/)

const home = readFileSync(new URL('../src/components/ToolButton.tsx', import.meta.url), 'utf8')
assert.match(home, /items-start/)
assert.match(home, /sm:justify-start/)
assert.doesNotMatch(home, /sm:justify-between/)

console.log('overlay-bounds ok')
