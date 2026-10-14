import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { DEFAULT_DRUM_INPUT } from '../src/lib/beat-boxes.ts'
import {
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
import { isPhoneViewport, isPortraitViewport, PHONE_SHORTEST_PX } from '../src/lib/phone-viewport.ts'
import {
  emptyPattern,
  isHitSoft,
  makeBar,
  moveHitAcrossBars,
  reduceHit,
  sameHit,
  setHitPos,
  VOICES,
} from '../src/lib/rhythm.ts'

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
assert.match(overlaySrc, /safe-area-inset/)
assert.match(gridSrc, /data-editor-one-row/)
assert.match(gridSrc, /data-editor-playhead/)
assert.match(gridSrc, /followPlayheadScroll/)
assert.match(gridSrc, /onMoveHit/)
assert.match(gridSrc, /MOVE_ARM_MS/)
assert.doesNotMatch(gridSrc, /kitBeatBlocks/)
assert.match(previewSrc, /PREVIEW_GROUPS/)
assert.match(stageSrc, /DrumBarStage/)
assert.match(overlaySrc, /beatName/)

console.log('drum-editor: ok')
