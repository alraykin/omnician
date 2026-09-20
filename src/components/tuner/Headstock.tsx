import {
  layoutPegs,
  pegLetter,
  usesCloverPegs,
  type PegSide,
  type PegSlot,
} from '@/lib/headstock'
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
}

const VIEW_W = 480
const CX = VIEW_W / 2
const G6_VIEW = 380
const G6_CX = G6_VIEW / 2
const G6_NUT = 84
const G6_TOP = 10
const WHITE = '#F4F7FB'
const RED = '#EF4444'
const GREEN = '#22C55E'
const INK = '#070B16'

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
  guitar6: boolean
}

function toneFor(
  id: string,
  selectedId: string | null,
  tunedIds: ReadonlySet<string>,
  inTune: boolean,
  live: boolean,
): Tone {
  if (id === selectedId) {
    if (live && inTune) return 'green'
    if (live) return 'red'
    return 'selected'
  }
  if (tunedIds.has(id)) return 'sticky'
  return 'idle'
}

function colors(tone: Tone): { fill: string; stroke: string; text: string } {
  if (tone === 'red') return { fill: RED, stroke: RED, text: '#fff' }
  if (tone === 'green' || tone === 'sticky') {
    return { fill: GREEN, stroke: GREEN, text: '#fff' }
  }
  if (tone === 'selected') return { fill: WHITE, stroke: WHITE, text: INK }
  return { fill: INK, stroke: WHITE, text: WHITE }
}

function activeColor(tone: Tone): string | null {
  if (tone === 'green') return GREEN
  if (tone === 'red') return RED
  return null
}

function layout(
  slots: PegSlot[],
  config: InstrumentId,
  clover: boolean,
): Drawn {
  if (config === 'guitar-6') return layoutGuitar6(slots)
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
    guitar6: false,
  }
}

function layoutGuitar6(slots: PegSlot[]): Drawn {
  const cx = G6_CX
  const hexR = 22
  const stub = 11
  const rowGap = 60
  const firstY = 68
  const nutY = firstY + 2 * rowGap + 80
  const neckH = 100
  const height = nutY + neckH
  const nutWidth = G6_NUT
  const nutLeft = cx - nutWidth / 2
  const pad = 8
  const postCol = 41

  const byNo = [...slots].sort((a, b) => b.string.stringNo - a.string.stringNo)
  const span = Math.max(1, slots.length - 1)
  const nutXs = new Map<string, number>()
  byNo.forEach((slot, index) => {
    const t = slots.length === 1 ? 0.5 : index / span
    nutXs.set(slot.string.id, nutLeft + pad + t * (nutWidth - pad * 2))
  })

  const pegs: PegGeom[] = slots.map((slot) => {
    const nutX = nutXs.get(slot.string.id) ?? cx
    const postY = firstY + slot.row * rowGap
    const dir = slot.side === 'left' ? 1 : -1
    const postX = slot.side === 'left' ? cx - postCol : cx + postCol
    const edgeX = guitar6EdgeX(postY, slot.side, nutY)
    const buttonX = edgeX - dir * (hexR * 0.5 + stub)
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
      nub: true,
    }
  })

  return {
    viewW: G6_VIEW,
    cx,
    height,
    nutY,
    nutLeft,
    nutWidth,
    neckH,
    rows: 3,
    pegs,
    topHalf: guitar6Half(G6_TOP + 8, nutY),
    guitar6: true,
  }
}

function guitar6Half(y: number, nutY: number, inset = 0): number {
  const nutHalf = G6_NUT / 2
  const t = Math.max(
    0,
    Math.min(1, (y - G6_TOP) / Math.max(1, nutY - G6_TOP)),
  )
  // Traced from the reference: nearly parallel through the pegs,
  // then a short tuck into the nut.
  const keys: Array<[number, number]> = [
    [0.0, 73],
    [0.1, 72],
    [0.22, 70],
    [0.45, 69],
    [0.7, 69],
    [0.84, 69],
    [0.89, 62],
    [0.94, 52],
    [1.0, nutHalf + 1.4],
  ]
  let half = keys[keys.length - 1][1]
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, h0] = keys[i]
    const [t1, h1] = keys[i + 1]
    if (t >= t0 && t <= t1) {
      const u = (t - t0) / Math.max(0.0001, t1 - t0)
      half = h0 + (h1 - h0) * u
      break
    }
  }
  return Math.max(8, half - inset)
}

function guitar6EdgeX(y: number, side: PegSide, nutY: number): number {
  const half = guitar6Half(y, nutY)
  return side === 'right' ? G6_CX + half : G6_CX - half
}

