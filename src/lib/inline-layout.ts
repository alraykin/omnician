import type { InstrumentString } from './notes'
import type { InstrumentId } from './presets'

/** Tip → nut: highest string at the tip, lowest nearest the nut. */
export function inlinePegsFromTip(
  strings: readonly InstrumentString[],
): InstrumentString[] {
  return [...strings].sort((a, b) => a.stringNo - b.stringNo || b.midi - a.midi)
}

/** Left tuner edge, measured from vertical toward the treble side as it rises. */
export const INLINE_EDGE_DEG = 16
export const INLINE_EDGE_TAN = Math.tan((INLINE_EDGE_DEG * Math.PI) / 180)

export type InlinePeg = {
  string: InstrumentString
  postX: number
  postY: number
  buttonX: number
  buttonY: number
  nutX: number
  nutY: number
  edgeX: number
  button: number
  postR: number
}

export type InlineLayout = {
  viewW: number
  height: number
  nutY: number
  nutLeft: number
  nutWidth: number
  neckH: number
  tipY: number
  joinY: number
  leftAtNut: number
  leftAtJoin: number
  rightAtNut: number
  rightAtJoin: number
  domeWidth: number
  outline: string
  inset: string
  wordX: number
  wordY: number
  pegs: InlinePeg[]
}

type Metrics = {
  button: number
  postR: number
  gap: number
  tail: number
  neckH: number
  shaft: number
  inset: number
  domeH: number
  nutWidth: number
}

function metrics(count: number, bass: boolean): Metrics {
  if (bass || count <= 4) {
    return {
      button: bass ? 20 : 18,
      postR: bass ? 6 : 5.2,
      gap: bass ? 50 : 46,
      tail: 38,
      neckH: bass ? 128 : 118,
      shaft: 13,
      inset: 18,
      domeH: 36,
      nutWidth: bass ? 70 : 72,
    }
  }
  if (count <= 6) {
    return {
      button: 18,
      postR: 5.2,
      gap: 42,
      tail: 36,
      neckH: 120,
      shaft: 12,
      inset: 18,
      domeH: 34,
      nutWidth: 84,
    }
  }
  if (count === 7) {
    return {
      button: 16.5,
      postR: 4.8,
      gap: 38,
      tail: 34,
      neckH: 116,
      shaft: 11,
      inset: 17,
      domeH: 32,
      nutWidth: 90,
    }
  }
  return {
    button: 15.5,
    postR: 4.6,
    gap: 34,
    tail: 32,
    neckH: 112,
    shaft: 11,
    inset: 16,
    domeH: 30,
    nutWidth: 96,
  }
}

export function leftEdgeX(leftAtNut: number, nutY: number, y: number): number {
  return leftAtNut + (nutY - y) * INLINE_EDGE_TAN
}

export function layoutInline(
  strings: readonly InstrumentString[],
  config: InstrumentId,
): InlineLayout {
  const ordered = inlinePegsFromTip(strings)
  const count = Math.max(1, ordered.length)
  const bass = config.startsWith('bass')
  const m = metrics(count, bass)

  const labelW = 24
  const checkW = 16
  const sidePad = 14
  const leftPad = sidePad + checkW + labelW + m.button + m.shaft + 2

  const nutWidth = m.nutWidth
  const bodyW = nutWidth + 16
  const domeR = bodyW * 0.5
  const aboveFirst = 14
  const tipY = 12
  const joinY = tipY + domeR
  const firstY = joinY + aboveFirst
  const lastY = firstY + (count - 1) * m.gap
  const nutY = lastY + m.tail
  const height = nutY + m.neckH

  const leftAtNut = leftPad
  const rightAtNut = leftAtNut + bodyW
  const nutLeft = leftAtNut + (bodyW - nutWidth) / 2
  const nutRight = nutLeft + nutWidth
  const leftAtJoin = leftEdgeX(leftAtNut, nutY, joinY)
  const rightAtJoin = leftAtJoin + bodyW
  const domeWidth = bodyW

  const pegs: InlinePeg[] = ordered.map((string, index) => {
    const postY = firstY + index * m.gap
    const edgeX = leftEdgeX(leftAtNut, nutY, postY)
    const postX = edgeX + m.inset
    const buttonX = edgeX - m.shaft - m.button / 2
    const innerL = nutLeft + 7
    const innerR = nutRight - 7
    const t = count === 1 ? 0.5 : index / (count - 1)
    // Even nut spacing, high string (tip) on the treble / right side.
    const nutX = innerR - t * (innerR - innerL)
    return {
      string,
      postX,
      postY,
      buttonX,
      buttonY: postY,
      nutX,
      nutY,
      edgeX,
      button: m.button,
      postR: m.postR,
    }
  })

  const outline = v4Outline({
    leftAtNut,
    leftAtJoin,
    rightAtNut,
    rightAtJoin,
    nutY,
    joinY,
    tipY,
  })
  const inset = v4Outline({
    leftAtNut: leftAtNut + 5.5,
    leftAtJoin: leftAtJoin + 4.5,
    rightAtNut: rightAtNut - 5.5,
    rightAtJoin: rightAtJoin - 4.5,
    nutY,
    joinY: joinY + 1.5,
    tipY: tipY + 6,
  })

  const wordX = (leftAtJoin + rightAtJoin) / 2 + (rightAtJoin - leftAtJoin) * 0.22
  const wordY = (joinY + nutY) * 0.48
  const viewW = Math.ceil(Math.max(rightAtJoin, rightAtNut) + 28)

  return {
    viewW,
    height,
    nutY,
    nutLeft,
    nutWidth,
    neckH: m.neckH,
    tipY,
    joinY,
    leftAtNut,
    leftAtJoin,
    rightAtNut,
    rightAtJoin,
    domeWidth,
    outline,
    inset,
    wordX,
    wordY,
    pegs,
  }
}

function v4Outline(p: {
  leftAtNut: number
  leftAtJoin: number
  rightAtNut: number
  rightAtJoin: number
  nutY: number
  joinY: number
  tipY: number
}): string {
  const domeW = p.rightAtJoin - p.leftAtJoin
  const rx = domeW / 2
  const ry = Math.max(18, p.joinY - p.tipY)
  const swoopY = p.nutY - 14
  return [
    `M ${p.leftAtNut} ${p.nutY}`,
    `L ${p.leftAtJoin} ${p.joinY}`,
    `A ${rx} ${ry} 0 0 1 ${p.rightAtJoin} ${p.joinY}`,
    `L ${p.rightAtNut} ${swoopY}`,
    `Q ${p.rightAtNut + 2.5} ${p.nutY - 4} ${p.rightAtNut} ${p.nutY}`,
    `L ${p.leftAtNut} ${p.nutY}`,
    'Z',
  ].join(' ')
}
