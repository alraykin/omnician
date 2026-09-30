import { layoutPegs, pegLetter, usesCloverPegs } from '@/lib/headstock'
import type { InstrumentString } from '@/lib/notes'
import type { InstrumentId } from '@/lib/presets'

/** Approved Split paddle — mockup viewBox 1200×1400, nut at y=1235, cx=600. */
export const SPLIT_VIEW_W = 1200
export const SPLIT_VIEW_H = 1400

export const SPLIT_OUTLINE =
  'M482.40 1235.00 C482.40 1156.60 465.04 1109.00 396.72 1052.44 Q385.52 1043.48 384.96 1025.00 L370.40 529.40 C367.04 361.40 446.00 274.60 600.00 271.80 C754.00 274.60 832.96 361.40 829.60 529.40 L815.04 1025.00 Q814.48 1043.48 803.28 1052.44 C734.96 1109.00 717.60 1156.60 717.60 1235.00 Z'

export const SPLIT_TRUSS =
  'M532.8 1209.8 L667.2 1209.8 L617.9 1050.2 L582.1 1050.2 Z'

export const SPLIT_NUT = { x: 475.7, y: 1226, w: 248.6, h: 17.9, rx: 6.2 }
export const SPLIT_NUT_Y = 1235
export const SPLIT_NECK = { left: 482.4, right: 717.6 }
export const SPLIT_POST_R = 22.4
export const SPLIT_NECK_FADE = 56
export const SPLIT_INNER = 10.9

export const SPLIT_WORDMARK = {
  src: '/brand/omnician-wordmark.png',
  cx: 600,
  cy: 655.4,
  // Mockup ink is 389.2 × 70.18; the PNG has transparent padding.
  length: 389.2 * (2172 / 2121),
  thickness: 70.18 * (724 / 382),
  opacity: 0.8,
  rotate: -90,
} as const

export const SPLIT_BUTTON = { w: 70, h: 58.8, rx: 17.9 } as const

/** Low E → high E. */
export const SPLIT_NUT_XS_6 = [503.1, 541.9, 580.6, 619.4, 658.1, 696.9] as const

/** Low E, A, D, G, B, high E. */
export const SPLIT_POSTS_6 = [
  { x: 465.6, y: 943.8 },
  { x: 457.2, y: 731.0 },
  { x: 448.8, y: 518.2 },
  { x: 751.2, y: 518.2 },
  { x: 742.8, y: 731.0 },
  { x: 734.4, y: 943.8 },
] as const

export const SPLIT_POST_INNER_6 = [
  { x: 476.5, y: 943.8 },
  { x: 468.1, y: 731.0 },
  { x: 459.7, y: 518.2 },
  { x: 740.3, y: 518.2 },
  { x: 731.9, y: 731.0 },
  { x: 723.5, y: 943.8 },
] as const

/** Button top-left, low E → high E. */
export const SPLIT_BUTTONS_6 = [
  { x: 296.0, y: 914.4 },
  { x: 287.6, y: 701.6 },
  { x: 279.2, y: 488.8 },
  { x: 850.8, y: 488.8 },
  { x: 842.4, y: 701.6 },
  { x: 834.0, y: 914.4 },
] as const

export type SplitPeg = {
  string: InstrumentString
  letter: string
  side: 'left' | 'right' | 'fifth'
  postX: number
  postY: number
  postR: number
  innerX: number
  innerY: number
  buttonX: number
  buttonY: number
  buttonW: number
  buttonH: number
  buttonRx: number
  nutX: number
  nutY: number
}

export type SplitCourse = {
  leftX: number
  rightX: number
}