function guitar6Batwing(nutY: number, nutHalf: number, inset: number): string {
  const cx = G6_CX
  const horn = guitar6Half(G6_TOP + 24, nutY, inset)
  const peakY = 8 + inset * 0.25
  const valleyY = 30 + inset * 0.4
  const sideY = 36 + inset * 0.15
  const nut = nutHalf + 1.2 - inset

  const right: string[] = []
  for (let y = sideY; y < nutY - 1; y += 7) {
    right.push(`L ${(cx + guitar6Half(y, nutY, inset)).toFixed(1)} ${y.toFixed(1)}`)
  }
  right.push(`L ${(cx + nut).toFixed(1)} ${nutY}`)

  const left: string[] = []
  for (let y = nutY - 7; y >= sideY; y -= 7) {
    left.push(`L ${(cx - guitar6Half(y, nutY, inset)).toFixed(1)} ${y.toFixed(1)}`)
  }

  return [
    `M ${cx - horn} ${sideY}`,
    `C ${cx - horn - 1} ${peakY + 1}, ${cx - 24} ${valleyY}, ${cx} ${valleyY}`,
    `C ${cx + 24} ${valleyY}, ${cx + horn + 1} ${peakY + 1}, ${cx + horn} ${sideY}`,
    ...right,
    `L ${cx - nut} ${nutY}`,
    ...left,
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

function batwing(
  nutY: number,
  nutHalf: number,
  inset: number,
  topHalf: number,
): string {
  const top = 10 + inset
  const dip = 28 + inset * 0.4
  const horn = topHalf - inset * 0.5
  const mid = topHalf * 0.94 - inset * 0.4
  const bot = nutHalf + 12 - inset
  const nut = nutHalf + 3 - inset
  const yMid = top + (nutY - top) * 0.48
  const yLow = nutY - 28 + inset * 0.1

  return [
    `M ${CX - horn} ${top + 16}`,
    `C ${CX - horn + 10} ${top - 4}, ${CX - 34} ${dip}, ${CX} ${dip}`,
    `C ${CX + 34} ${dip}, ${CX + horn - 10} ${top - 4}, ${CX + horn} ${top + 16}`,
    `C ${CX + horn + 5} ${top + 48}, ${CX + mid + 6} ${yMid}, ${CX + mid} ${yMid + 10}`,
    `C ${CX + mid - 2} ${yLow - 4}, ${CX + bot + 10} ${yLow}, ${CX + bot} ${nutY - 14}`,
    `C ${CX + bot - 2} ${nutY - 4}, ${CX + nut + 4} ${nutY}, ${CX + nut} ${nutY}`,
    `L ${CX - nut} ${nutY}`,
    `C ${CX - nut - 4} ${nutY}, ${CX - bot + 2} ${nutY - 4}, ${CX - bot} ${nutY - 14}`,
    `C ${CX - bot - 10} ${yLow}, ${CX - mid + 2} ${yLow - 4}, ${CX - mid} ${yMid + 10}`,
    `C ${CX - mid - 6} ${yMid}, ${CX - horn - 5} ${top + 48}, ${CX - horn} ${top + 16}`,
    'Z',
  ].join(' ')
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
}: HeadstockProps) {
  const clover = usesCloverPegs(config)
  const slots = layoutPegs(strings, config)
  const drawn = layout(slots, config, clover)
  const neckLeft = drawn.guitar6 ? drawn.nutLeft : drawn.nutLeft - 4
  const neckWidth = drawn.guitar6 ? drawn.nutWidth : drawn.nutWidth + 8
  const active = drawn.pegs.find((peg) => peg.string.id === selectedId) ?? null
  const rest = drawn.pegs.filter((peg) => peg.string.id !== selectedId)
  const fretCount = config === 'banjo' ? 6 : 3

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Headstock
        </p>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          Auto strings
          <AutoSwitch on={autoString} onChange={onAutoChange} />
        </label>
      </div>

      <div
        className={cn(
          'relative mx-auto w-full',
          drawn.guitar6 ? 'max-w-[24rem]' : 'max-w-md',
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
              x="-40%"
              y="-40%"
              width="180%"
              height="180%"
            >
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect
            x={neckLeft}
            y={drawn.nutY}
            width={neckWidth}
            height={drawn.neckH}
            fill={INK}
            stroke={WHITE}
            strokeWidth="2.2"
          />
          <rect
            x={neckLeft + 4}
            y={drawn.nutY}
            width={neckWidth - 8}
            height={drawn.neckH}
            fill="none"
            stroke={WHITE}
            strokeWidth="1.1"
            opacity="0.9"
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
                stroke={WHITE}
                strokeWidth="1.1"
              />
            )
          })}

          {drawn.guitar6 ? (
            <>
              <path
                d={guitar6Batwing(drawn.nutY, drawn.nutWidth / 2, 0)}
                fill={INK}
                stroke={WHITE}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <path
                d={guitar6Batwing(drawn.nutY, drawn.nutWidth / 2, 7)}
                fill="none"
                stroke={WHITE}
                strokeWidth="1.15"
                strokeLinejoin="round"
              />
            </>
          ) : (
            <>
              <path
                d={batwing(drawn.nutY, drawn.nutWidth / 2, 0, drawn.topHalf)}
                fill={INK}
                stroke={WHITE}
                strokeWidth="2.35"
                strokeLinejoin="round"
              />
              <path
                d={batwing(drawn.nutY, drawn.nutWidth / 2, 7, drawn.topHalf)}
                fill="none"
                stroke={WHITE}
                strokeWidth="1.15"
                strokeLinejoin="round"
              />
            </>
          )}

          <rect
            x={drawn.nutLeft}
            y={drawn.nutY - 3.5}
            width={drawn.nutWidth}
            height="7"
            fill={INK}
            stroke={WHITE}
            strokeWidth="1.6"
          />

          {rest.map((peg) => {
            const tone = toneFor(
              peg.string.id,
              selectedId,
              tunedIds,
              inTune,
              live,
            )
            return (
              <StringRun
                key={`s-${peg.string.id}`}
                peg={peg}
                color={tone === 'sticky' ? GREEN : WHITE}
                width={clover ? 1.7 : drawn.guitar6 ? 1.45 : 1.35}
                wound={clover}
                toNeck={drawn.height}
              />
            )
          })}
          {rest.map((peg) => (
            <Peg
              key={peg.string.id}
              peg={peg}
              clover={clover}
              letter={pegLetter(peg.string, strings)}
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
                width={clover ? 2.6 : drawn.guitar6 ? 2.2 : 2.35}
                wound={clover}
                toNeck={drawn.height}
              />
              <Peg
                peg={active}
                clover={clover}
                letter={pegLetter(active.string, strings)}
                tone={toneFor(active.string.id, selectedId, tunedIds, inTune, live)}
                onClick={() => onTapPeg(active.string)}
              />
            </>
          ) : null}
        </svg>
      </div>
      <p className="mt-2 text-center text-[0.65rem] leading-4 text-slate-500">
        Tap a peg to hear its pitch and set the target. The active string turns red
        until it locks green.
      </p>
    </div>
  )
}

