import { pegLetter, usesCloverPegs } from '@/lib/headstock'
import { inlinePegsFromTip } from '@/lib/inline-layout'
import type { InstrumentString } from '@/lib/notes'
import type { InstrumentId } from '@/lib/presets'
import {
  PEG_GREEN,
  PEG_INK,
  PEG_LAVENDER,
  PEG_RED,
  PEG_WHITE,
  pegActiveColor,
  pegColors,
  pegTone,
  type PegTone,
} from '@/lib/peg-style'
import { cn } from '@/lib/utils'

const BODY_STROKE = 3.5
const WHITE = PEG_WHITE
const LAVENDER = PEG_LAVENDER
const GREEN = PEG_GREEN
const RED = PEG_RED
const INK = PEG_INK

type InlineHeadstockProps = {
  strings: readonly InstrumentString[]
  config: InstrumentId
  selectedId: string | null
  tunedIds: ReadonlySet<string>
  inTune: boolean
  live: boolean
  onTapPeg: (string: InstrumentString) => void
}

type InlinePegGeom = {
  string: InstrumentString
  postX: number
  postY: number
  buttonX: number
  buttonY: number
  nutX: number
  nutY: number
  edgeX: number
  hexR: number
}

type InlineDrawn = {
  viewW: number
  height: number
  nutY: number
  nutLeft: number
  nutWidth: number
  neckH: number
  neckLeft: number
  neckWidth: number
  pegs: InlinePegGeom[]
  outline: string
  inset: string
}

function metrics(count: number, bass: boolean) {
  if (count <= 4) {
    return {
      hexR: bass ? 17 : 16,
      barrel: bass ? 19 : 17,
      rowGap: bass ? 56 : 52,
      firstY: 78,
      tail: 74,
      nutWidth: bass ? 70 : 64,
      postInset: 14,
      neckH: bass ? 118 : 108,
      leftHalf: 50,
      rightWing: 92,
    }
  }
  if (count <= 6) {
    return {
      hexR: 14.5,
      barrel: 16,
      rowGap: 44,
      firstY: 68,
      tail: 66,
      nutWidth: 72,
      postInset: 13,
      neckH: 104,
      leftHalf: 48,
      rightWing: 90,
    }
  }
  if (count === 7) {
    return {
      hexR: 13.4,
      barrel: 15,
      rowGap: 38,
      firstY: 62,
      tail: 60,
      nutWidth: 78,
      postInset: 12,
      neckH: 100,
      leftHalf: 46,
      rightWing: 86,
    }
  }
  if (count === 8) {
    return {
      hexR: 12.6,
      barrel: 14,
      rowGap: 34,
      firstY: 58,
      tail: 56,
      nutWidth: 84,
      postInset: 11.5,
      neckH: 96,
      leftHalf: 44,
      rightWing: 82,
    }
  }
  return {
    hexR: 11.4,
    barrel: 13,
    rowGap: 30,
    firstY: 52,
    tail: 50,
    nutWidth: 90,
    postInset: 10.5,
    neckH: 92,
    leftHalf: 42,
    rightWing: 72,
  }
}

