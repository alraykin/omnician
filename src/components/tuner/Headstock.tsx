import { InlineHeadstock, LayoutStylePill } from '@/components/tuner/InlineHeadstock'
import {
  isTwelveString,
  layoutPegs,
  pegLetter,
  usesCloverPegs,
  usesGuitarShape,
  type PegSide,
  type PegSlot,
} from '@/lib/headstock'
import type { TunerLayoutMode } from '@/lib/custom-presets'
import type { InstrumentString } from '@/lib/notes'
import type { InstrumentId } from '@/lib/presets'
import { cn } from '@/lib/utils'

type HeadstockProps = {
  strings: readonly InstrumentString[]
  config: InstrumentId
  selectedId: string | null
  tunedIds: ReadonlySet<string>
  inTune: boolean
  live: boolean
  autoString: boolean
  onAutoChange: (value: boolean) => void
  onTapPeg: (string: InstrumentString) => void
  layoutMode: TunerLayoutMode
  onLayoutChange: (value: TunerLayoutMode) => void
}

const VIEW_W = 480
const CX = VIEW_W / 2
const GUITAR_TOP = 14
const WHITE = '#F4F7FB'
const LAVENDER = '#EDE8F8'
const RED = '#EF4444'
const GREEN = '#22C55E'
const INK = '#070B16'
const BODY_STROKE = 3.5

type Tone = 'idle' | 'selected' | 'red' | 'green' | 'sticky'

type PegGeom = PegSlot & {
  postX: number
  postY: number
  buttonX: number
  buttonY: number
  nutX: number
  nutY: number
  edgeX: number
  hexR: number
  nub: boolean
}

type CourseSlot = {
  leftX: number
  rightX: number
}

type Drawn = {
  viewW: number
  cx: number
  height: number
  nutY: number
  nutLeft: number
  nutWidth: number
  neckH: number
  rows: number
  pegs: PegGeom[]
  topHalf: number
  bodyHalf: number
  guitarShape: boolean
  courses: CourseSlot[]
}

function toneFor(
  id: string,
  selectedId: string | null,
  tunedIds: ReadonlySet<string>,
  inTune: boolean,
  live: boolean,
): Tone {
  if (tunedIds.has(id)) return 'sticky'
  if (id === selectedId) {
    if (live && inTune) return 'green'
    if (live) return 'red'
    return 'selected'
  }
  return 'idle'
}

function colors(tone: Tone): { fill: string; stroke: string; text: string } {
  if (tone === 'red') return { fill: RED, stroke: RED, text: WHITE }
  if (tone === 'green' || tone === 'sticky') {
    return { fill: GREEN, stroke: GREEN, text: WHITE }
  }
  if (tone === 'selected') return { fill: WHITE, stroke: WHITE, text: INK }
  return { fill: INK, stroke: LAVENDER, text: WHITE }
}

function activeColor(tone: Tone): string | null {
  if (tone === 'green' || tone === 'sticky') return GREEN
  if (tone === 'red') return RED
  return null
}

