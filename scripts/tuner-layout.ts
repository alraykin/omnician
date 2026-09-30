import assert from 'node:assert/strict'

import { parseLayoutMode } from '../src/lib/custom-presets.ts'
import {
  INLINE_EDGE_DEG,
  INLINE_EDGE_TAN,
  inlinePegsFromTip,
  layoutInline,
} from '../src/lib/inline-layout.ts'
import { findBuiltinPreset } from '../src/lib/presets.ts'

assert.equal(parseLayoutMode('inline'), 'inline')
assert.equal(parseLayoutMode('headstock'), 'headstock')
assert.equal(parseLayoutMode('nope'), 'headstock')
assert.equal(INLINE_EDGE_DEG, 16)

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

function checkPaddle(id: string, config: 'guitar-6' | 'guitar-7' | 'guitar-8' | 'bass-4') {
  const preset = findBuiltinPreset(id)
  assert.ok(preset, id)
  const drawn = layoutInline(preset.strings, config)
  const rise = drawn.nutY - drawn.joinY
  const run = drawn.leftAtJoin - drawn.leftAtNut
  const deg = (Math.atan2(run, rise) * 180) / Math.PI
  assert.ok(Math.abs(deg - 16) < 1.2, `${id} left edge ${deg.toFixed(2)}°`)
  assert.ok(drawn.domeWidth >= 28 && drawn.domeWidth <= 72, `${id} dome ${drawn.domeWidth}`)
  assert.ok(
    drawn.rightAtNut - drawn.leftAtNut < drawn.nutWidth + 28,
    `${id} body should stay only a bit wider than the nut`,
  )
  assert.ok(
    drawn.viewW < drawn.nutWidth * 3.2,
    `${id} viewBox is too wide for a slim paddle (${drawn.viewW} vs nut ${drawn.nutWidth})`,
  )

  const tip = drawn.pegs[0]
  const nutPeg = drawn.pegs.at(-1)
  assert.ok(tip && nutPeg)
  assert.ok(tip.postY < nutPeg.postY, `${id} tip post should be above the nut post`)
  assert.ok(tip.postX > nutPeg.postX, `${id} high string post should sit further right`)
  assert.ok(nutPeg.nutX < tip.nutX, `${id} low string should leave the nut on the left`)

  const nuts = drawn.pegs.map((peg) => peg.nutX)
  const gaps = nuts.slice(1).map((x, i) => Math.abs(x - (nuts[i] ?? 0)))
  const mean = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length)
  for (const gap of gaps) {
    assert.ok(Math.abs(gap - mean) < 1.2, `${id} nut spacing should be even`)
  }

  for (const peg of drawn.pegs) {
    const dx = peg.postX - peg.nutX
    const dy = peg.nutY - peg.postY
    assert.ok(dy > 8, `${id} ${peg.string.id} should run up to its post`)
    assert.ok(Math.abs(dx) < dy * 0.55, `${id} ${peg.string.id} should run nearly straight`)
    assert.ok(peg.button >= 15, `${id} buttons too small (${peg.button})`)
  }

  const expectedTan = (drawn.leftAtJoin - drawn.leftAtNut) / rise
  assert.ok(Math.abs(expectedTan - INLINE_EDGE_TAN) < 0.01, `${id} tan`)
}

checkPaddle('guitar-6-standard', 'guitar-6')
checkPaddle('guitar-7', 'guitar-7')
checkPaddle('guitar-8', 'guitar-8')
checkPaddle('bass-4', 'bass-4')

const six = layoutInline(guitar6.strings, 'guitar-6')
assert.equal(six.pegs[0]?.string.label, 'E')
assert.equal(six.pegs[0]?.string.stringNo, 1)
assert.equal(six.pegs.at(-1)?.string.stringNo, 6)
assert.ok(six.pegs[0] && six.pegs.at(-1))
assert.ok(six.pegs[0].button >= 17)

console.log('tuner-layout: ok')