function layoutInline(
  strings: readonly InstrumentString[],
  config: InstrumentId,
): InlineDrawn {
  const ordered = inlinePegsFromTip(strings)
  const count = Math.max(1, ordered.length)
  const bass = usesCloverPegs(config)
  const m = metrics(count, bass)
  const nutY = m.firstY + (count - 1) * m.rowGap + m.tail
  const height = nutY + m.neckH
  const pegOut = m.hexR + m.barrel
  const labelPad = 46
  const viewW = Math.round(labelPad + pegOut + m.leftHalf + m.rightWing + 36)
  const neckCx = labelPad + pegOut + m.leftHalf
  const nutLeft = neckCx - m.nutWidth / 2
  const nutWidth = m.nutWidth
  const pad = 7
  const span = Math.max(1, count - 1)

  const pegs: InlinePegGeom[] = ordered.map((string, index) => {
    const postY = m.firstY + index * m.rowGap
    const edgeX = ibanezLeftEdge(postY, nutY, neckCx, m.leftHalf, nutWidth / 2)
    const postX = edgeX + m.postInset
    const buttonX = edgeX - pegOut
    const t = count === 1 ? 0.5 : index / span
    // Nut: high string (tip, index 0) on the treble / right side of the nut.
    const nutX = nutLeft + pad + (1 - t) * (nutWidth - pad * 2)
    return {
      string,
      postX,
      postY,
      buttonX,
      buttonY: postY,
      nutX,
      nutY,
      edgeX,
      hexR: m.hexR,
    }
  })

  return {
    viewW,
    height,
    nutY,
    nutLeft,
    nutWidth,
    neckH: m.neckH,
    neckLeft: nutLeft,
    neckWidth: nutWidth,
    pegs,
    outline: ibanezOutline(neckCx, nutY, nutWidth / 2, m.leftHalf, m.rightWing, 0),
    inset: ibanezOutline(neckCx, nutY, nutWidth / 2, m.leftHalf, m.rightWing, 7.2),
  }
}

function ibanezLeftEdge(
  y: number,
  nutY: number,
  neckCx: number,
  leftHalf: number,
  nutHalf: number,
): number {
  const top = 18
  const t = Math.max(0, Math.min(1, (y - top) / Math.max(1, nutY - top)))
  const topX = neckCx - leftHalf * 0.78
  const midX = neckCx - leftHalf
  const botX = neckCx - nutHalf
  if (t < 0.12) {
    const u = t / 0.12
    return topX + (midX - topX) * (u * (2 - u))
  }
  if (t < 0.78) {
    const u = (t - 0.12) / 0.66
    return midX + (midX - (midX - botX) * 0.12 - midX) * u
  }
  const u = (t - 0.78) / 0.22
  const s = u * u * (3 - 2 * u)
  return midX * (1 - 0.12) + 0.12 * botX + (botX - (midX * 0.88 + botX * 0.12)) * s
}

function ibanezOutline(
  cx: number,
  nutY: number,
  nutHalf: number,
  leftHalf: number,
  rightWing: number,
  inset: number,
): string {
  const i = inset
  const tipX = cx + 34 - i * 0.12
  const tipY = 7 + i * 0.45
  const leftShoulderX = cx - leftHalf * 0.42 + i * 0.7
  const leftShoulderY = 26 + i * 0.25
  const leftX = cx - leftHalf + i
  const leftUpperY = 64
  const leftLowY = nutY - 58
  const nutL = cx - nutHalf + i * 0.18
  const nutR = cx + nutHalf - i * 0.18

  const hornX = cx + rightWing + 8 - i * 0.9
  const hornY = 64 + i * 0.15
  const biteX = cx + rightWing * 0.34 + i * 0.55
  const biteY = 108
  const wingX = cx + rightWing * 0.58 - i * 0.35
  const wingY = 158
  const taperX = cx + nutHalf + 14 - i * 0.2
  const taperY = nutY - 38

  return [
    `M ${tipX} ${tipY}`,
    `C ${tipX + 10} ${tipY + 16}, ${hornX - 4} ${hornY - 26}, ${hornX} ${hornY}`,
    `C ${hornX + 3} ${hornY + 16}, ${biteX + 18} ${biteY - 12}, ${biteX} ${biteY}`,
    `C ${biteX - 6} ${biteY + 14}, ${wingX + 10} ${wingY - 10}, ${wingX} ${wingY}`,
    `C ${wingX - 6} ${wingY + 36}, ${taperX + 8} ${taperY - 10}, ${taperX} ${taperY}`,
    `C ${taperX - 5} ${taperY + 12}, ${nutR + 7} ${nutY - 8}, ${nutR} ${nutY}`,
    `L ${nutL} ${nutY}`,
    `C ${nutL - 5} ${nutY - 10}, ${leftX - 2} ${leftLowY + 14}, ${leftX} ${leftLowY}`,
    `C ${leftX} ${leftLowY - 30}, ${leftX} ${leftUpperY + 18}, ${leftX} ${leftUpperY}`,
    `C ${leftX + 2} ${leftUpperY - 18}, ${leftShoulderX - 6} ${leftShoulderY + 8}, ${leftShoulderX} ${leftShoulderY}`,
    `C ${leftShoulderX + 8} ${leftShoulderY - 10}, ${tipX - 20} ${tipY + 14}, ${tipX} ${tipY}`,
    'Z',
  ].join(' ')
}