function layout(
  slots: PegSlot[],
  config: InstrumentId,
  clover: boolean,
): Drawn {
  if (usesGuitarShape(config)) return layoutGuitarShape(slots, config)
  const left = slots.filter((slot) => slot.side === 'left')
  const right = slots.filter((slot) => slot.side === 'right')
  const rows = Math.max(left.length, right.length, 1)
  const leftPad = rows - left.length
  const rightPad = rows - right.length
  const banjo = config === 'banjo'
  const neckH = banjo ? 128 : 82
  const hexR = clover ? (rows <= 2 ? 22 : rows === 3 ? 20 : 18) : rows >= 4 ? 18 : 20
  const barrel = clover ? 20 : 14
  const rowGap = Math.max(rows <= 2 ? 62 : rows === 3 ? 52 : 44, hexR * 2 + 10)
  const firstY = rows <= 2 ? 56 : 52
  const lastY = firstY + (rows - 1) * rowGap
  const nutY = lastY + 62
  const height = nutY + neckH

  const neckCount = slots.length
  const nutWidth = 24 + neckCount * 14
  const nutLeft = CX - nutWidth / 2
  const pad = 8
  const span = Math.max(1, neckCount - 1)
  const topHalf = rows <= 2 ? 108 : rows === 3 ? 100 : 94

  const byNo = [...slots].sort((a, b) => b.string.stringNo - a.string.stringNo)
  const nutXs = new Map<string, number>()
  byNo.forEach((slot, index) => {
    const t = neckCount === 1 ? 0.5 : index / span
    nutXs.set(slot.string.id, nutLeft + pad + t * (nutWidth - pad * 2))
  })

  const pegs: PegGeom[] = slots.map((slot) => {
    const nutX = nutXs.get(slot.string.id) ?? CX
    if (slot.side === 'fifth') {
      const buttonY = nutY + 72
      const neckLeft = nutLeft - 4
      const fifthR = 18
      const fifthBarrel = 22
      return {
        ...slot,
        postX: neckLeft + 7,
        postY: buttonY,
        buttonX: neckLeft - fifthR - fifthBarrel,
        buttonY,
        nutX,
        nutY,
        edgeX: neckLeft,
        hexR: fifthR,
        nub: false,
      }
    }

    const rowIndex =
      slot.row + (slot.side === 'left' ? leftPad : rightPad)
    const postY = firstY + rowIndex * rowGap
    const stagger = rowIndex * (rows >= 4 ? 3 : rows === 3 ? 1.5 : 0)
    const postCol = rows <= 2 ? 48 : 46
    const postX =
      slot.side === 'left' ? CX - postCol - stagger : CX + postCol + stagger
    const dir = slot.side === 'left' ? 1 : -1
    const edgeX = bodyEdgeX(postY, slot.side, nutY, nutWidth / 2, topHalf)
    const buttonX = edgeX - dir * (hexR + barrel)
    return {
      ...slot,
      postX,
      postY,
      buttonX,
      buttonY: postY,
      nutX,
      nutY,
      edgeX,
      hexR,
      nub: false,
    }
  })

  return {
    viewW: VIEW_W,
    cx: CX,
    height,
    nutY,
    nutLeft,
    nutWidth,
    neckH,
    rows,
    pegs,
    topHalf,
    bodyHalf: topHalf,
    guitarShape: false,
    courses: [],
  }
}

function guitarMetrics(rows: number, pairedNut: boolean, bass = false) {
  const extraNut = bass ? (rows <= 2 ? 10 : rows === 3 ? 8 : 6) : 0
  if (rows <= 2) {
    return {
      hexR: bass ? 17 : 16,
      barrel: 18,
      rowGap: bass ? 70 : 66,
      firstY: 86,
      tail: 92,
      nutWidth: 76 + extraNut,
      postInset: 14,
      bodyHalf: 96,
      neckH: 124,
    }
  }
  if (rows === 3) {
    return {
      hexR: 15.5,
      barrel: 17,
      rowGap: 56,
      firstY: 84,
      tail: 90,
      nutWidth: 80 + extraNut,
      postInset: 13,
      bodyHalf: 94,
      neckH: 120,
    }
  }
  if (rows === 4) {
    return {
      hexR: 14,
      barrel: 15,
      rowGap: 48,
      firstY: 80,
      tail: 82,
      nutWidth: 88 + extraNut,
      postInset: 12,
      bodyHalf: 92,
      neckH: 116,
    }
  }
  if (rows === 5) {
    return {
      hexR: 13,
      barrel: 14,
      rowGap: 42,
      firstY: 76,
      tail: 72,
      nutWidth: 100,
      postInset: 11,
      bodyHalf: 90,
      neckH: 110,
    }
  }
  return {
    hexR: 12.5,
    barrel: 13,
    rowGap: 38,
    firstY: 72,
    tail: 64,
    nutWidth: pairedNut ? 112 : 104,
    postInset: 10,
    bodyHalf: pairedNut ? 88 : 86,
    neckH: pairedNut ? 118 : 108,
  }
}

