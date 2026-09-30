import { ArrowLeftRight } from 'lucide-react'

import { usesCloverPegs } from '@/lib/headstock'
import { INLINE_EDGE_TAN, inlinePegsFromTip } from '@/lib/inline-layout'
import type { InstrumentString } from '@/lib/notes'
import type { InstrumentId } from '@/lib/presets'
import type { TunerLayoutMode } from '@/lib/custom-presets'
import {
  PEG_GREEN,
  PEG_INK,
  PEG_LAVENDER,
  PEG_PURPLE,
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

type InlinePeg = {
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

type Drawn = {
  viewW: number
  height: number
  nutY: number
  nutLeft: number
  nutWidth: number
  neckH: number
  outline: string
  inset: string
  wordX: number
  wordY: number
  pegs: InlinePeg[]
}

function metrics(count: number, bass: boolean) {
  if (count <= 4) {
    return {
      button: bass ? 15.5 : 13.5,
      postR: bass ? 6.4 : 5.2,
      gap: bass ? 54 : 48,
      firstY: 86,
      tail: 52,
      neckH: bass ? 118 : 108,
      shaft: 18,
      inset: bass ? 20 : 18,
      dome: 118,
    }
  }
  if (count <= 6) {
    return {
      button: 12,
      postR: 4.8,
      gap: 42,
      firstY: 78,
      tail: 48,
      neckH: 104,
      shaft: 16,
      inset: 17,
      dome: 112,
    }
  }
  if (count === 7) {
    return {
      button: 11,
      postR: 4.4,
      gap: 36,
      firstY: 72,
      tail: 44,
      neckH: 100,
      shaft: 15,
      inset: 16,
      dome: 108,
    }
  }
  if (count === 8) {
    return {
      button: 10,
      postR: 4.1,
      gap: 32,
      firstY: 68,
      tail: 42,
      neckH: 96,
      shaft: 14,
      inset: 15,
      dome: 104,
    }
  }
  return {
    button: 9,
    postR: 3.7,
    gap: 28,
    firstY: 62,
    tail: 38,
    neckH: 92,
    shaft: 13,
    inset: 14,
    dome: 100,
  }
}

function leftEdgeX(y: number, postXTip: number, firstY: number, inset: number): number {
  return postXTip + (y - firstY) * INLINE_EDGE_TAN - inset
}

function layoutInline(
  strings: readonly InstrumentString[],
  config: InstrumentId,
): Drawn {
  const ordered = inlinePegsFromTip(strings)
  const count = Math.max(1, ordered.length)
  const bass = usesCloverPegs(config)
  const m = metrics(count, bass)
  const lastY = m.firstY + (count - 1) * m.gap
  const nutY = lastY + m.tail
  const height = nutY + m.neckH

  const labelW = 28
  const sidePad = 10
  const postXTip = sidePad + labelW + m.button + m.shaft + m.inset + 6
  const leftNut = leftEdgeX(nutY, postXTip, m.firstY, m.inset)
  const postSpan = (count - 1) * m.gap * INLINE_EDGE_TAN
  const nutWidth = Math.max(50, postSpan + 14)
  const nutLeft = postXTip + postSpan / 2 + 7 - nutWidth / 2

  const joinY = m.firstY - 26
  const leftJoin = leftEdgeX(joinY, postXTip, m.firstY, m.inset)
  const rightJoin = leftJoin + m.dome
  const swoopY = nutY - 16
  const swoopX = nutLeft + nutWidth + 9
  const viewW = Math.max(rightJoin + 28, nutLeft + nutWidth + 36)

  const pegs: InlinePeg[] = ordered.map((string, index) => {
    const postY = m.firstY + index * m.gap
    const postX = postXTip + index * m.gap * INLINE_EDGE_TAN
    const edgeX = leftEdgeX(postY, postXTip, m.firstY, m.inset)
    const buttonX = edgeX - m.shaft - m.button / 2
    return {
      string,
      postX,
      postY,
      buttonX,
      buttonY: postY,
      nutX: postX,
      nutY,
      edgeX,
      button: m.button,
      postR: m.postR,
    }
  })

  const outline = v4Outline({
    nutLeft,
    nutWidth,
    nutY,
    leftNut,
    leftJoin,
    rightJoin,
    joinY,
    swoopX,
    swoopY,
    tipY: joinY - 34,
  })
  const inset = v4Outline({
    nutLeft: nutLeft + 1.2,
    nutWidth: nutWidth - 2.4,
    nutY,
    leftNut: leftNut + 6,
    leftJoin: leftJoin + 6,
    rightJoin: rightJoin - 6,
    joinY: joinY + 3,
    swoopX: swoopX - 5,
    swoopY: swoopY - 2,
    tipY: joinY - 28,
  })

  return {
    viewW,
    height,
    nutY,
    nutLeft,
    nutWidth,
    neckH: m.neckH,
    outline,
    inset,
    wordX: (rightJoin + swoopX) / 2 + 10,
    wordY: (joinY + swoopY) / 2 + 8,
    pegs,
  }
}

function v4Outline(p: {
  nutLeft: number
  nutWidth: number
  nutY: number
  leftNut: number
  leftJoin: number
  rightJoin: number
  joinY: number
  swoopX: number
  swoopY: number
  tipY: number
}): string {
  const nutR = p.nutLeft + p.nutWidth
  const rx = Math.max(18, (p.rightJoin - p.leftJoin) / 2)
  const ry = p.joinY - p.tipY
  return [
    `M ${p.nutLeft} ${p.nutY}`,
    `L ${p.leftNut} ${p.nutY}`,
    `L ${p.leftJoin} ${p.joinY}`,
    `A ${rx} ${ry} 0 0 1 ${p.rightJoin} ${p.joinY}`,
    `L ${p.swoopX} ${p.swoopY}`,
    `Q ${nutR + 2} ${p.nutY - 3} ${nutR} ${p.nutY}`,
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
        aria-label="Inline headstock"
      >
        <defs>
          <filter id="omnician-inline-peg-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="omnician-inline-body-glow" x="-12%" y="-8%" width="124%" height="120%">
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
          stroke={PEG_PURPLE}
          strokeWidth="12"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.3"
          filter="url(#omnician-inline-body-glow)"
        />

        <line
          x1={drawn.nutLeft}
          y1={drawn.nutY}
          x2={drawn.nutLeft}
          y2={drawn.nutY + drawn.neckH}
          stroke="url(#omnician-inline-neck-fade)"
          strokeWidth={BODY_STROKE}
          strokeLinecap="round"
        />
        <line
          x1={drawn.nutLeft + drawn.nutWidth}
          y1={drawn.nutY}
          x2={drawn.nutLeft + drawn.nutWidth}
          y2={drawn.nutY + drawn.neckH}
          stroke="url(#omnician-inline-neck-fade)"
          strokeWidth={BODY_STROKE}
          strokeLinecap="round"
        />
        {Array.from({ length: 3 }, (_, index) => {
          const t = (index + 1) / 4
          return (
            <line
              key={t}
              x1={drawn.nutLeft}
              y1={drawn.nutY + drawn.neckH * t}
              x2={drawn.nutLeft + drawn.nutWidth}
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
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.45"
        />

        <text
          x={drawn.wordX}
          y={drawn.wordY}
          fill={LAVENDER}
          opacity="0.38"
          fontSize="7.5"
          fontWeight="600"
          letterSpacing="2.4"
          textAnchor="middle"
          transform={`rotate(90 ${drawn.wordX} ${drawn.wordY})`}
          fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
        >
          OMNICIAN
        </text>

        <line
          x1={drawn.nutLeft}
          y1={drawn.nutY}
          x2={drawn.nutLeft + drawn.nutWidth}
          y2={drawn.nutY}
          stroke={LAVENDER}
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {rest.map((peg) => {
          const tone = pegTone(peg.string.id, selectedId, tunedIds, inTune, live)
          return (
            <StringRun
              key={`s-${peg.string.id}`}
              peg={peg}
              color={tone === 'sticky' ? GREEN : WHITE}
              width={clover ? 2.3 : 1.45}
              toNeck={drawn.height}
            />
          )
        })}
        {rest.map((peg) => (
          <Peg
            key={peg.string.id}
            peg={peg}
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
              width={clover ? 3 : 2.1}
              toNeck={drawn.height}
            />
            <Peg
              peg={active}
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
  peg: InlinePeg
  color: string
  width: number
  toNeck: number
}) {
  const lit = color === GREEN || color === RED
  return (
    <g stroke={color} fill="none" strokeLinecap="round">
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
  tone,
  onClick,
}: {
  peg: InlinePeg
  tone: PegTone
  onClick: () => void
}) {
  const { fill, stroke, text } = pegColors(tone)
  const glow = tone === 'red' || tone === 'green' || tone === 'selected'
  const lit = tone !== 'idle'
  const half = peg.button / 2
  const locked = tone === 'green' || tone === 'sticky'
  const letter = peg.string.label

  return (
    <g
      role="button"
      tabIndex={0}
      data-inline-string={peg.string.id}
      aria-label={`String ${peg.string.stringNo}, ${letter}${locked ? ', in tune' : ''}`}
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
      {lit ? (
        <circle cx={peg.postX} cy={peg.postY} r={peg.postR + 3.4} fill={stroke} opacity="0.22" />
      ) : null}
      <circle
        cx={peg.postX}
        cy={peg.postY}
        r={peg.postR}
        fill={lit ? stroke : INK}
        stroke={stroke}
        strokeWidth={lit ? 2.2 : 1.8}
      />
      <line
        x1={peg.buttonX + half}
        y1={peg.buttonY}
        x2={peg.edgeX}
        y2={peg.buttonY}
        stroke={stroke}
        strokeWidth={lit ? 2.4 : 1.9}
        strokeLinecap="round"
      />
      <rect
        x={peg.buttonX - half}
        y={peg.buttonY - half}
        width={peg.button}
        height={peg.button}
        rx={3.2}
        fill={fill}
        stroke={stroke}
        strokeWidth={tone === 'red' ? 2.6 : 2.1}
      />
      <line
        x1={peg.buttonX - half * 0.38}
        y1={peg.buttonY}
        x2={peg.buttonX + half * 0.38}
        y2={peg.buttonY}
        stroke={text}
        strokeWidth={Math.max(1.6, peg.button * 0.12)}
        strokeLinecap="round"
        opacity={tone === 'idle' ? 0.7 : 1}
      />
      <text
        x={peg.buttonX - half - 8}
        y={peg.buttonY + 4}
        textAnchor="end"
        fill={locked ? GREEN : tone === 'red' ? RED : WHITE}
        fontSize={peg.button > 13 ? 13 : 12}
        fontWeight="700"
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
      >
        {letter}
      </text>
      {locked ? (
        <text
          x={peg.buttonX - half - 22}
          y={peg.buttonY + 4.2}
          textAnchor="end"
          fill={GREEN}
          fontSize="13"
          fontWeight="700"
          fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
        >
          ✓
        </text>
      ) : null}
    </g>
  )
}

export function LayoutStylePill({
  layoutMode,
  onToggle,
}: {
  layoutMode: TunerLayoutMode
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
        'inline-flex h-8 items-center gap-1.5 rounded-full border border-[#C084FC]/80 bg-transparent px-3 text-xs font-semibold text-white shadow-[0_0_16px_rgba(168,85,247,0.18)] transition-colors hover:bg-[#A855F7]/15',
      )}
    >
      <ArrowLeftRight className="size-3.5 text-[#C084FC]" strokeWidth={2.2} />
      {label}
    </button>
  )
}