export function InlineHeadstock({
  strings,
  config,
  selectedId,
  tunedIds,
  inTune,
  live,
  onTapPeg,
}: InlineHeadstockProps) {
  const drawn = layoutInline(strings, config)
  const clover = usesCloverPegs(config)
  const active = drawn.pegs.find((peg) => peg.string.id === selectedId) ?? null
  const rest = drawn.pegs.filter((peg) => peg.string.id !== selectedId)
  const fretCount = 3

  return (
    <div
      id="inline-headstock"
      data-inline-headstock
      className="relative mx-auto w-full max-w-[22rem]"
    >
      <svg
        viewBox={`0 0 ${drawn.viewW} ${drawn.height}`}
        className="mx-auto block h-auto w-full"
        role="img"
        aria-label="Inline Ibanez-style headstock"
      >
        <defs>
          <filter
            id="omnician-inline-peg-glow"
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
            id="omnician-inline-body-glow"
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
            id="omnician-inline-neck-fade"
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
            id="omnician-inline-string-fade"
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
          d={drawn.outline}
          fill="none"
          stroke="#A855F7"
          strokeWidth="12"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.3"
          filter="url(#omnician-inline-body-glow)"
        />

        <line
          x1={drawn.neckLeft}
          y1={drawn.nutY}
          x2={drawn.neckLeft}
          y2={drawn.nutY + drawn.neckH}
          stroke="url(#omnician-inline-neck-fade)"
          strokeWidth={BODY_STROKE}
          strokeLinecap="round"
        />
        <line
          x1={drawn.neckLeft + drawn.neckWidth}
          y1={drawn.nutY}
          x2={drawn.neckLeft + drawn.neckWidth}
          y2={drawn.nutY + drawn.neckH}
          stroke="url(#omnician-inline-neck-fade)"
          strokeWidth={BODY_STROKE}
          strokeLinecap="round"
        />
        {Array.from({ length: fretCount }, (_, index) => {
          const t = (index + 1) / (fretCount + 1)
          return (
            <line
              key={t}
              x1={drawn.neckLeft}
              y1={drawn.nutY + drawn.neckH * t}
              x2={drawn.neckLeft + drawn.neckWidth}
              y2={drawn.nutY + drawn.neckH * t}
              stroke={LAVENDER}
              strokeWidth="1.15"
              opacity={0.42 - index * 0.1}
            />
          )
        })}

        <path
          d={drawn.outline}
          fill={INK}
          stroke={LAVENDER}
          strokeWidth={BODY_STROKE}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={drawn.inset}
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

        {rest.map((peg) => {
          const tone = pegTone(peg.string.id, selectedId, tunedIds, inTune, live)
          return (
            <StringRun
              key={`s-${peg.string.id}`}
              peg={peg}
              color={tone === 'sticky' ? GREEN : WHITE}
              width={clover ? 2.4 : 1.45}
              toNeck={drawn.height}
            />
          )
        })}
        {rest.map((peg) => (
          <Peg
            key={peg.string.id}
            peg={peg}
            letter={pegLetter(peg.string, strings)}
            note={`${peg.string.label}${peg.string.octave}`}
            tone={pegTone(peg.string.id, selectedId, tunedIds, inTune, live)}
            onClick={() => onTapPeg(peg.string)}
          />
        ))}

        {active ? (
          <>
            <StringRun
              peg={active}
              color={
                pegActiveColor(
                  pegTone(active.string.id, selectedId, tunedIds, inTune, live),
                ) ?? WHITE
              }
              width={clover ? 3.1 : 2.15}
              toNeck={drawn.height}
            />
            <Peg
              peg={active}
              letter={pegLetter(active.string, strings)}
              note={`${active.string.label}${active.string.octave}`}
              tone={pegTone(active.string.id, selectedId, tunedIds, inTune, live)}
              onClick={() => onTapPeg(active.string)}
            />
          </>
        ) : null}
      </svg>
    </div>
  )
}