function layoutGuitarShape(slots: PegSlot[], config: InstrumentId): Drawn {
  const fifth = slots.find((slot) => slot.side === 'fifth') ?? null
  const bodySlots = slots.filter((slot) => slot.side !== 'fifth')
  const left = bodySlots.filter((slot) => slot.side === 'left')
  const right = bodySlots.filter((slot) => slot.side === 'right')
  const rows = Math.max(left.length, right.length, 1)
  const pairedNut = config === 'guitar-12' && bodySlots.length === 12
  const bass = usesCloverPegs(config)
  const banjo = config === 'banjo'
  const m = guitarMetrics(rows, pairedNut, bass)
  const nutY = m.firstY + (rows - 1) * m.rowGap + m.tail
  const neckH = banjo ? 184 : m.neckH
  const height = nutY + neckH
  const pegOut = (bass ? m.hexR * 1.18 : m.hexR) + m.barrel
  const viewW = Math.round(2 * (m.bodyHalf + pegOut + 80))
  const cx = viewW / 2
  const nutLeft = cx - m.nutWidth / 2
  const pad = 8

  const nutLayout = pairedNut
    ? pairedNutXs(bodySlots, nutLeft, m.nutWidth, pad)
    : banjo && fifth
      ? {
          nutXs: banjoLongNutXs(bodySlots, nutLeft, m.nutWidth, pad),
          courses: [] as CourseSlot[],
        }
      : {
          nutXs: evenNutXs(bodySlots, nutLeft, m.nutWidth, pad, cx),
          courses: [] as CourseSlot[],
        }
  const nutXs = nutLayout.nutXs
  const fifthX = banjo && fifth ? banjoFifthX(nutLeft, pad) : nutLeft + 7

  const pegs: PegGeom[] = bodySlots.map((slot) => {
    const nutX = nutXs.get(slot.string.id) ?? cx
    const postY = m.firstY + slot.row * m.rowGap
    const dir = slot.side === 'left' ? 1 : -1
    const edgeX = guitarEdgeX(postY, slot.side, nutY, cx, m.nutWidth / 2, m.bodyHalf)
    const postX = edgeX + dir * m.postInset
    const buttonX = edgeX - dir * (m.hexR + m.barrel)
    return {
      ...slot,
      postX,
      postY,
      buttonX,
      buttonY: postY,
      nutX,
      nutY,
      edgeX,
      hexR: m.hexR,
      nub: true,
    }
  })

  if (fifth) {
    const fifthR = Math.max(16, m.hexR - 3)
    const fifthY = nutY + neckH * (5 / 7)
    const pipX = fifthX
    pegs.push({
      ...fifth,
      postX: pipX,
      postY: fifthY,
      buttonX: nutLeft - (fifthR + m.barrel),
      buttonY: fifthY,
      nutX: pipX,
      nutY: fifthY,
      edgeX: nutLeft,
      hexR: fifthR,
      nub: true,
    })
  }

  return {
    viewW,
    cx,
    height,
    nutY,
    nutLeft,
    nutWidth: m.nutWidth,
    neckH,
    rows,
    pegs,
    topHalf: guitarHalf(GUITAR_TOP + 8, nutY, m.nutWidth / 2, m.bodyHalf),
    bodyHalf: m.bodyHalf,
    guitarShape: true,
    courses: nutLayout.courses,
  }
}

function banjoFifthX(nutLeft: number, pad: number): number {
  return nutLeft + pad
}