function StringRun({
  peg,
  color,
  width,
  wound,
  toNeck,
}: {
  peg: PegGeom
  color: string
  width: number
  wound: boolean
  toNeck: number
}) {
  const neckEnd = peg.side === 'fifth' ? peg.buttonY : peg.nutY
  const headPath =
    peg.side === 'fifth'
      ? null
      : peg.nub
        ? `M ${peg.nutX} ${peg.nutY} L ${peg.postX} ${peg.postY}`
        : `M ${peg.nutX} ${peg.nutY} Q ${peg.nutX + (peg.side === 'right' ? -5 : 5)} ${(peg.nutY + peg.postY) / 2} ${peg.postX} ${peg.postY}`

  return (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {wound ? (
        <>
          <line
            x1={peg.nutX - 0.7}
            y1={toNeck - 2}
            x2={peg.nutX - 0.7}
            y2={neckEnd}
            strokeWidth={width}
          />
          <line
            x1={peg.nutX + 0.7}
            y1={toNeck - 2}
            x2={peg.nutX + 0.7}
            y2={neckEnd}
            strokeWidth={width * 0.55}
            opacity="0.7"
          />
        </>
      ) : (
        <line
          x1={peg.nutX}
          y1={toNeck - 2}
          x2={peg.nutX}
          y2={neckEnd}
          strokeWidth={width}
        />
      )}
      {headPath ? (
        wound ? (
          <>
            <path d={headPath} strokeWidth={width} />
            <path d={headPath} strokeWidth={width * 0.45} opacity="0.55" />
          </>
        ) : (
          <path d={headPath} strokeWidth={width} />
        )
      ) : null}
    </g>
  )
}

