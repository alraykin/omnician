import type { InstrumentString } from './notes'
import type { InstrumentId } from './presets'

/** Tip → nut: highest string at the tip, lowest nearest the nut. */
export function inlinePegsFromTip(
  strings: readonly InstrumentString[],
): InstrumentString[] {
  return [...strings].sort((a, b) => a.stringNo - b.stringNo || b.midi - a.midi)
}

/** Source SVG is 1200×1400. Coordinates below are copied from that file. */
export const INLINE_VIEW_W = 1200
export const INLINE_VIEW_H = 1400

/** Approved v4 outline — do not rewrite. */
export const INLINE_OUTLINE =
  'M550.40 1235.00 C550.40 1157.24 533.97 1112.03 468.23 1054.16 L685.76 325.10 C700.17 276.81 728.36 226.73 773.05 231.77 C817.74 236.81 844.04 282.27 847.53 343.77 L881.92 949.40 C883.51 977.35 858.40 997.00 844.96 1013.80 C819.20 1044.60 791.20 1100.60 787.28 1167.80 C786.16 1201.40 785.60 1218.20 785.60 1235.00 Z'

export const INLINE_TRUSS =
  'M600.8 1209.8 L735.2 1209.8 L685.9 1050.2 L650.1 1050.2 Z'

export const INLINE_NUT = { x: 543.7, y: 1226, w: 248.6, h: 17.9 }
export const INLINE_NECK = { left: 550.4, right: 785.6, top: 1235 }
export const INLINE_NUT_Y = 1235
export const INLINE_WORD = { x: 815.5, y: 666.6 }

/** Low E → high E on the approved 6-string. */
export const INLINE_NUT_XS_6 = [571.1, 609.9, 648.6, 687.4, 726.1, 764.9] as const
export const INLINE_POSTS_6 = [
  { x: 552.1, y: 988.6 },
  { x: 587.8, y: 868.8 },
  { x: 623.6, y: 748.9 },
  { x: 659.3, y: 629.1 },
  { x: 695.1, y: 509.2 },
  { x: 730.9, y: 389.4 },
] as const
export const INLINE_BUTTON_6 = {
  x: 401,
  y: 959.2,
  w: 70,
  h: 58.8,
  rx: 17.9,
  dx: 35.8,
  dy: -119.8,
} as const
export const INLINE_POST_R_6 = 22.4

export type InlinePeg = {
  string: InstrumentString
  postX: number
  postY: number
  postR: number
  buttonX: number
  buttonY: number
  buttonW: number
  buttonH: number
  buttonRx: number
  nutX: number
  nutY: number
}

export type InlineLayout = {
  viewW: number
  height: number
  nutY: number
  nutLeft: number
  nutWidth: number
  neckH: number
  neckLeft: number
  neckRight: number
  outline: string
  truss: string
  wordX: number
  wordY: number
  pegs: InlinePeg[]
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function fromNut(strings: readonly InstrumentString[]): InstrumentString[] {
  return [...strings].sort((a, b) => b.stringNo - a.stringNo || a.midi - b.midi)
}

export function layoutInline(
  strings: readonly InstrumentString[],
  config: InstrumentId,
): InlineLayout {
  const ordered = fromNut(strings)
  const count = Math.max(1, ordered.length)
  const bass = config.startsWith('bass')
  const last = INLINE_POSTS_6.length - 1
  const postScale = bass ? 1.22 : count >= 8 ? 0.86 : count === 7 ? 0.92 : 1
  const postR = INLINE_POST_R_6 * postScale
  const buttonScale = bass ? 1.16 : count >= 8 ? 0.86 : count === 7 ? 0.92 : 1
  const buttonW = INLINE_BUTTON_6.w * buttonScale
  const buttonH = INLINE_BUTTON_6.h * buttonScale
  const buttonRx = INLINE_BUTTON_6.rx * buttonScale

  const pegs: InlinePeg[] = ordered.map((string, index) => {
    const exact = count === 6
    const t = count === 1 ? 0.5 : index / (count - 1)
    const postX = exact ? INLINE_POSTS_6[index].x : lerp(INLINE_POSTS_6[0].x, INLINE_POSTS_6[last].x, t)
    const postY = exact ? INLINE_POSTS_6[index].y : lerp(INLINE_POSTS_6[0].y, INLINE_POSTS_6[last].y, t)
    const nutX = exact
      ? INLINE_NUT_XS_6[index]
      : lerp(INLINE_NUT_XS_6[0], INLINE_NUT_XS_6[INLINE_NUT_XS_6.length - 1], t)
    const buttonX = exact
      ? INLINE_BUTTON_6.x + INLINE_BUTTON_6.dx * index
      : lerp(INLINE_BUTTON_6.x, INLINE_BUTTON_6.x + INLINE_BUTTON_6.dx * last, t)
    const buttonY = exact
      ? INLINE_BUTTON_6.y + INLINE_BUTTON_6.dy * index
      : lerp(INLINE_BUTTON_6.y, INLINE_BUTTON_6.y + INLINE_BUTTON_6.dy * last, t)
    const xOff = (INLINE_BUTTON_6.w - buttonW) / 2
    const yOff = (INLINE_BUTTON_6.h - buttonH) / 2
    return {
      string,
      postX,
      postY,
      postR,
      buttonX: buttonX + xOff,
      buttonY: buttonY + yOff,
      buttonW,
      buttonH,
      buttonRx,
      nutX,
      nutY: INLINE_NUT_Y,
    }
  })

  return {
    viewW: INLINE_VIEW_W,
    height: INLINE_VIEW_H,
    nutY: INLINE_NUT_Y,
    nutLeft: INLINE_NUT.x,
    nutWidth: INLINE_NUT.w,
    neckH: INLINE_VIEW_H - INLINE_NUT_Y,
    neckLeft: INLINE_NECK.left,
    neckRight: INLINE_NECK.right,
    outline: INLINE_OUTLINE,
    truss: INLINE_TRUSS,
    wordX: INLINE_WORD.x,
    wordY: INLINE_WORD.y,
    pegs,
  }
}