function banjoLongNutXs(
  slots: PegSlot[],
  nutLeft: number,
  nutWidth: number,
  pad: number,
): Map<string, number> {
  const byNo = [...slots].sort((a, b) => b.string.stringNo - a.string.stringNo)
  const inner = nutWidth - pad * 2
  const nutXs = new Map<string, number>()
  // Five tracks across the nut; the drone uses track 0 only from the 5th fret down.
  byNo.forEach((slot, index) => {
    const t = (index + 1) / Math.max(1, byNo.length)
    nutXs.set(slot.string.id, nutLeft + pad + t * inner)
  })
  return nutXs
}

function evenNutXs(
  slots: PegSlot[],
  nutLeft: number,
  nutWidth: number,
  pad: number,
  cx: number,
): Map<string, number> {
  const byNo = [...slots].sort((a, b) => b.string.stringNo - a.string.stringNo)
  const span = Math.max(1, slots.length - 1)
  const nutXs = new Map<string, number>()
  byNo.forEach((slot, index) => {
    const t = slots.length === 1 ? 0.5 : index / span
    nutXs.set(slot.string.id, nutLeft + pad + t * (nutWidth - pad * 2))
  })
  if (slots.length === 0) nutXs.set('', cx)
  return nutXs
}

function pairedNutXs(
  slots: PegSlot[],
  nutLeft: number,
  nutWidth: number,
  pad: number,
): { nutXs: Map<string, number>; courses: CourseSlot[] } {
  const byNo = [...slots].sort((a, b) => b.string.stringNo - a.string.stringNo)
  const grouped: PegSlot[][] = []
  for (let i = 0; i < byNo.length; i += 2) {
    grouped.push(byNo.slice(i, i + 2))
  }
  const span = Math.max(1, grouped.length - 1)
  const inner = nutWidth - pad * 2
  // Tight within a course, wider between courses — like a real 12-string nut.
  const pairGap = 7
  const nutXs = new Map<string, number>()
  const courses: CourseSlot[] = []
  grouped.forEach((course, index) => {
    const t = grouped.length === 1 ? 0.5 : index / span
    const center = nutLeft + pad + t * inner
    const pair = [...course].sort((a, b) => b.string.stringNo - a.string.stringNo)
    const leftX = center - pairGap / 2
    const rightX = center + pairGap / 2
    if (pair[0]) nutXs.set(pair[0].string.id, pair[1] ? leftX : center)
    if (pair[1]) nutXs.set(pair[1].string.id, rightX)
    courses.push({ leftX: pair[1] ? leftX : center, rightX: pair[1] ? rightX : center })
  })
  return { nutXs, courses }
}

function isOctaveOfCourse(
  string: InstrumentString,
  strings: readonly InstrumentString[],
): boolean {
  const mateNo =
    string.stringNo % 2 === 0 ? string.stringNo - 1 : string.stringNo + 1
  const mate = strings.find((item) => item.stringNo === mateNo)
  if (!mate) return false
  return string.midi > mate.midi
}

function guitarStations(
  _nutY: number,
  nutHalf: number,
  bodyHalf: number,
  inset: number,
) {
  const top = GUITAR_TOP + inset * 0.2
  const scoopY = top + 21
  const hx = bodyHalf - inset * 0.34
  const nut = Math.max(8, nutHalf + 1.1 - inset * 0.28)
  return { top, scoopY, hx, nut }
}

function guitarHalf(
  y: number,
  nutY: number,
  nutHalf: number,
  bodyHalf: number,
  inset = 0,
): number {
  const { top, hx, nut } = guitarStations(nutY, nutHalf, bodyHalf, inset)
  const t = Math.max(0, Math.min(1, (y - top) / Math.max(1, nutY - top)))
  const maxW = hx
  const midW = hx * 0.96
  let half: number
  if (t < 0.07) {
    const u = t / 0.07
    const s = u * (2 - u)
    half = maxW * (0.84 + 0.16 * s)
  } else if (t < 0.7) {
    const u = (t - 0.07) / 0.63
    half = maxW + (midW - maxW) * u
  } else {
    const u = (t - 0.7) / 0.3
    const s = u * u * (3 - 2 * u)
    half = midW + (nut - midW) * s
  }
  return Math.max(8, half)
}