function Peg({
  peg,
  clover,
  letter,
  tone,
  onClick,
}: {
  peg: PegGeom
  clover: boolean
  letter: string
  tone: Tone
  onClick: () => void
}) {
  const { fill, stroke, text } = colors(tone)
  const glow = tone === 'red' || tone === 'green' || tone === 'selected'
  const dir = peg.side === 'right' ? -1 : 1
  const hexR = peg.hexR
  const shaftInner = hexR * (clover ? 0.38 : 0.72)
  const shaftEnd = peg.edgeX - dir * 1.5
  const shaftY = clover ? 5.4 : 4.8
  const shaftX = peg.buttonX + dir * shaftInner
  const shaftW = (shaftEnd - shaftX) * dir

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
      filter={glow ? 'url(#omnician-peg-glow)' : undefined}
    >
      {peg.side !== 'fifth' ? (
        <Post
          x={peg.postX}
          y={peg.postY}
          stroke={stroke}
          wound={clover}
          lit={tone !== 'idle'}
          compact={peg.nub}
        />
      ) : null}

      {peg.nub ? (
        <path
          d={nubHexPath(peg.buttonX, peg.buttonY, hexR, dir, peg.edgeX)}
          fill={fill}
          stroke={stroke}
          strokeWidth="2.15"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <rect
            x={dir === 1 ? shaftX : shaftX + (shaftEnd - shaftX)}
            y={peg.buttonY - shaftY}
            width={Math.max(10, shaftW)}
            height={shaftY * 2}
            rx={clover ? 2.2 : 2}
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
          />
          {clover || peg.side === 'fifth' ? (
            <>
              <circle
                cx={shaftEnd - dir * 11}
                cy={peg.buttonY}
                r="3.1"
                fill={INK}
                stroke={stroke}
                strokeWidth="1.5"
              />
              <circle
                cx={shaftEnd - dir * 5}
                cy={peg.buttonY}
                r="3.1"
                fill={INK}
                stroke={stroke}
                strokeWidth="1.5"
              />
            </>
          ) : (
            <rect
              x={dir === 1 ? shaftEnd - 6 : shaftEnd}
              y={peg.buttonY - 4}
              width="6"
              height="8"
              rx="1.6"
              fill={fill}
              stroke={stroke}
              strokeWidth="1.6"
            />
          )}
          {clover ? (
            <path
              d={cloverPath(peg.buttonX, peg.buttonY, dir, hexR)}
              fill={fill}
              stroke={stroke}
              strokeWidth="2.15"
              strokeLinejoin="round"
            />
          ) : (
            <path
              d={hexPath(peg.buttonX, peg.buttonY, hexR)}
              fill={fill}
              stroke={stroke}
              strokeWidth="2.15"
              strokeLinejoin="round"
            />
          )}
        </>
      )}
      <text
        x={peg.buttonX - (clover ? dir * 2.5 : 0)}
        y={peg.buttonY + (peg.nub ? 7 : 6)}
        textAnchor="middle"
        fill={text}
        fontSize={letter.length > 1 ? 13 : peg.nub ? 18 : 16}
        fontWeight="700"
        fontFamily="Outfit, sans-serif"
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
  wound,
  lit,
  compact = false,
}: {
  x: number
  y: number
  stroke: string
  wound: boolean
  lit: boolean
  compact?: boolean
}) {
  const outer = compact ? 6.4 : 7.4
  const inner = compact ? 2.8 : 3.2
  return (
    <g>
      {lit ? (
        <circle cx={x} cy={y} r={compact ? 9 : 11} fill={stroke} opacity="0.2" />
      ) : null}
      <circle
        cx={x}
        cy={y}
        r={outer}
        fill={INK}
        stroke={stroke}
        strokeWidth={lit ? 2.6 : 2.05}
      />
      <circle
        cx={x}
        cy={y}
        r={inner}
        fill="none"
        stroke={stroke}
        strokeWidth="1.45"
      />
      {wound ? (
        <line
          x1={x - 4.2}
          y1={y - 4.2}
          x2={x + 4.2}
          y2={y + 4.2}
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ) : null}
    </g>
  )
}

function hexPath(cx: number, cy: number, r: number, flat = 0.9): string {
  const rx = r
  const ry = r * flat
  const pts = Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index)
    return `${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`
  })
  return `M ${pts.join(' L ')} Z`
}

function nubHexPath(
  cx: number,
  cy: number,
  r: number,
  dir: number,
  edgeX: number,
): string {
  const rx = r
  const ry = r * 0.78
  const stubH = ry * 0.68
  const hex = (deg: number) => {
    const angle = (Math.PI / 180) * deg
    return `${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`
  }
  const stubTop = `${edgeX},${cy - stubH}`
  const stubBot = `${edgeX},${cy + stubH}`
  if (dir === 1) {
    return `M ${stubTop} L ${hex(300)} L ${hex(240)} L ${hex(180)} L ${hex(120)} L ${hex(60)} L ${stubBot} Z`
  }
  return `M ${stubTop} L ${hex(240)} L ${hex(300)} L ${hex(0)} L ${hex(60)} L ${hex(120)} L ${stubBot} Z`
}

function cloverPath(cx: number, cy: number, dir: number, size: number): string {
  const a = size * 1.08
  const steps = 72
  const pts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const r = a * (0.84 + 0.16 * -Math.cos(3 * t))
    const x = cx + dir * r * Math.cos(t)
    const y = cy + r * Math.sin(t)
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return `M ${pts.join(' L ')} Z`
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
