import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { DEFAULT_DRUM_INPUT } from '../src/lib/beat-boxes.ts'
import {
  beatFromFrac,
  editorBarWidthPx,
  editorBeatWidthPx,
  editorPatternWidthPx,
  followPlayheadScroll,
  fracInBar,
  playheadOffsetPx,
} from '../src/lib/editor-playhead.ts'
import {
  inputShortLabel,
  PREVIEW_GROUPS,
  previewDotsForGroup,
  previewHasHits,
} from '../src/lib/pattern-preview.ts'
import {
  intensityFromMark,
  intensityMark,
} from '../src/lib/kit-intensity.ts'
import { isPhoneViewport, isPortraitViewport, PHONE_SHORTEST_PX } from '../src/lib/phone-viewport.ts'
import { countMark, gridLineKind, HIT_COLOR, PLAYHEAD_COLOR } from '../src/lib/drum-flat-grid.ts'
import {
  barDurationSec,
  emptyPattern,
  isHitSoft,
  locateHeardBar,
  makeBar,
  moveHitAcrossBars,
  reduceHit,
  sameHit,
  setHitPos,
  VOICES,
} from '../src/lib/rhythm.ts'

assert.equal(PLAYHEAD_COLOR, '#FF4D6D')
assert.equal(HIT_COLOR, '#A855F7')
assert.deepEqual(countMark(0, 0, 4), { text: '1', kind: 'beat' })
assert.deepEqual(countMark(2, 0, 4), { text: '3', kind: 'beat' })
assert.deepEqual(countMark(2, 1, 4), { text: '', kind: 'sub' })
assert.deepEqual(countMark(2, 2, 4), { text: '', kind: 'sub' })
assert.deepEqual(countMark(2, 3, 4), { text: '', kind: 'sub' })
const flatLookSrc = readFileSync(new URL('../src/lib/drum-flat-grid.ts', import.meta.url), 'utf8')
assert.doesNotMatch(flatLookSrc, /SUB_SYLLABLES/)
assert.doesNotMatch(flatLookSrc, /'e'/)
assert.doesNotMatch(flatLookSrc, /'&'/)
assert.doesNotMatch(flatLookSrc, /'a'/)
assert.equal(gridLineKind(0, 0), 'bar')
assert.equal(gridLineKind(1, 0), 'beat')
assert.equal(gridLineKind(1, 2), 'sub')

assert.equal(PHONE_SHORTEST_PX, 600)
assert.equal(isPhoneViewport(430, 932), true, 'iPhone portrait is a phone')
assert.equal(isPhoneViewport(932, 430), true, 'iPhone landscape is a phone')
assert.equal(isPhoneViewport(390, 844), true)
assert.equal(isPhoneViewport(768, 1024), false, 'iPad portrait stays tablet')
assert.equal(isPhoneViewport(1024, 768), false, 'iPad landscape stays tablet')
assert.equal(isPhoneViewport(1440, 900), false)
assert.equal(isPortraitViewport(430, 932), true)
assert.equal(isPortraitViewport(932, 430), false)

assert.equal(inputShortLabel(4, 4), '1/16')
assert.equal(inputShortLabel(2, 4), '1/8')
assert.equal(inputShortLabel(3, 4), '1/8T')
assert.equal(inputShortLabel(6, 4), '1/16T')
assert.equal(inputShortLabel(8, 4), '1/32')
assert.equal(inputShortLabel(4, 8), '1/32')

const covered = new Set(PREVIEW_GROUPS.flatMap((group) => group.voices))
for (const voice of VOICES) {
  assert.ok(covered.has(voice), `${voice} belongs in a preview group`)
}

const rock = makeBar(4, 4, 4)
rock.pattern = setHitPos(emptyPattern(), 'kick', reduceHit(0, 0, 1), true)
rock.pattern = setHitPos(rock.pattern, 'snare', reduceHit(1, 0, 1), true)
rock.pattern = setHitPos(rock.pattern, 'closedHat', reduceHit(0, 1, 2), true)
const kickDots = previewDotsForGroup([rock], ['kick'], DEFAULT_DRUM_INPUT)
assert.equal(kickDots.length, 16)
assert.equal(kickDots.filter((dot) => dot.filled).length, 1)
assert.equal(previewHasHits(kickDots), true)
assert.equal(previewHasHits(previewDotsForGroup([makeBar(4, 4, 4)], ['china'], 4)), false)