function guitarEdgeX(
  y: number,
  side: PegSide,
  nutY: number,
  cx: number,
  nutHalf: number,
  bodyHalf: number,
): number {
  const half = guitarHalf(y, nutY, nutHalf, bodyHalf)
  return side === 'right' ? cx + half : cx - half
}

function guitarBatwing(
  cx: number,
  nutY: number,
  nutHalf: number,
  bodyHalf: number,
  inset: number,
): string {
  const { top, scoopY, hx, nut } = guitarStations(
    nutY,
    nutHalf,
    bodyHalf,
    inset,
  )
  const sideY = top + 50
  const midY = top + (nutY - top) * 0.55
  const lowY = nutY - 38
  const sideH = guitarHalf(sideY, nutY, nutHalf, bodyHalf, inset)
  const midH = guitarHalf(midY, nutY, nutHalf, bodyHalf, inset)

  return [
    `M ${cx} ${scoopY}`,
    `C ${cx + hx * 0.2} ${scoopY - 2}, ${cx + hx * 0.52} ${top - 2}, ${cx + hx * 0.86} ${top + 9}`,
    `C ${cx + hx * 0.98} ${top + 18}, ${cx + sideH} ${top + 32}, ${cx + sideH} ${sideY}`,
    `C ${cx + sideH} ${sideY + 36}, ${cx + midH + 1} ${midY - 10}, ${cx + midH} ${midY}`,
    `C ${cx + midH - 1} ${lowY - 6}, ${cx + nut + 14} ${lowY + 6}, ${cx + nut + 3} ${nutY - 6}`,
    `C ${cx + nut + 0.8} ${nutY - 1.6}, ${cx + nut} ${nutY}, ${cx + nut} ${nutY}`,
    `L ${cx - nut} ${nutY}`,
    `C ${cx - nut} ${nutY}, ${cx - nut - 0.8} ${nutY - 1.6}, ${cx - nut - 3} ${nutY - 6}`,
    `C ${cx - nut - 14} ${lowY + 6}, ${cx - midH + 1} ${lowY - 6}, ${cx - midH} ${midY}`,
    `C ${cx - midH - 1} ${midY - 10}, ${cx - sideH} ${sideY + 36}, ${cx - sideH} ${sideY}`,
    `C ${cx - sideH} ${top + 32}, ${cx - hx * 0.98} ${top + 18}, ${cx - hx * 0.86} ${top + 9}`,
    `C ${cx - hx * 0.52} ${top - 2}, ${cx - hx * 0.2} ${scoopY - 2}, ${cx} ${scoopY}`,
    'Z',
  ].join(' ')
}

function bodyEdgeX(
  y: number,
  side: PegSide,
  nutY: number,
  nutHalf: number,
  topHalf: number,
): number {
  const t = Math.max(0, Math.min(1, (y - 16) / Math.max(1, nutY - 16)))
  const midHalf = topHalf * 0.94
  const botHalf = nutHalf + 10
  const half =
    t < 0.72
      ? topHalf + (midHalf - topHalf) * (t / 0.72)
      : midHalf + (botHalf - midHalf) * ((t - 0.72) / 0.28)
  return side === 'right' ? CX + half : CX - half
}

