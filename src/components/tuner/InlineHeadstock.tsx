import { ArrowLeftRight } from 'lucide-react'

import { usesCloverPegs } from '@/lib/headstock'
import {
  layoutInline,
  type InlinePeg,
} from '@/lib/inline-layout'
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
      data-inline-shape="v4"
      className="relative mx-auto w-full max-w-[24rem]"
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
          fontSize="8"
          fontWeight="600"
          letterSpacing="2.6"
          textAnchor="middle"
          transform={`rotate(90 ${drawn.wordX} ${drawn.wordY})`}
          fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
        >
          OMNICIAN
        </text>

        <rect
          x={drawn.nutLeft - 1.2}
          y={drawn.nutY - 3.4}
          width={drawn.nutWidth + 2.4}
          height="6.8"
          rx="2.4"
          fill={INK}
          stroke={LAVENDER}
          strokeWidth="2.6"
        />

        {rest.map((peg) => {
          const tone = pegTone(peg.string.id, selectedId, tunedIds, inTune, live)
          return (
            <StringRun
              key={`s-${peg.string.id}`}
              peg={peg}
              color={tone === 'sticky' ? GREEN : WHITE}
              width={clover ? 2.4 : 1.5}
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
              width={clover ? 3.1 : 2.15}
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
  const glow = tone === 'red' || tone === 'green' || tone === 'sticky' || tone === 'selected'
  const lit = tone !== 'idle'
  const half = peg.button / 2
  const locked = tone === 'green' || tone === 'sticky'
  const letter = peg.string.label

  return (
    <g
      role="button"
      tabIndex={0}
      data-inline-string={peg.string.id}
      data-peg-tone={tone}
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
        <circle cx={peg.postX} cy={peg.postY} r={peg.postR + 3.6} fill={stroke} opacity="0.22" />
      ) : null}
      <circle
        cx={peg.postX}
        cy={peg.postY}
        r={peg.postR}
        fill={lit ? stroke : INK}
        stroke={stroke}
        strokeWidth={lit ? 2.3 : 1.9}
      />
      <line
        x1={peg.buttonX + half}
        y1={peg.buttonY}
        x2={peg.edgeX}
        y2={peg.buttonY}
        stroke={stroke}
        strokeWidth={lit ? 2.6 : 2.1}
        strokeLinecap="round"
      />
      <rect
        x={peg.buttonX - half}
        y={peg.buttonY - half}
        width={peg.button}
        height={peg.button}
        rx={3.8}
        fill={fill}
        stroke={stroke}
        strokeWidth={tone === 'red' ? 2.7 : 2.2}
      />
      <line
        x1={peg.buttonX - half * 0.36}
        y1={peg.buttonY}
        x2={peg.buttonX + half * 0.36}
        y2={peg.buttonY}
        stroke={text}
        strokeWidth={Math.max(1.8, peg.button * 0.12)}
        strokeLinecap="round"
        opacity={tone === 'idle' ? 0.7 : 1}
      />
      <text
        x={peg.buttonX - half - 9}
        y={peg.buttonY + 4.4}
        textAnchor="end"
        fill={locked ? GREEN : tone === 'red' ? RED : WHITE}
        fontSize={peg.button >= 17 ? 14 : 13}
        fontWeight="700"
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
      >
        {letter}
      </text>
      {locked ? (
        <text
          x={peg.buttonX - half - 24}
          y={peg.buttonY + 4.6}
          textAnchor="end"
          fill={GREEN}
          fontSize="14"
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