assert.equal(editorBeatWidthPx(4), 4 * 22 + 8)
assert.equal(editorBarWidthPx(4, 4), 4 * editorBeatWidthPx(4))
assert.equal(editorPatternWidthPx([makeBar(4, 4, 4), makeBar(4, 4, 4)], 4), 2 * editorBarWidthPx(4, 4))

const mid = playheadOffsetPx({
  bars: [makeBar(4, 4, 4), makeBar(4, 4, 4)],
  input: 4,
  barIndex: 1,
  frac: 0.5,
})
assert.equal(mid, editorBarWidthPx(4, 4) + editorBarWidthPx(4, 4) * 0.5)
assert.equal(fracInBar({ audioTime: 2, barStart: 1, barDur: 2, outputLatency: 0, precount: false, playing: true }), 0.5)
assert.equal(fracInBar({ audioTime: 2, barStart: 1, barDur: 2, outputLatency: 0, precount: true, playing: true }), 0)
assert.equal(fracInBar({ audioTime: 3, barStart: 1, barDur: 2, playing: true }), 0, 'exact bar end wraps to 0')
assert.equal(fracInBar({ audioTime: 2.5, barStart: 0, barDur: 2, playing: true }), 0.25, 'past the bar wraps instead of clamping')
assert.equal(beatFromFrac(0, 4), 0)
assert.equal(beatFromFrac(0.49, 4), 1)
assert.equal(beatFromFrac(0.99, 4), 3)

const barDur88 = barDurationSec(4, 88, 4)
assert.ok(Math.abs(barDur88 - 2.727272) < 0.001)
const heardMid = locateHeardBar(1.5, barDur88, 1, [barDur88, barDur88])
assert.equal(heardMid.index, 0, 'lookahead tip is the next bar; audible time is still bar 0')
assert.ok(Math.abs(heardMid.start) < 1e-9)
const fracPastTwoBeats = fracInBar({
  audioTime: 1.5,
  barStart: heardMid.start,
  barDur: barDur88,
  playing: true,
})
assert.ok(fracPastTwoBeats > 0.5 && fracPastTwoBeats < 0.6, `expected ~0.55 through the bar, got ${fracPastTwoBeats}`)
assert.ok(
  fracInBar({ audioTime: 2.5, barStart: 0, barDur: barDur88, playing: true }) > 0.9,
  'playhead keeps sweeping after the 1.5s lookahead window',
)

const stay = followPlayheadScroll({ scrollLeft: 0, clientWidth: 400, playheadX: 120 })
assert.equal(stay, null)
const jump = followPlayheadScroll({ scrollLeft: 0, clientWidth: 400, playheadX: 380 })
assert.ok(jump != null && jump > 0)

let bars = [makeBar(4, 4, 4), makeBar(4, 4, 4)]
bars[0] = { ...bars[0]!, pattern: setHitPos(emptyPattern(), 'snare', reduceHit(1, 0, 1, true), true) }
const moved = moveHitAcrossBars(bars, 0, 'snare', reduceHit(1, 0, 1), 1, 'highTom', reduceHit(2, 1, 2))
assert.equal(moved[0]!.pattern.snare.length, 0)
assert.equal(moved[1]!.pattern.highTom.length, 1)
assert.ok(sameHit(moved[1]!.pattern.highTom[0]!, reduceHit(2, 1, 2)))
assert.equal(isHitSoft(moved[1]!.pattern.highTom[0]!), true)
const same = moveHitAcrossBars(moved, 1, 'highTom', reduceHit(2, 1, 2), 1, 'highTom', reduceHit(2, 1, 2))
assert.equal(same, moved)

