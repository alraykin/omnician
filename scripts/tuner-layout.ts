import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { layoutModeLabel, parseLayoutMode } from '../src/lib/custom-presets.ts'
import {
  INLINE_BUTTON_6,
  INLINE_NECK_FADE,
  INLINE_NUT,
  INLINE_NUT_XS_6,
  INLINE_OUTLINE,
  INLINE_POSTS_6,
  INLINE_POST_R_6,
  INLINE_VIEW_H,
  INLINE_VIEW_W,
  INLINE_WORDMARK,
  inlinePegsFromTip,
  layoutInline,
} from '../src/lib/inline-layout.ts'
import { isTwelveString } from '../src/lib/headstock.ts'
import {
  SPLIT_NUT,
  SPLIT_NUT_XS_6,
  SPLIT_OUTLINE,
  SPLIT_POSTS_6,
  SPLIT_POST_INNER_6,
  SPLIT_POST_R,
  SPLIT_WORDMARK,
  layoutSplit,
} from '../src/lib/split-layout.ts'
import { findBuiltinPreset } from '../src/lib/presets.ts'

assert.equal(parseLayoutMode('inline'), 'inline')
assert.equal(parseLayoutMode('headstock'), 'headstock')
assert.equal(parseLayoutMode('nope'), 'headstock')
assert.equal(layoutModeLabel('inline'), 'Inline')
assert.equal(layoutModeLabel('headstock'), 'Split')
assert.equal(isTwelveString('guitar-12', 12), true)
assert.equal(isTwelveString('guitar-6', 6), false)
assert.equal(isTwelveString('guitar-6', 12), true)
assert.equal(INLINE_VIEW_W, 1200)
assert.equal(INLINE_VIEW_H, 1400)
assert.equal(INLINE_WORDMARK.src, '/brand/omnician-wordmark.png')
assert.equal(INLINE_WORDMARK.opacity, 0.8)
assert.equal(INLINE_WORDMARK.rotate, -90)
assert.ok(INLINE_NECK_FADE > 0 && INLINE_NECK_FADE < 120)
assert.match(INLINE_OUTLINE, /^M550\.40 1235\.00/)
assert.match(INLINE_OUTLINE, /785\.60 1235\.00 Z$/)

const guitar6 = findBuiltinPreset('guitar-6-standard')
assert.ok(guitar6)
const g6 = inlinePegsFromTip(guitar6.strings)
assert.deepEqual(
  g6.map((item) => item.stringNo),
  [1, 2, 3, 4, 5, 6],
)
assert.equal(g6[0]?.label, 'E')
assert.equal(g6.at(-1)?.midi, 40)

const guitar7 = findBuiltinPreset('guitar-7')
assert.ok(guitar7)
assert.equal(inlinePegsFromTip(guitar7.strings).at(-1)?.midi, 35)

const guitar8 = findBuiltinPreset('guitar-8')
assert.ok(guitar8)
assert.equal(inlinePegsFromTip(guitar8.strings).length, 8)
assert.equal(inlinePegsFromTip(guitar8.strings).at(-1)?.midi, 30)

const bass4 = findBuiltinPreset('bass-4')
assert.ok(bass4)
const b4 = inlinePegsFromTip(bass4.strings)
assert.equal(b4[0]?.label, 'G')
assert.equal(b4.at(-1)?.label, 'E')

const six = layoutInline(guitar6.strings, 'guitar-6')
assert.equal(six.outline, INLINE_OUTLINE)
assert.equal(six.viewW, 1200)
assert.equal(six.height, 1400)
assert.equal(six.pegs.length, 6)
assert.equal(six.nutLeft, INLINE_NUT.x)
assert.equal(six.nutWidth, INLINE_NUT.w)

six.pegs.forEach((peg, index) => {
  const post = INLINE_POSTS_6[index]
  const nutX = INLINE_NUT_XS_6[index]
  assert.ok(post && nutX != null)
  assert.ok(Math.abs(peg.postX - post.x) < 0.05, `post x ${index}`)
  assert.ok(Math.abs(peg.postY - post.y) < 0.05, `post y ${index}`)
  assert.ok(Math.abs(peg.nutX - nutX) < 0.05, `nut x ${index}`)
  assert.equal(peg.postR, INLINE_POST_R_6)
  assert.ok(Math.abs(peg.buttonX - (INLINE_BUTTON_6.x + INLINE_BUTTON_6.dx * index)) < 0.05)
  assert.ok(Math.abs(peg.buttonY - (INLINE_BUTTON_6.y + INLINE_BUTTON_6.dy * index)) < 0.05)
  assert.equal(peg.buttonW, INLINE_BUTTON_6.w)
  assert.equal(peg.buttonH, INLINE_BUTTON_6.h)
})
assert.equal(six.pegs[0]?.string.stringNo, 6)
assert.equal(six.pegs.at(-1)?.string.stringNo, 1)