export function Headstock({
  strings,
  config,
  selectedId,
  tunedIds,
  inTune,
  live,
  autoString,
  onAutoChange,
  onTapPeg,
  layoutMode,
  onLayoutChange,
}: HeadstockProps) {
  const clover = usesCloverPegs(config)
  const twelveString = isTwelveString(config, strings.length)
  const effectiveLayout = twelveString ? 'headstock' : layoutMode
  const slots = layoutPegs(strings, config)
  const drawn = layout(slots, config, clover)
  const neckLeft = drawn.guitarShape ? drawn.nutLeft : drawn.nutLeft - 4
  const neckWidth = drawn.guitarShape ? drawn.nutWidth : drawn.nutWidth + 8
  const active = drawn.pegs.find((peg) => peg.string.id === selectedId) ?? null
  const rest = drawn.pegs.filter((peg) => peg.string.id !== selectedId)
  const fretCount = config === 'banjo' ? 6 : 3

  return (
    <div className="w-full" data-twelve-inline={twelveString ? 'off' : 'ok'}>
      <div className="mb-1 flex items-center justify-between gap-3">
        {twelveString ? (
          <span data-layout-toggle-hidden="twelve" />
        ) : (
          <LayoutStylePill
            layoutMode={layoutMode}
            onToggle={() =>
              onLayoutChange(layoutMode === 'inline' ? 'headstock' : 'inline')
            }
          />
        )}
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          Auto strings
          <AutoSwitch on={autoString} onChange={onAutoChange} />
        </label>
      </div>

      {effectiveLayout === 'inline' ? (
        <InlineHeadstock
          strings={strings}
          config={config}
          selectedId={selectedId}
          tunedIds={tunedIds}
          inTune={inTune}
          live={live}
          onTapPeg={onTapPeg}
        />
      ) : (
      <div
        id="headstock"
        className={cn(
          'relative mx-auto w-full',
          drawn.guitarShape ? 'max-w-[24rem]' : 'max-w-md',
        )}
      >
        <svg
          viewBox={`0 0 ${drawn.viewW} ${drawn.height}`}
          className="mx-auto block h-auto w-full"
          role="img"
          aria-label="Instrument headstock"
        >
          <defs>
            <filter
              id="omnician-peg-glow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="2.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter
              id="omnician-body-glow"
              x="-12%"
              y="-8%"
              width="124%"
              height="120%"
            >
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
              </feMerge>
            </filter>
            <linearGradient
              id="omnician-neck-fade"
              x1="0"
              y1={drawn.nutY}
              x2="0"
              y2={drawn.nutY + drawn.neckH}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={LAVENDER} stopOpacity="0.95" />
              <stop offset="55%" stopColor={LAVENDER} stopOpacity="0.45" />
              <stop offset="100%" stopColor={LAVENDER} stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="omnician-string-fade"
              x1="0"
              y1={drawn.nutY}
              x2="0"
              y2={drawn.nutY + drawn.neckH}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="70%" stopColor="white" stopOpacity="0.55" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path
            d={guitarBatwing(
              drawn.cx,
              drawn.nutY,
              drawn.nutWidth / 2,
              drawn.bodyHalf,
              0,
            )}
            fill="none"
            stroke="#A855F7"
            strokeWidth="12"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.3"
            filter="url(#omnician-body-glow)"
          />

          <line
            x1={neckLeft}
            y1={drawn.nutY}
            x2={neckLeft}
            y2={drawn.nutY + drawn.neckH}
            stroke="url(#omnician-neck-fade)"
            strokeWidth={BODY_STROKE}
            strokeLinecap="round"
          />
          <line
            x1={neckLeft + neckWidth}
            y1={drawn.nutY}
            x2={neckLeft + neckWidth}
            y2={drawn.nutY + drawn.neckH}
            stroke="url(#omnician-neck-fade)"
            strokeWidth={BODY_STROKE}
            strokeLinecap="round"
          />
          {Array.from({ length: fretCount }, (_, index) => {
            const t = (index + 1) / (fretCount + 1)
            return (
              <line
                key={t}
                x1={neckLeft}
                y1={drawn.nutY + drawn.neckH * t}
                x2={neckLeft + neckWidth}
                y2={drawn.nutY + drawn.neckH * t}
                stroke={LAVENDER}
                strokeWidth="1.15"
                opacity={0.42 - index * 0.1}
              />
            )
          })}

          <path
            d={guitarBatwing(
              drawn.cx,
              drawn.nutY,
              drawn.nutWidth / 2,
              drawn.bodyHalf,
              0,
            )}
            fill={INK}
            stroke={LAVENDER}
            strokeWidth={BODY_STROKE}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={guitarBatwing(
              drawn.cx,
              drawn.nutY,
              drawn.nutWidth / 2,
              drawn.bodyHalf,
              7.2,
            )}
            fill="none"
            stroke={LAVENDER}
            strokeWidth="1.25"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.5"
          />

          <line
            x1={drawn.nutLeft}
            y1={drawn.nutY}
            x2={drawn.nutLeft + drawn.nutWidth}
            y2={drawn.nutY}
            stroke={LAVENDER}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {drawn.pegs
            .filter((peg) => peg.side === 'fifth')
            .map((peg) => (
              <rect
                key={`fifth-nut-${peg.string.id}`}
                x={peg.nutX - 5}
                y={peg.postY - 2.2}
                width="10"
                height="4.4"
                fill={INK}
                stroke={LAVENDER}
                strokeWidth="1.25"
              />
            ))}
          {drawn.courses.map((course, index) => (
            <rect
              key={`course-${index}`}
              x={course.leftX - 1.8}
              y={drawn.nutY - 4.4}
              width={Math.max(4, course.rightX - course.leftX + 3.6)}
              height="8.8"
              rx="1.6"
              fill={INK}
              stroke={WHITE}
              strokeWidth="1.15"
            />
          ))}

          {rest.map((peg) => {
            const tone = toneFor(
              peg.string.id,
              selectedId,
              tunedIds,
              inTune,
              live,
            )
            const paired = drawn.courses.length > 0
            const octave = paired && isOctaveOfCourse(peg.string, strings)
            return (
              <StringRun
                key={`s-${peg.string.id}`}
                peg={peg}
                color={tone === 'sticky' ? GREEN : WHITE}
                width={
                  clover
                    ? 2.4
                    : octave
                      ? 1.15
                      : paired
                        ? 1.55
                        : 1.45
                }
                toNeck={drawn.height}
              />
            )
          })}
          {rest.map((peg) => (
            <Peg
              key={peg.string.id}
              peg={peg}
              letter={
                peg.side === 'fifth'
                  ? peg.string.pegLabel ?? peg.string.label.toLowerCase()
                  : pegLetter(peg.string, strings)
              }
              tone={toneFor(peg.string.id, selectedId, tunedIds, inTune, live)}
              onClick={() => onTapPeg(peg.string)}
            />
          ))}

          {active ? (
            <>
              <StringRun
                peg={active}
                color={
                  activeColor(
                    toneFor(active.string.id, selectedId, tunedIds, inTune, live),
                  ) ?? WHITE
                }
                width={
                  clover
                    ? 3.1
                    : drawn.courses.length > 0
                      ? isOctaveOfCourse(active.string, strings)
                        ? 1.7
                        : 2.05
                      : 2.15
                }
                toNeck={drawn.height}
              />
              <Peg
                peg={active}
                letter={
                  active.side === 'fifth'
                    ? active.string.pegLabel ?? active.string.label.toLowerCase()
                    : pegLetter(active.string, strings)
                }
                tone={toneFor(active.string.id, selectedId, tunedIds, inTune, live)}
                onClick={() => onTapPeg(active.string)}
              />
            </>
          ) : null}
        </svg>
      </div>
      )}
      <p className="mt-2 text-center text-[0.65rem] leading-4 text-slate-500">
        Tap a peg to hear its pitch and set the target. Hold a string in tune to
        lock it green — it stays green until you tap that peg or change the tuning.
      </p>
    </div>
  )
}

