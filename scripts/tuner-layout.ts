import assert from 'node:assert/strict'

import { parseLayoutMode } from '../src/lib/custom-presets.ts'
import {
  INLINE_BUTTON_6,
  INLINE_NUT,
  INLINE_NUT_XS_6,
  INLINE_OUTLINE,
  INLINE_POSTS_6,
  INLINE_POST_R_6,
  INLINE_VIEW_H,
  INLINE_VIEW_W,
  inlinePegsFromTip,
  layoutInline,
} from '../src/lib/inline-layout.ts'
import { findBuiltinPreset } from '../src/lib/presets.ts'

assert.equal(parseLayoutMode('inline'), 'inline')
assert.equal(parseLayoutMode('headstock'), 'headstock')
assert.equal(parseLayoutMode('nope'), 'headstock')
assert.equal(INLINE_VIEW_W, 1200)
assert.equal(INLINE_VIEW_H, 1400)
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

console.log('tuner-layout: ok')