const seven = layoutInline(guitar7.strings, 'guitar-7')
assert.equal(seven.outline, INLINE_OUTLINE)
assert.equal(seven.pegs.length, 7)
assert.equal(seven.pegs[0]?.postX, six.pegs[0]?.postX)
assert.equal(seven.pegs.at(-1)?.postX, six.pegs.at(-1)?.postX)

const eight = layoutInline(guitar8.strings, 'guitar-8')
assert.equal(eight.outline, INLINE_OUTLINE)
assert.equal(eight.pegs.length, 8)

const bass = layoutInline(bass4.strings, 'bass-4')
assert.equal(bass.outline, INLINE_OUTLINE)
assert.equal(bass.pegs.length, 4)
assert.ok(bass.pegs[0] && bass.pegs[0].postR > INLINE_POST_R_6)
assert.equal(bass.pegs[0]?.string.label, 'E')
assert.equal(bass.pegs.at(-1)?.string.label, 'G')

assert.match(SPLIT_OUTLINE, /^M482\.40 1235\.00/)
assert.match(SPLIT_OUTLINE, /717\.60 1235\.00 Z$/)
assert.equal(SPLIT_WORDMARK.src, '/brand/omnician-wordmark.png')
assert.equal(SPLIT_WORDMARK.opacity, 0.8)
assert.equal(SPLIT_WORDMARK.rotate, -90)
assert.equal(SPLIT_WORDMARK.cx, 600)
assert.equal(SPLIT_NUT.w, 248.6)
assert.equal(SPLIT_POST_R, 22.4)

const split6 = layoutSplit(guitar6.strings, 'guitar-6')
assert.equal(split6.outline, SPLIT_OUTLINE)
assert.equal(split6.pegs.length, 6)
split6.pegs
  .slice()
  .sort((a, b) => b.string.stringNo - a.string.stringNo)
  .forEach((peg, index) => {
    const post = SPLIT_POSTS_6[index]
    const inner = SPLIT_POST_INNER_6[index]
    const nutX = SPLIT_NUT_XS_6[index]
    assert.ok(post && inner && nutX != null)
    assert.ok(Math.abs(peg.postX - post.x) < 0.05, `split post x ${index}`)
    assert.ok(Math.abs(peg.postY - post.y) < 0.05, `split post y ${index}`)
    assert.ok(Math.abs(peg.innerX - inner.x) < 0.05, `split inner x ${index}`)
    assert.ok(Math.abs(peg.nutX - nutX) < 0.05, `split nut x ${index}`)
    assert.equal(peg.postR, SPLIT_POST_R)
  })
assert.equal(split6.pegs.find((p) => p.string.stringNo === 6)?.side, 'left')
assert.equal(split6.pegs.find((p) => p.string.stringNo === 1)?.side, 'right')

const twelve = findBuiltinPreset('guitar-12-standard')
assert.ok(twelve)
const split12 = layoutSplit(twelve.strings, 'guitar-12')
assert.equal(split12.outline, SPLIT_OUTLINE)
assert.equal(split12.pegs.length, 12)
assert.equal(split12.pegs.filter((p) => p.side === 'left').length, 6)
assert.equal(split12.pegs.filter((p) => p.side === 'right').length, 6)
assert.equal(split12.courses.length, 6)

const splitSrc = readFileSync(new URL('../src/components/tuner/SplitHeadstock.tsx', import.meta.url), 'utf8')
const inlineSrc = readFileSync(new URL('../src/components/tuner/InlineHeadstock.tsx', import.meta.url), 'utf8')
const pageSrc = readFileSync(new URL('../src/pages/TunerPage.tsx', import.meta.url), 'utf8')
assert.match(splitSrc, /PegSpeakerIcon/)
assert.match(inlineSrc, /PegSpeakerIcon/)
assert.match(splitSrc, /data-peg-playing/)
assert.match(inlineSrc, /data-peg-playing/)
assert.match(pageSrc, /data-tuner-reset/)
assert.match(pageSrc, /Reset/)
assert.doesNotMatch(
  pageSrc,
  /nextIds\.delete\(string\.id\)/,
  'peg tap must not un-stick a green peg; only Reset / instrument / tuning change clears',
)

console.log('tuner-layout: ok')