function StringRun({
  peg,
  color,
  width,
  toNeck,
}: {
  peg: PegGeom
  color: string
  width: number
  toNeck: number
}) {
  const lit = color === GREEN || color === RED
  return (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {peg.side === 'fifth' ? (
        <line
          x1={peg.postX}
          y1={peg.postY}
          x2={peg.buttonX}
          y2={peg.buttonY}
          strokeWidth={width}
        />
      ) : (
        <>
          <line
            x1={peg.nutX}
            y1={peg.nutY}
            x2={peg.postX}
            y2={peg.postY}
            strokeWidth={width}
          />
          <line
            x1={peg.nutX}
            y1={peg.nutY}
            x2={peg.nutX}
            y2={toNeck - 4}
            stroke={lit ? color : 'url(#omnician-string-fade)'}
            strokeWidth={width}
          />
        </>
      )}
    </g>
  )
}

function Peg({
  peg,
  letter,
  tone,
  onClick,
}: {
  peg: PegGeom
  letter: string
  tone: Tone
  onClick: () => void
}) {
  const { fill, stroke, text } = colors(tone)
  const glow = tone === 'red' || tone === 'green' || tone === 'sticky' || tone === 'selected'
  const dir = peg.side === 'right' ? -1 : 1
  const r = peg.hexR
  const shaftInner = peg.buttonX + dir * r * 0.72
  const shaftEnd = peg.edgeX - dir * 1.2
  const shaftW = Math.max(8, (shaftEnd - shaftInner) * dir)
  const shaftX = Math.min(shaftInner, shaftEnd)
  const shaftH = Math.max(5.2, r * 0.34)
  const washerW = Math.max(3.4, r * 0.22)
  const washerH = Math.max(6.2, r * 0.42)

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`String ${peg.string.stringNo}, ${letter}${tone === 'green' || tone === 'sticky' ? ', in tune' : ''}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      className="cursor-pointer"
      data-peg-tone={tone}
      data-string-id={peg.string.id}
      filter={glow ? 'url(#omnician-peg-glow)' : undefined}
    >
      <Post
        x={peg.postX}
        y={peg.postY}
        stroke={stroke}
        lit={tone !== 'idle'}
        compact={peg.side === 'fifth'}
      />
      <rect
        x={shaftX}
        y={peg.buttonY - shaftH / 2}
        width={shaftW}
        height={shaftH}
        rx={1.8}
        fill={fill}
        stroke={stroke}
        strokeWidth="2.1"
      />
      <rect
        x={dir === 1 ? peg.edgeX - washerW : peg.edgeX}
        y={peg.buttonY - washerH / 2}
        width={washerW}
        height={washerH}
        rx="1.2"
        fill={INK}
        stroke={stroke}
        strokeWidth="1.6"
      />
      <circle
        cx={peg.buttonX}
        cy={peg.buttonY}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth="2.35"
      />
      <text
        x={peg.buttonX}
        y={peg.buttonY + (letter.length > 1 ? 4.2 : 5.2)}
        textAnchor="middle"
        fill={text}
        fontSize={letter.length > 1 ? (r < 14 ? 10 : 11.5) : r < 14 ? 13.5 : 15.5}
        fontWeight="700"
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
      >
        {letter}
      </text>
    </g>
  )
}

function Post({
  x,
  y,
  stroke,
  lit,
  compact = false,
}: {
  x: number
  y: number
  stroke: string
  lit: boolean
  compact?: boolean
}) {
  const outer = compact ? 5.8 : 6.6
  const inner = compact ? 2.5 : 2.9
  return (
    <g>
      {lit ? (
        <circle cx={x} cy={y} r={compact ? 9 : 10.5} fill={stroke} opacity="0.22" />
      ) : null}
      <circle
        cx={x}
        cy={y}
        r={outer}
        fill={INK}
        stroke={stroke}
        strokeWidth={lit ? 2.5 : 2.05}
      />
      <circle
        cx={x}
        cy={y}
        r={inner}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
      />
    </g>
  )
}

function AutoSwitch({
  on,
  onChange,
}: {
  on: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Auto strings"
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors',
        on ? 'justify-end bg-[#A855F7]' : 'justify-start bg-white/15',
      )}
    >
      <span className="block size-6 shrink-0 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.45)]" />
    </button>
  )
}