const pageSrc = readFileSync(new URL('../src/pages/RhythmPage.tsx', import.meta.url), 'utf8')
assert.match(pageSrc, /placeOrToggleSoft/)
assert.match(pageSrc, /preview\(voice, nextSoft \? 'ghost' : 'normal'\)/)
const overlaySrc = readFileSync(new URL('../src/components/rhythm/DrumEditorOverlay.tsx', import.meta.url), 'utf8')
const gridSrc = readFileSync(new URL('../src/components/rhythm/DrumEditorGrid.tsx', import.meta.url), 'utf8')
const cssSrc = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const previewSrc = readFileSync(new URL('../src/components/rhythm/PatternPreview.tsx', import.meta.url), 'utf8')
const stageSrc = readFileSync(new URL('../src/pages/RhythmPage.tsx', import.meta.url), 'utf8')

assert.match(cssSrc, /@custom-variant phone/)
assert.match(pageSrc, /data-edit-beat/)
assert.match(pageSrc, /data-phone-drums/)
assert.match(pageSrc, /phone:hidden/)
assert.match(pageSrc, /PatternPreview/)
assert.match(pageSrc, /DrumEditorOverlay/)
assert.match(pageSrc, /moveHitAcrossBars/)
assert.match(pageSrc, /factory\.visible/)
assert.match(readFileSync(new URL('../src/lib/phone-viewport.ts', import.meta.url), 'utf8'), /orientation\.lock/)
assert.match(overlaySrc, /tryLockLandscape/)
assert.match(overlaySrc, /data-rotate-hint/)
assert.match(overlaySrc, /Back to Drums/)
assert.match(overlaySrc, /data-editor-mixer/)
assert.match(overlaySrc, /data-mixer-panel/)
assert.match(overlaySrc, /data-editor-beat-name/)
assert.match(overlaySrc, /data-editor-bpm/)
assert.match(overlaySrc, /onOpenLibrary/)
assert.match(overlaySrc, /EditorTempoSheet/)
assert.match(overlaySrc, /onTapTempo/)
assert.match(overlaySrc, /onListen/)
assert.match(pageSrc, /editorLibrary/)
assert.match(pageSrc, /compact=\{editorOpen\}/)
assert.match(pageSrc, /data-beat-library-sheet/)
assert.match(pageSrc, /data-library-layout/)
assert.match(pageSrc, /z-\[90\]/)
assert.match(
  readFileSync(new URL('../src/components/rhythm/EditorTempoSheet.tsx', import.meta.url), 'utf8'),
  /data-editor-tempo-sheet/,
)
assert.match(
  readFileSync(new URL('../src/components/rhythm/EditorTempoSheet.tsx', import.meta.url), 'utf8'),
  /BpmWheel compact/,
)
assert.match(
  readFileSync(new URL('../src/components/rhythm/EditorTempoSheet.tsx', import.meta.url), 'utf8'),
  /data-listen/,
)
assert.match(
  readFileSync(new URL('../src/components/rhythm/EditorTempoSheet.tsx', import.meta.url), 'utf8'),
  /data-tap/,
)
assert.match(
  readFileSync(new URL('../src/components/rhythm/ListenTempo.tsx', import.meta.url), 'utf8'),
  /z-\[100\]/,
)
assert.match(overlaySrc, /safe-area-inset/)
assert.match(overlaySrc, /sawLandscape/)
assert.match(overlaySrc, /IntensitySwitch/)
assert.match(overlaySrc, /canSwipe=\{!playing\}/)
assert.doesNotMatch(overlaySrc, /onIntensityChange/)
assert.doesNotMatch(overlaySrc, /usePlayhead/)
assert.doesNotMatch(overlaySrc, /playhead\.bar/)
assert.match(gridSrc, /data-editor-one-bar/)
assert.match(gridSrc, /PlayheadLine/)
assert.match(gridSrc, /mark="editor"/)
assert.match(gridSrc, /SWIPE_PX/)
assert.match(gridSrc, /onMoveHit/)
assert.match(gridSrc, /MOVE_ARM_MS/)
assert.match(gridSrc, /pending\.heldLong = true/)
assert.match(gridSrc, /if \(pending\.filled\)/)
assert.doesNotMatch(gridSrc, /if \(!pending\.filled\) return/)
assert.match(gridSrc, /onToggleSoft\(pending\.bar/)
assert.match(gridSrc, /requestAnimationFrame/)
assert.match(gridSrc, /fracInBar\(clock\)/)
assert.match(gridSrc, /onSelectBarRef/)
assert.doesNotMatch(gridSrc, /snap\.bar === shown/)
assert.doesNotMatch(gridSrc, /playheadStore/)
assert.doesNotMatch(gridSrc, /kitBeatBlocks/)
assert.doesNotMatch(gridSrc, /data-editor-one-row/)
assert.match(gridSrc, /data-drum-flat/)
assert.match(gridSrc, /gridLineProps/)
assert.match(gridSrc, /HitDiamond/)
assert.match(gridSrc, /data-hit-diamond/)
assert.match(gridSrc, /CountStrip/)
assert.doesNotMatch(gridSrc, /border-dashed/)
assert.doesNotMatch(gridSrc, /rounded-full/)

const engineSrc = readFileSync(new URL('../src/hooks/useRhythmEngine.ts', import.meta.url), 'utf8')
assert.match(engineSrc, /getTransportClock/)
assert.match(engineSrc, /locateHeardBar\(/)
assert.match(engineSrc, /barStart: heard\.start/)
assert.match(engineSrc, /audioTime: now/)

const deskGridSrc = readFileSync(new URL('../src/components/rhythm/DrumGrid.tsx', import.meta.url), 'utf8')
assert.match(deskGridSrc, /getClock/)
assert.match(deskGridSrc, /fracInBar\(clock\)/)
assert.match(deskGridSrc, /requestAnimationFrame/)
assert.doesNotMatch(deskGridSrc, /playheadStore\.subscribe/)
assert.doesNotMatch(deskGridSrc, /playheadStore\.getSnapshot/)
assert.doesNotMatch(deskGridSrc, /data-editor-playhead/)
assert.match(deskGridSrc, /data-drum-flat/)
assert.match(deskGridSrc, /data-grid-playhead/)
assert.match(deskGridSrc, /data-hit-diamond/)
assert.match(deskGridSrc, /pending\.heldLong = true/)
assert.doesNotMatch(deskGridSrc, /if \(!pending\.filled\) return/)
assert.match(deskGridSrc, /onToggleSoft\(pending\.voice/)
const bitsSrc = readFileSync(new URL('../src/components/rhythm/DrumFlatBits.tsx', import.meta.url), 'utf8')
assert.match(bitsSrc, /data-editor-playhead/)
assert.match(bitsSrc, /data-grid-playhead/)
assert.match(bitsSrc, /data-hit-diamond/)
assert.match(bitsSrc, /data-playhead-cap/)
assert.doesNotMatch(bitsSrc, /e & a/)
assert.doesNotMatch(bitsSrc, /'e'/)
assert.match(cssSrc, /drum-hit-diamond/)
assert.match(cssSrc, /#ff4d6d/)
assert.match(cssSrc, /#a855f7/)

const deskStageSrc = readFileSync(new URL('../src/components/rhythm/DrumBarStage.tsx', import.meta.url), 'utf8')
assert.match(deskStageSrc, /getClock/)
assert.match(deskStageSrc, /requestAnimationFrame/)
assert.doesNotMatch(deskStageSrc, /usePlayhead/)
assert.doesNotMatch(deskStageSrc, /playheadStore/)

const mixerSrc = readFileSync(new URL('../src/components/rhythm/KitMixerPanel.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(mixerSrc, /intensity/)
assert.match(mixerSrc, /KIT_GROUPS/)

const faderSrc = readFileSync(new URL('../src/components/rhythm/KitFaders.tsx', import.meta.url), 'utf8')
assert.match(faderSrc, /IntensitySwitch/)
assert.doesNotMatch(faderSrc, /id="intensity"/)

assert.match(cssSrc, /repeat\(4, minmax\(0, 1fr\)\)/)

assert.equal(intensityMark('high'), 'intense')
assert.equal(intensityMark('mid'), 'moderate')
assert.equal(intensityMark('low'), 'moderate')
assert.equal(intensityFromMark('intense'), 'high')
assert.equal(intensityFromMark('moderate'), 'mid')
assert.match(previewSrc, /PREVIEW_GROUPS/)
assert.match(stageSrc, /DrumBarStage/)
assert.match(overlaySrc, /beatName/)

console.log('drum-editor: ok')
