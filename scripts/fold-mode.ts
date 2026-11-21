import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  FOLD_BOOK,
  FOLD_CHOICES,
  FOLD_COVER_CHOICES,
  FOLD_DEAD_PX,
  FOLD_LAPTOP,
  FOLD_MIN_SIDE_PX,
  FOLD_NEEDLE_REACH_PX,
  FOLD_STATUS_LANDSCAPE,
  FOLD_STATUS_PORTRAIT,
  canUseFoldLayout,
  clickShowsTent,
  cycleFoldChoice,
  detectFoldedLayout,
  foldChoicesForSize,
  foldNeedleHidden,
  foldNeedleX,
  layoutForTool,
  parseFoldChoice,
  pendulumAtExtreme,
  pendulumBeatIndex,
  pendulumNorm,
  resolveFoldLayout,
  splitPegs,
  tunerShowsBook,
} from '../src/lib/fold-mode.ts'

assert.deepEqual([...FOLD_CHOICES], ['off', 'auto', 'laptop', 'book', 'tent'])
assert.equal(parseFoldChoice('laptop'), 'laptop')
assert.equal(parseFoldChoice('nope'), 'off')
assert.equal(cycleFoldChoice('off'), 'auto')
assert.equal(cycleFoldChoice('tent'), 'off')
assert.deepEqual([...foldChoicesForSize(390, 844)], [...FOLD_COVER_CHOICES])
assert.equal(cycleFoldChoice('auto', false), 'tent')
assert.equal(cycleFoldChoice('tent', false), 'off')

assert.equal(FOLD_MIN_SIDE_PX, 640)
assert.equal(FOLD_DEAD_PX, 16)
assert.deepEqual(FOLD_LAPTOP, { width: 720, height: 1024 })
assert.deepEqual(FOLD_BOOK, { width: 1024, height: 720 })
assert.deepEqual(FOLD_STATUS_PORTRAIT, { x: 496, y: 0, w: 224, h: 88 })
assert.deepEqual(FOLD_STATUS_LANDSCAPE, { x: 936, y: 0, w: 88, h: 260 })

assert.equal(canUseFoldLayout(720, 1024), true)
assert.equal(canUseFoldLayout(1024, 720), true)
assert.equal(canUseFoldLayout(430, 932), false, 'phone never enters fold layouts')
assert.equal(canUseFoldLayout(639, 1024), false)

assert.equal(detectFoldedLayout({ verticalSegments: 2 }), 'laptop')
assert.equal(detectFoldedLayout({ horizontalSegments: 2 }), 'book')
assert.equal(
  detectFoldedLayout({
    segments: [
      { x: 0, y: 0, width: 720, height: 512 },
      { x: 0, y: 512, width: 720, height: 512 },
    ],
  }),
  'laptop',
)
assert.equal(
  detectFoldedLayout({
    segments: [
      { x: 0, y: 0, width: 512, height: 720 },
      { x: 512, y: 0, width: 512, height: 720 },
    ],
  }),
  'book',
)
assert.equal(detectFoldedLayout({ posture: 'folded' }), 'off', 'folded without segments is not guessed')
assert.equal(detectFoldedLayout({}), 'off')

assert.equal(resolveFoldLayout('off', 720, 1024, 'laptop'), 'off')
assert.equal(resolveFoldLayout('auto', 720, 1024, 'laptop'), 'laptop')
assert.equal(resolveFoldLayout('auto', 430, 932, 'laptop'), 'off')
assert.equal(resolveFoldLayout('tent', 720, 1024), 'tent')
assert.equal(resolveFoldLayout('tent', 390, 844), 'tent', 'Tent works on the cover screen')
assert.equal(resolveFoldLayout('tent', 932, 430), 'tent')
assert.equal(resolveFoldLayout('laptop', 390, 844), 'off', 'Laptop does not run on a phone-sized cover')
assert.equal(resolveFoldLayout('auto', 720, 1024, 'off'), 'off', 'missing APIs => Auto is Off')
assert.equal(clickShowsTent('tent', false), true)
assert.equal(clickShowsTent('tent', true), false, 'portrait Tent keeps normal Click')
assert.equal(clickShowsTent('off', false), false)

