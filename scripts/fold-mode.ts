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
  foldBookPegBottom,
  foldLaptopGridMetrics,
  foldNeedleHidden,
  foldNeedleX,
  FOLD_GRID_ROWS,
  FOLD_PEG_H,
  layoutForTool,
  parseFoldChoice,
  pendulumAtExtreme,
  pendulumBeatIndex,
  pendulumNorm,
  resolveFoldLayout,
  splitPegs,
  tunerShowsBook,
} from '../src/lib/fold-mode.ts'
import {
  emptyNativePosture,
  resolveNativeFoldLayout,
  LAPTOP_HINGE_ENTER_MIN,
  LAPTOP_HINGE_ENTER_MAX,
} from '../src/lib/native-fold.ts'

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
assert.equal(resolveFoldLayout('auto', 932, 430, 'off'), 'tent', 'small landscape Click is Tent')
assert.equal(resolveFoldLayout('auto', 390, 844, 'off'), 'off')
assert.equal(detectFoldedLayout({ width: 932, height: 430 }), 'tent')
assert.equal(detectFoldedLayout({ width: 390, height: 844 }), 'off')
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
assert.equal(FOLD_GRID_ROWS, 14)
assert.equal(FOLD_PEG_H, 72)
assert.equal(foldBookPegBottom(0), 12)
assert.equal(foldBookPegBottom(20), 20)
{
  const at1024 = foldLaptopGridMetrics(1024, 40)
  assert.ok(at1024.row >= 22, `1024 laptop rows ${at1024.row}`)
  assert.equal(at1024.crease, 512)
  const at1004 = foldLaptopGridMetrics(1004, 40)
  assert.ok(at1004.row >= 22, `1004 laptop rows ${at1004.row}`)
  const withSafe = foldLaptopGridMetrics(1004, 50 + 40)
  assert.ok(withSafe.row > 18, `1004+safe still has 14 rows at ${withSafe.row}px`)
}

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

const shellSrc = readFileSync(new URL('../src/components/fold/FoldShell.tsx', import.meta.url), 'utf8')
assert.match(shellSrc, /100dvh/)
assert.match(shellSrc, /100dvw/)
const cssSrc = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
assert.doesNotMatch(cssSrc, /repeat\(14, 28px\)/)
assert.match(cssSrc, /--fold-row-h/)

const drumsSrc = readFileSync(new URL('../src/components/fold/DrumsLaptop.tsx', import.meta.url), 'utf8')
assert.match(drumsSrc, /data-fold-drums-grid/)
assert.match(drumsSrc, /DrumEditorGrid/)
assert.match(drumsSrc, /data-fold-bar-pills/)
assert.doesNotMatch(drumsSrc, /h-\[408px\]/)
assert.match(drumsSrc, /--fold-safe-top/)

const clickSrc = readFileSync(new URL('../src/components/fold/ClickLaptop.tsx', import.meta.url), 'utf8')
assert.match(clickSrc, /data-fold-click-bpm/)
assert.match(clickSrc, /ClickSoundPicker/)
const tempoColSrc = readFileSync(new URL('../src/components/fold/FoldTempoColumn.tsx', import.meta.url), 'utf8')
assert.match(tempoColSrc, /data-tempo-wheel-stack/)
assert.match(tempoColSrc, /gap-3/)
assert.match(tempoColSrc, /pt-3/)
assert.doesNotMatch(tempoColSrc, /mt-2 grid/)