function StringRun({
  peg,
  color,
  width,
  toNeck,
}: {
  peg: InlinePegGeom
  color: string
  width: number
  toNeck: number
}) {
  const lit = color === GREEN || color === RED
  return (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
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
        stroke={lit ? color : 'url(#omnician-inline-string-fade)'}
        strokeWidth={width}
      />
    </g>
  )
}

function Peg({
  peg,
  letter,
  note,
  tone,
  onClick,
}: {
  peg: InlinePegGeom
  letter: string
  note: string
  tone: PegTone
  onClick: () => void
}) {
  const { fill, stroke, text } = pegColors(tone)
  const glow = tone === 'red' || tone === 'green' || tone === 'selected'
  const r = peg.hexR
  const shaftInner = peg.buttonX + r * 0.72
  const shaftEnd = peg.edgeX - 1.2
  const shaftW = Math.max(8, shaftEnd - shaftInner)
  const shaftX = Math.min(shaftInner, shaftEnd)
  const shaftH = Math.max(5.2, r * 0.34)
  const washerW = Math.max(3.4, r * 0.22)
  const washerH = Math.max(6.2, r * 0.42)
  const noteFill = tone === 'green' || tone === 'sticky' ? GREEN : WHITE

  return (
    <g
      role="button"
      tabIndex={0}
      data-inline-string={peg.string.id}
      aria-label={`String ${peg.string.stringNo}, ${letter}${tone === 'green' || tone === 'sticky' ? ', in tune' : ''}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      className="cursor-pointer"
      filter={glow ? 'url(#omnician-inline-peg-glow)' : undefined}
    >
      <Post x={peg.postX} y={peg.postY} stroke={stroke} lit={tone !== 'idle'} />
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
        x={peg.edgeX - washerW}
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
      <text
        x={peg.buttonX - r - 7}
        y={peg.buttonY + 4}
        textAnchor="end"
        fill={noteFill}
        opacity={tone === 'idle' ? 0.72 : 1}
        fontSize={note.length > 3 ? 10.5 : 12}
        fontWeight="600"
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
      >
        {note}
      </text>
    </g>
  )
}

function Post({
  x,
  y,
  stroke,
  lit,
}: {
  x: number
  y: number
  stroke: string
  lit: boolean
}) {
  return (
    <g>
      {lit ? <circle cx={x} cy={y} r={10.5} fill={stroke} opacity="0.22" /> : null}
      <circle
        cx={x}
        cy={y}
        r={6.6}
        fill={INK}
        stroke={stroke}
        strokeWidth={lit ? 2.5 : 2.05}
      />
      <circle
        cx={x}
        cy={y}
        r={2.9}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
      />
    </g>
  )
}

export function LayoutStyleToggle({
  layoutMode,
  onToggle,
}: {
  layoutMode: 'headstock' | 'inline'
  onToggle: () => void
}) {
  const label = layoutMode === 'inline' ? 'Inline' : 'Headstock'
  return (
    <button
      type="button"
      data-layout-toggle
      data-layout-mode={layoutMode}
      aria-label={`String layout ${label}. Tap to switch.`}
      onClick={onToggle}
      className={cn(
        'inline-flex min-h-8 items-center rounded-md px-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC] transition-colors hover:bg-white/8 hover:text-white',
      )}
    >
      {label}
    </button>
  )
}