assert.equal(layoutForTool('laptop', 'drums'), 'laptop')
assert.equal(layoutForTool('laptop', 'click'), 'laptop')
assert.equal(layoutForTool('laptop', 'tuner', 720, 1024), 'off')
assert.equal(layoutForTool('off', 'tuner', 1024, 720), 'book', 'large landscape Tuner is Book even when Fold is Off')
assert.equal(layoutForTool('off', 'tuner', 1024, 704), 'book')
assert.equal(layoutForTool('off', 'tuner', 720, 1024), 'off', 'large portrait Tuner stays normal')
assert.equal(layoutForTool('off', 'tuner', 390, 844), 'off')
assert.equal(layoutForTool('book', 'tuner', 1024, 720), 'book')
assert.equal(layoutForTool('book', 'click'), 'off')
assert.equal(layoutForTool('tent', 'click'), 'tent')
assert.equal(layoutForTool('tent', 'drums'), 'off')
assert.equal(layoutForTool('off', 'click'), 'off')
assert.equal(tunerShowsBook(1024, 720), true)
assert.equal(tunerShowsBook(1024, 704), true)
assert.equal(tunerShowsBook(720, 1024), false)
assert.equal(tunerShowsBook(390, 844), false)

assert.equal(foldNeedleX(0), 0)
assert.equal(foldNeedleX(50), FOLD_NEEDLE_REACH_PX)
assert.equal(foldNeedleX(-50), -FOLD_NEEDLE_REACH_PX)
assert.equal(foldNeedleHidden(0, true), false)
assert.equal(foldNeedleHidden(0, false), false, 'exactly 0¢ stays visible')
assert.equal(foldNeedleHidden(1.2, false), true, 'inside 16px dead zone, not in-tune')
assert.equal(foldNeedleHidden(1.2, true), false, 'in-tune needle is drawn in the crease')
assert.equal(foldNeedleHidden(20, false), false)

assert.equal(pendulumNorm(0, 4), 1)
assert.ok(Math.abs(pendulumNorm(0.25, 4) + 1) < 1e-9, 'end of beat 1 is the opposite extreme')
assert.ok(Math.abs(pendulumNorm(0.5, 4) - 1) < 1e-9)
assert.equal(pendulumBeatIndex(0, 4), 0)
assert.equal(pendulumBeatIndex(0.24, 4), 0)
assert.equal(pendulumBeatIndex(0.25, 4), 1)
assert.equal(pendulumAtExtreme(1), true)
assert.equal(pendulumAtExtreme(-1), true)
assert.equal(pendulumAtExtreme(0), false)

const pegs = splitPegs(['E', 'A', 'D', 'G', 'B', 'e'])
assert.deepEqual(pegs.left, ['E', 'A', 'D'])
assert.deepEqual(pegs.right, ['G', 'B', 'e'])

const drumsSrc = readFileSync(new URL('../src/components/fold/DrumsLaptop.tsx', import.meta.url), 'utf8')
assert.match(drumsSrc, /data-fold-drums-grid/)
assert.match(drumsSrc, /14/)
assert.match(drumsSrc, /DrumEditorGrid/)

const clickSrc = readFileSync(new URL('../src/components/fold/ClickLaptop.tsx', import.meta.url), 'utf8')
assert.match(clickSrc, /data-fold-click-bpm/)
assert.match(clickSrc, /ClickSoundPicker/)

const tentSrc = readFileSync(new URL('../src/components/fold/ClickTent.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(tentSrc, /rotate\(180deg\)/)
assert.doesNotMatch(tentSrc, /data-fold-face/)
assert.match(tentSrc, /data-fold-tent/)
assert.match(tentSrc, /data-fold-pendulum/)
assert.match(tentSrc, /data-fold-tent-exit/)
assert.match(tentSrc, /safe-overlay/)

const guardSrc = readFileSync(new URL('../src/components/PhonePortraitGuard.tsx', import.meta.url), 'utf8')
assert.match(guardSrc, /tentClick/)

const pickerSrc = readFileSync(new URL('../src/components/fold/FoldModePicker.tsx', import.meta.url), 'utf8')
assert.match(pickerSrc, /outer screen, landscape/)
assert.match(pickerSrc, /startsWith\('\/click'\)/)
assert.match(pickerSrc, /FOLD_COVER_CHOICES/)
assert.match(pickerSrc, /grid-cols-3/)

const bookSrc = readFileSync(new URL('../src/components/fold/TunerBook.tsx', import.meta.url), 'utf8')
assert.match(bookSrc, /left-\[104px\]/)
assert.match(bookSrc, /top-\[400px\]/)
assert.match(bookSrc, /w-\[816px\]/)
assert.match(bookSrc, /right-\[calc\(50%\+16px\)\]/)
assert.match(bookSrc, /left-\[calc\(50%\+16px\)\]/)

const settingsSrc = readFileSync(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8')
assert.match(settingsSrc, /FoldModeSetting/)
assert.match(settingsSrc, /Tent \(outer screen, landscape\)/)
assert.equal((settingsSrc.match(/<FoldModeSetting \/>/g) ?? []).length, 3)

console.log('fold-mode ok')