const tentSrc = readFileSync(new URL('../src/components/fold/ClickTent.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(tentSrc, /rotate\(180deg\)/)
assert.doesNotMatch(tentSrc, /data-fold-face/)
assert.match(tentSrc, /data-fold-tent/)
assert.match(tentSrc, /data-fold-pendulum/)
assert.doesNotMatch(tentSrc, /data-fold-tent-exit/)
assert.match(tentSrc, /data-fold-tent-caption/)
assert.match(tentSrc, /--fold-safe-top/)
assert.match(tentSrc, /--fold-status-right/)
assert.doesNotMatch(tentSrc, /safe-overlay/)
assert.doesNotMatch(tentSrc, /FoldModeButton/)

const guardSrc = readFileSync(new URL('../src/components/PhonePortraitGuard.tsx', import.meta.url), 'utf8')
assert.match(guardSrc, /tentClick/)
assert.match(guardSrc, /foldLayout === 'tent'/)

const chromeSrc = readFileSync(new URL('../src/components/AppChrome.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(chromeSrc, /FoldModeButton/)

const pickerSrc = readFileSync(new URL('../src/components/fold/FoldModePicker.tsx', import.meta.url), 'utf8')
assert.match(pickerSrc, /return null/)
assert.doesNotMatch(pickerSrc, /data-fold-button/)

const bookSrc = readFileSync(new URL('../src/components/fold/TunerBook.tsx', import.meta.url), 'utf8')
assert.match(bookSrc, /left-\[104px\]/)
assert.match(bookSrc, /816px/)
assert.match(bookSrc, /right-\[calc\(50%\+16px\)\]/)
assert.match(bookSrc, /left-\[calc\(50%\+16px\)\]/)
assert.match(bookSrc, /data-fold-pegs/)
assert.match(bookSrc, /--fold-safe-bottom/)
assert.doesNotMatch(bookSrc, /top-\[624px\]/)

const settingsSrc = readFileSync(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(settingsSrc, /FoldModeSetting/)
assert.doesNotMatch(settingsSrc, /Fold mode/)

const innerPortrait = {
  ...emptyNativePosture(),
  display: 'inner' as const,
  orientation: 'portrait' as const,
  windowWidth: 720,
  windowHeight: 1024,
}
assert.equal(resolveNativeFoldLayout({ ...innerPortrait, hingeAvailable: true, hingeStatus: 'fullyOpen', hingeAngleDeg: 180 }), 'off')
assert.equal(
  resolveNativeFoldLayout({
    ...innerPortrait,
    hingeAvailable: true,
    hingeStatus: 'partiallyOpen',
    hingeAngleDeg: 100,
  }),
  'laptop',
)
assert.equal(
  resolveNativeFoldLayout(
    { ...innerPortrait, hingeAvailable: true, hingeStatus: 'partiallyOpen', hingeAngleDeg: 60 },
    'laptop',
  ),
  'laptop',
  'hysteresis holds laptop down to 55°',
)
assert.equal(
  resolveNativeFoldLayout({
    ...innerPortrait,
    hingeAvailable: true,
    hingeStatus: 'partiallyOpen',
    hingeAngleDeg: 50,
  }),
  'off',
)
assert.ok(LAPTOP_HINGE_ENTER_MIN === 70 && LAPTOP_HINGE_ENTER_MAX === 130)
assert.equal(
  resolveNativeFoldLayout({
    ...emptyNativePosture(),
    display: 'inner',
    orientation: 'landscape',
    windowWidth: 1024,
    windowHeight: 720,
    hingeAvailable: true,
    hingeStatus: 'fullyOpen',
    hingeAngleDeg: 180,
  }),
  'book',
)
assert.equal(
  resolveNativeFoldLayout({
    ...emptyNativePosture(),
    display: 'outer',
    orientation: 'landscape',
    windowWidth: 678,
    windowHeight: 466,
    hingeAvailable: true,
    hingeStatus: 'closed',
    hingeAngleDeg: 0,
  }),
  'tent',
)
assert.equal(
  resolveNativeFoldLayout({
    ...emptyNativePosture(),
    display: 'outer',
    orientation: 'portrait',
    windowWidth: 390,
    windowHeight: 844,
    hingeAvailable: true,
    hingeStatus: 'closed',
    hingeAngleDeg: 0,
  }),
  'off',
)
assert.equal(
  resolveNativeFoldLayout({
    ...innerPortrait,
    hingeAvailable: false,
    motionAvailable: true,
    gravityX: 0.05,
    gravityY: -0.7,
    gravityZ: -0.7,
  }),
  'laptop',
)

console.log('fold-mode ok')
