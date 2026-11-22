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
  easePendulumToCenter,
  pendulumAtExtreme,
  pendulumBeatIndex,
  pendulumBeatIndexFromPhase,
  pendulumBeatPhase,
  pendulumNorm,
  pendulumNormFromBeatPhase,
  rebasePendulumClock,
  resolveFoldLayout,
  splitPegs,
  tunerShowsBook,
} from '../src/lib/fold-mode.ts'
import {
  detectCoverPortraitRail,
  modelLooksLikeDuo,
  sizeMatchesDuoOuter,
} from '../src/lib/duo-layout.ts'
import {
  emptyNativePosture,
  hydrateNativePosture,
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

assert.equal(FOLD_MIN_SIDE_PX, 600)
assert.equal(FOLD_DEAD_PX, 16)
assert.deepEqual(FOLD_LAPTOP, { width: 626, height: 890 })
assert.deepEqual(FOLD_BOOK, { width: 890, height: 626 })
assert.deepEqual(FOLD_STATUS_PORTRAIT, { x: 496, y: 0, w: 224, h: 88 })
assert.deepEqual(FOLD_STATUS_LANDSCAPE, { x: 936, y: 0, w: 88, h: 260 })

assert.equal(canUseFoldLayout(626, 890), true)
assert.equal(canUseFoldLayout(890, 626), true)
assert.equal(canUseFoldLayout(720, 1024), true)
assert.equal(canUseFoldLayout(1024, 720), true)
assert.equal(canUseFoldLayout(430, 932), false, 'phone never enters fold layouts')
assert.equal(canUseFoldLayout(466, 678), false, 'Duo outer cover is not inner')
assert.equal(canUseFoldLayout(599, 900), false)

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
assert.equal(layoutForTool('laptop', 'tuner', 626, 890), 'laptop', 'inner laptop Tuner splits at the crease')
assert.equal(layoutForTool('laptop', 'tuner', 720, 1024), 'laptop', 'inner laptop Tuner splits at the crease')
assert.equal(layoutForTool('off', 'tuner', 890, 626), 'book', 'large landscape Tuner is Book even when Fold is Off')
assert.equal(layoutForTool('off', 'tuner', 1024, 720), 'book', 'large landscape Tuner is Book even when Fold is Off')
assert.equal(layoutForTool('off', 'tuner', 1024, 704), 'book')
assert.equal(layoutForTool('off', 'tuner', 678, 466), 'book', 'outer landscape Tuner is landscape')
assert.equal(layoutForTool('tent', 'tuner', 678, 466), 'book')
assert.equal(layoutForTool('off', 'tuner', 626, 890), 'off', 'large portrait Tuner stays normal')
assert.equal(layoutForTool('off', 'tuner', 390, 844), 'off')
assert.equal(layoutForTool('book', 'tuner', 890, 626), 'book')
assert.equal(layoutForTool('book', 'click'), 'off')
assert.equal(layoutForTool('tent', 'click'), 'tent')
assert.equal(layoutForTool('tent', 'drums'), 'off')
assert.equal(layoutForTool('off', 'click'), 'off')
assert.equal(tunerShowsBook(890, 626), true)
assert.equal(tunerShowsBook(1024, 720), true)
assert.equal(tunerShowsBook(1024, 704), true)
assert.equal(tunerShowsBook(626, 890), false)
assert.equal(tunerShowsBook(720, 1024), false)
assert.equal(tunerShowsBook(390, 844), false)
assert.equal(tunerShowsBook(466, 678), false)
assert.equal(FOLD_GRID_ROWS, 14)
assert.equal(FOLD_PEG_H, 72)
assert.equal(foldBookPegBottom(0), 12)
assert.equal(foldBookPegBottom(20), 20)
{
  const atLaptop = foldLaptopGridMetrics(890, 40)
  assert.ok(atLaptop.row >= 22, `890 laptop rows ${atLaptop.row}`)
  assert.equal(atLaptop.crease, 445)
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

assert.equal(pendulumNormFromBeatPhase(0), 1)
assert.ok(Math.abs(pendulumNormFromBeatPhase(1) + 1) < 1e-9)
assert.ok(Math.abs(pendulumNormFromBeatPhase(2) - 1) < 1e-9)
assert.ok(Math.abs(pendulumNormFromBeatPhase(3) + 1) < 1e-9)
assert.equal(pendulumBeatIndexFromPhase(0, 1), 0)
assert.equal(pendulumBeatIndexFromPhase(1.2, 1), 0)
assert.equal(pendulumBeatIndexFromPhase(2.1, 4), 2)

const wrapOld = pendulumNorm(0.999, 1)
const wrapNew = pendulumNormFromBeatPhase(0.999)
assert.ok(wrapOld < -0.99 && wrapNew < -0.99)
const afterWrapOld = pendulumNorm(0, 1)
const afterWrapNew = pendulumNormFromBeatPhase(1.001)
assert.equal(afterWrapOld, 1, 'bar-fraction wrap on 1-beat Click snaps back to left')
assert.ok(afterWrapNew < -0.99, 'monotonic beat phase continues through the right extreme')

let jump = 0
let prev = pendulumNormFromBeatPhase(0)
const frames: { t: number; side: string; norm: string }[] = []
for (let i = 1; i <= 800; i += 1) {
  const t = i / 200
  const n = pendulumNormFromBeatPhase(t)
  jump = Math.max(jump, Math.abs(n - prev))
  if (pendulumAtExtreme(n) && (frames.length === 0 || Math.sign(n) !== Math.sign(Number(frames.at(-1)?.norm)))) {
    frames.push({ t, side: n > 0 ? 'L' : 'R', norm: n.toFixed(3) })
  }
  prev = n
}
assert.ok(jump < 0.04, `continuous swing, max frame jump ${jump}`)
assert.ok(frames.length >= 4, 'several extremes')
const sides = frames.slice(0, 8).map((f) => f.side)
for (let i = 1; i < sides.length; i += 1) {
  assert.notEqual(sides[i], sides[i - 1], `alternating extremes, got ${sides.join('')}`)
}
assert.ok(sides.includes('L') && sides.includes('R'))
console.log('pendulum frame log', frames.slice(0, 8))

const rebased = rebasePendulumClock(1.2, 0, 0, 0.5, 0.25)
assert.ok(Math.abs(pendulumBeatPhase(1.2, 0, 0, 0.5) - rebased.originBeatPhase) < 1e-12)
const before = pendulumNormFromBeatPhase(pendulumBeatPhase(1.2, 0, 0, 0.5))
const after = pendulumNormFromBeatPhase(
  pendulumBeatPhase(1.2, rebased.originAudioTime, rebased.originBeatPhase, rebased.beatSec),
)
assert.ok(Math.abs(before - after) < 1e-12, 'tempo rebase does not jump')

assert.ok(Math.abs(easePendulumToCenter(1, 0.5)) < 0.02)
assert.equal(easePendulumToCenter(0.004, 0.016), 0)

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
assert.match(drumsSrc, /scroll/)

const clickSrc = readFileSync(new URL('../src/components/fold/ClickLaptop.tsx', import.meta.url), 'utf8')
assert.match(clickSrc, /data-fold-click-bpm/)
assert.match(clickSrc, /ClickSoundPicker/)
assert.match(clickSrc, /ClickPendulum/)
assert.match(clickSrc, /scroll/)
const tempoColSrc = readFileSync(new URL('../src/components/fold/FoldTempoColumn.tsx', import.meta.url), 'utf8')
assert.match(tempoColSrc, /data-tempo-wheel-stack/)
assert.match(tempoColSrc, /gap-3/)
assert.match(tempoColSrc, /pt-3/)
assert.doesNotMatch(tempoColSrc, /mt-2 grid/)

const tentSrc = readFileSync(new URL('../src/components/fold/ClickTent.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(tentSrc, /rotate\(180deg\)/)
assert.doesNotMatch(tentSrc, /data-fold-face/)
assert.match(tentSrc, /data-fold-tent/)
assert.match(tentSrc, /ClickPendulum/)
const pendulumSrc = readFileSync(new URL('../src/components/fold/ClickPendulum.tsx', import.meta.url), 'utf8')
assert.match(pendulumSrc, /data-fold-pendulum/)
assert.match(pendulumSrc, /pendulumNormFromBeatPhase/)
assert.match(pendulumSrc, /rebasePendulumClock/)
assert.match(pendulumSrc, /easePendulumToCenter/)
assert.doesNotMatch(tentSrc, /fracInBar/)
assert.doesNotMatch(tentSrc, /data-fold-tent-exit/)
assert.match(tentSrc, /data-fold-tent-caption/)
assert.match(tentSrc, /--fold-safe-top/)
assert.match(tentSrc, /--fold-status-right/)
assert.doesNotMatch(tentSrc, /safe-overlay/)
assert.doesNotMatch(tentSrc, /FoldModeButton/)

const guardSrc = readFileSync(new URL('../src/components/PhonePortraitGuard.tsx', import.meta.url), 'utf8')
assert.match(guardSrc, /tentClick/)
assert.match(guardSrc, /tunerLandscape/)
assert.match(guardSrc, /foldLayout === 'tent'/)

const chromeSrc = readFileSync(new URL('../src/components/AppChrome.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(chromeSrc, /FoldModeButton/)
assert.match(chromeSrc, /DuoRail/)
assert.match(chromeSrc, /useCoverPortraitRail/)
assert.match(chromeSrc, /duo-cover-shell/)

const railSrc = readFileSync(new URL('../src/components/DuoRail.tsx', import.meta.url), 'utf8')
assert.match(railSrc, /data-duo-rail/)
assert.match(railSrc, /data-settings-gear/)
assert.match(railSrc, /right-0/)
assert.match(railSrc, /--duo-rail-width/)
assert.match(railSrc, /--safe-bottom/)
assert.match(railSrc, /--safe-top/)
assert.doesNotMatch(railSrc, /right: 'var\(--duo-status-strip\)'/)

const stripSrc = readFileSync(new URL('../src/components/DuoStatusStrip.tsx', import.meta.url), 'utf8')
assert.match(stripSrc, /bg-transparent/)
assert.doesNotMatch(stripSrc, /bg-\[#070A12\]/)

const tunerPageSrc = readFileSync(new URL('../src/pages/TunerPage.tsx', import.meta.url), 'utf8')
assert.match(tunerPageSrc, /data-tuner-cover/)
assert.doesNotMatch(tunerPageSrc, /grid-cols-\[minmax\(0,1fr\)_minmax\(9\.25rem,38%\)\]/)

const duoLayoutSrc = readFileSync(new URL('../src/lib/duo-layout.ts', import.meta.url), 'utf8')
assert.match(duoLayoutSrc, /width: 466/)
assert.match(duoLayoutSrc, /height: 678/)
assert.match(duoLayoutSrc, /DUO_STATUS_STRIP_PX = 68/)
assert.match(duoLayoutSrc, /DUO_RAIL_WIDTH_PX = 68/)

const landscapeSrc = readFileSync(new URL('../src/components/fold/TunerLandscape.tsx', import.meta.url), 'utf8')
assert.match(landscapeSrc, /data-tuner-landscape/)
assert.doesNotMatch(landscapeSrc, /FoldCrease/)

const laptopTunerSrc = readFileSync(new URL('../src/components/fold/TunerLaptop.tsx', import.meta.url), 'utf8')
assert.match(laptopTunerSrc, /side="top"/)
assert.match(laptopTunerSrc, /side="bottom"/)
assert.match(laptopTunerSrc, /scroll/)
assert.match(laptopTunerSrc, /TunerTarget/)
assert.match(laptopTunerSrc, /Headstock/)

const clickLaptopSrc = readFileSync(new URL('../src/components/fold/ClickLaptop.tsx', import.meta.url), 'utf8')
assert.match(clickLaptopSrc, /ClickPendulum/)
assert.match(clickLaptopSrc, /side="bottom"[\s\S]*scroll/)
assert.match(readFileSync(new URL('../src/components/fold/FoldShell.tsx', import.meta.url), 'utf8'), /data-fold-crease-line/)

const drumsLaptopSrc = readFileSync(new URL('../src/components/fold/DrumsLaptop.tsx', import.meta.url), 'utf8')
assert.match(drumsLaptopSrc, /data-fold-drums-grid/)
assert.match(drumsLaptopSrc, /side="bottom"[\s\S]*scroll/)

const pickerSrc = readFileSync(new URL('../src/components/fold/FoldModePicker.tsx', import.meta.url), 'utf8')
assert.match(pickerSrc, /return null/)
assert.doesNotMatch(pickerSrc, /data-fold-button/)

const bookSrc = readFileSync(new URL('../src/components/fold/TunerBook.tsx', import.meta.url), 'utf8')
assert.match(bookSrc, /data-fold-tuner-scale/)
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
  windowWidth: 626,
  windowHeight: 890,
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
  'laptop',
  'partiallyOpen status is laptop even if the angle is outside the enter band',
)
assert.equal(
  resolveNativeFoldLayout({
    ...innerPortrait,
    hingeAvailable: true,
    hingeStatus: 'partiallyOpen',
  }),
  'laptop',
  'partiallyOpen without an angle is laptop',
)
assert.equal(
  resolveNativeFoldLayout({
    ...innerPortrait,
    hingeAvailable: true,
    motionAvailable: true,
    gravityX: 0.05,
    gravityY: -0.7,
    gravityZ: -0.7,
  }),
  'laptop',
  'gravity still detects laptop when hingeAvailable is true but angle/status never arrive',
)
assert.equal(
  resolveNativeFoldLayout({
    ...innerPortrait,
    hingeAvailable: true,
    hingeStatus: 'fullyOpen',
    hingeAngleDeg: 180,
    motionAvailable: true,
    gravityX: 0.05,
    gravityY: -0.7,
    gravityZ: -0.7,
  }),
  'off',
  'fully open flat stays off even if gravity looks laptop',
)
assert.ok(LAPTOP_HINGE_ENTER_MIN === 70 && LAPTOP_HINGE_ENTER_MAX === 130)
assert.equal(
  resolveNativeFoldLayout({
    ...emptyNativePosture(),
    display: 'inner',
    orientation: 'landscape',
    windowWidth: 890,
    windowHeight: 626,
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

assert.equal(sizeMatchesDuoOuter(466, 678), true)
assert.equal(sizeMatchesDuoOuter(678, 466), true)
assert.equal(sizeMatchesDuoOuter(472, 672), true, '±6pt outer tolerance')
assert.equal(sizeMatchesDuoOuter(393, 852), false)
assert.equal(sizeMatchesDuoOuter(626, 890), false)
assert.equal(modelLooksLikeDuo('iPhone19,4'), true)
assert.equal(modelLooksLikeDuo('iPhone19_4'), true)
assert.equal(modelLooksLikeDuo('iPhone17,2'), false)

const outerPortrait = { width: 466, height: 678, nativeApp: true as const }
assert.equal(
  detectCoverPortraitRail(outerPortrait),
  true,
  'native Duo outer portrait uses size, not plugin display',
)
assert.equal(
  detectCoverPortraitRail({ ...outerPortrait, native: emptyNativePosture() }),
  true,
  'null/unknown plugin display still gets the cover rail on 466×678',
)
assert.equal(
  detectCoverPortraitRail({
    width: 466,
    height: 678,
    nativeApp: true,
    native: { ...emptyNativePosture(), display: 'unknown', model: 'iPhone19,4' },
  }),
  true,
)
assert.equal(
  detectCoverPortraitRail({ width: 393, height: 852, nativeApp: true }),
  false,
  'regular iPhone portrait is not the cover rail',
)
assert.equal(
  detectCoverPortraitRail({ width: 626, height: 890, nativeApp: true }),
  false,
  'inner portrait is never the cover rail',
)
assert.equal(
  detectCoverPortraitRail({ width: 678, height: 466, nativeApp: true }),
  false,
  'outer landscape stays two-column, not the portrait rail',
)
assert.equal(
  detectCoverPortraitRail({ width: 466, height: 678, nativeApp: false }),
  false,
  'web Safari at 466×678 does not get the rail without ?duo=outer',
)
assert.equal(detectCoverPortraitRail({ width: 466, height: 678, preview: true }), true)

assert.equal(
  hydrateNativePosture(emptyNativePosture(), { windowWidth: 466, windowHeight: 678 }).display,
  'outer',
)
assert.equal(
  hydrateNativePosture(emptyNativePosture(), { windowWidth: 626, windowHeight: 890 }).display,
  'inner',
)

assert.match(readFileSync(new URL('../src/lib/posture-debug.ts', import.meta.url), 'utf8'), /taps >= 5/)
assert.match(readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'), /PostureDebugOverlay/)

console.log('fold-mode ok')