export type SplitLayout = {
  outline: string
  truss: string
  nut: typeof SPLIT_NUT
  neckLeft: number
  neckRight: number
  nutY: number
  pegs: SplitPeg[]
  courses: SplitCourse[]
  twelve: boolean
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpPt(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

function columnEnds(side: 'left' | 'right'): {
  top: { x: number; y: number }
  bot: { x: number; y: number }
  topBtnX: number
  botBtnX: number
} {
  if (side === 'left') {
    return {
      top: SPLIT_POSTS_6[2],
      bot: SPLIT_POSTS_6[0],
      topBtnX: SPLIT_BUTTONS_6[2].x,
      botBtnX: SPLIT_BUTTONS_6[0].x,
    }
  }
  return {
    top: SPLIT_POSTS_6[3],
    bot: SPLIT_POSTS_6[5],
    topBtnX: SPLIT_BUTTONS_6[3].x,
    botBtnX: SPLIT_BUTTONS_6[5].x,
  }
}

function exactIndex(side: 'left' | 'right', row: number): number | null {
  if (side === 'left' && row >= 0 && row <= 2) return 2 - row
  if (side === 'right' && row >= 0 && row <= 2) return 3 + row
  return null
}

function pairedCourses(strings: readonly InstrumentString[]): {
  nutXs: Map<string, number>
  courses: SplitCourse[]
} {
  const byNo = [...strings].sort((a, b) => b.stringNo - a.stringNo)
  const grouped: InstrumentString[][] = []
  for (let i = 0; i < byNo.length; i += 2) grouped.push(byNo.slice(i, i + 2))
  const span = Math.max(1, grouped.length - 1)
  const nutXs = new Map<string, number>()
  const courses: SplitCourse[] = []
  grouped.forEach((course, index) => {
    const t = grouped.length === 1 ? 0.5 : index / span
    const center = lerp(SPLIT_NUT_XS_6[0], SPLIT_NUT_XS_6[5], t)
    const pairGap = 11
    const leftX = center - pairGap / 2
    const rightX = center + pairGap / 2
    const pair = [...course].sort((a, b) => b.stringNo - a.stringNo)
    if (pair[0]) nutXs.set(pair[0].id, pair[1] ? leftX : center)
    if (pair[1]) nutXs.set(pair[1].id, rightX)
    courses.push({
      leftX: pair[1] ? leftX : center,
      rightX: pair[1] ? rightX : center,
    })
  })
  return { nutXs, courses }
}

export function layoutSplit(
  strings: readonly InstrumentString[],
  config: InstrumentId,
): SplitLayout {
  const slots = layoutPegs(strings, config)
  const twelve = config === 'guitar-12' && strings.length === 12
  const bass = usesCloverPegs(config)
  const postScale = bass ? 1.22 : slots.filter((s) => s.side !== 'fifth').length >= 8 ? 0.86 : 1
  const buttonScale = bass ? 1.16 : postScale
  const postR = SPLIT_POST_R * postScale
  const buttonW = SPLIT_BUTTON.w * buttonScale
  const buttonH = SPLIT_BUTTON.h * buttonScale
  const buttonRx = SPLIT_BUTTON.rx * buttonScale
  const paired = twelve ? pairedCourses(strings) : null
  const body = slots.filter((slot) => slot.side !== 'fifth')
  const leftCount = body.filter((slot) => slot.side === 'left').length
  const rightCount = body.filter((slot) => slot.side === 'right').length
  const nutOrder = [...body].sort((a, b) => b.string.stringNo - a.string.stringNo)
  const nutSpan = Math.max(1, nutOrder.length - 1)
  const evenNut = new Map<string, number>()
  nutOrder.forEach((slot, index) => {
    const t = nutOrder.length === 1 ? 0.5 : index / nutSpan
    evenNut.set(slot.string.id, lerp(SPLIT_NUT_XS_6[0], SPLIT_NUT_XS_6[5], t))
  })

  const pegs: SplitPeg[] = body.map((slot) => {
    const side = slot.side === 'right' ? 'right' : 'left'
    const count = side === 'left' ? leftCount : rightCount
    const exact =
      !twelve && count === 3 ? exactIndex(side, slot.row) : null
    const ends = columnEnds(side)
    const t = count <= 1 ? 0 : slot.row / (count - 1)
    const post = exact != null ? SPLIT_POSTS_6[exact] : lerpPt(ends.top, ends.bot, t)
    const inner =
      exact != null
        ? SPLIT_POST_INNER_6[exact]
        : {
            x: post.x + (side === 'left' ? SPLIT_INNER : -SPLIT_INNER),
            y: post.y,
          }
    const buttonX =
      exact != null
        ? SPLIT_BUTTONS_6[exact].x + (SPLIT_BUTTON.w - buttonW) / 2
        : lerp(ends.topBtnX, ends.botBtnX, t) + (SPLIT_BUTTON.w - buttonW) / 2
    const buttonY = post.y - buttonH / 2
    const nutX = paired
      ? (paired.nutXs.get(slot.string.id) ?? post.x)
      : exact != null
        ? SPLIT_NUT_XS_6[exact]
        : (evenNut.get(slot.string.id) ?? post.x)
    return {
      string: slot.string,
      letter: pegLetter(slot.string, strings),
      side,
      postX: post.x,
      postY: post.y,
      postR,
      innerX: inner.x,
      innerY: inner.y,
      buttonX,
      buttonY,
      buttonW,
      buttonH,
      buttonRx,
      nutX,
      nutY: SPLIT_NUT_Y,
    }
  })

  const fifth = slots.find((slot) => slot.side === 'fifth')
  if (fifth) {
    const postY = SPLIT_NUT_Y + 72
    const postX = SPLIT_NECK.left + 18
    pegs.push({
      string: fifth.string,
      letter: fifth.string.pegLabel ?? fifth.string.label.toLowerCase(),
      side: 'fifth',
      postX,
      postY,
      postR: postR * 0.86,
      innerX: postX,
      innerY: postY,
      buttonX: 250,
      buttonY: postY - buttonH / 2,
      buttonW,
      buttonH,
      buttonRx,
      nutX: postX,
      nutY: postY,
    })
  }

  return {
    outline: SPLIT_OUTLINE,
    truss: SPLIT_TRUSS,
    nut: SPLIT_NUT,
    neckLeft: SPLIT_NECK.left,
    neckRight: SPLIT_NECK.right,
    nutY: SPLIT_NUT_Y,
    pegs,
    courses: paired?.courses ?? [],
    twelve,
  }
}
