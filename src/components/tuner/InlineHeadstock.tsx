import { ArrowLeftRight } from 'lucide-react'

import { usesCloverPegs } from '@/lib/headstock'
import {
  INLINE_NECK_FADE,
  INLINE_NUT,
  INLINE_VIEW_H,
  INLINE_VIEW_W,
  INLINE_WORDMARK,
  layoutInline,
  type InlinePeg,
} from '@/lib/inline-layout'
import type { InstrumentString } from '@/lib/notes'
import type { InstrumentId } from '@/lib/presets'
import { layoutModeLabel, type TunerLayoutMode } from '@/lib/custom-presets'
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

const WHITE = PEG_WHITE
const LAVENDER = PEG_LAVENDER
const GREEN = PEG_GREEN
const RED = PEG_RED
const INK = PEG_INK
const BODY_STROKE = 5.6

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
      data-inline-shape="v4-svg"
      className="relative mx-auto w-full max-w-[24rem]"
    >
      <svg
        viewBox="240 160 720 1240"
        data-inline-viewbox={`${INLINE_VIEW_W}x${INLINE_VIEW_H}`}
        className="mx-auto block h-auto w-full"
        role="img"
        aria-label="Inline headstock"
      >
        <defs>
          <filter id="omnician-inline-peg-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="omnician-inline-body-glow" x="-18%" y="-10%" width="136%" height="124%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
            </feMerge>
          </filter>
          <linearGradient
            id="omnician-inline-drop-fade"
            x1="0"
            y1={drawn.nutY}
            x2="0"
            y2={drawn.nutY + INLINE_NECK_FADE}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="45%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask
            id="omnician-inline-neck-mask"
            maskUnits="userSpaceOnUse"
            x="0"
            y={drawn.nutY - 2}
            width={INLINE_VIEW_W}
            height={INLINE_NECK_FADE + 4}
          >
            <rect
              x="0"
              y={drawn.nutY - 2}
              width={INLINE_VIEW_W}
              height={INLINE_NECK_FADE + 4}
              fill="url(#omnician-inline-drop-fade)"
            />
          </mask>
          <clipPath id="omnician-inline-body-clip" clipPathUnits="userSpaceOnUse">
            <path d={drawn.outline} />
          </clipPath>
        </defs>

        <path
          d={drawn.outline}
          fill="none"
          stroke={PEG_PURPLE}
          strokeWidth="18"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.28"
          filter="url(#omnician-inline-body-glow)"
        />

        <g mask="url(#omnician-inline-neck-mask)" data-inline-neck-fade>
          <line
            x1={drawn.neckLeft}
            y1={drawn.nutY}
            x2={drawn.neckLeft}
            y2={drawn.nutY + INLINE_NECK_FADE}
            stroke={LAVENDER}
            strokeWidth={BODY_STROKE}
            strokeLinecap="round"
          />
          <line
            x1={drawn.neckRight}
            y1={drawn.nutY}
            x2={drawn.neckRight}
            y2={drawn.nutY + INLINE_NECK_FADE}
            stroke={LAVENDER}
            strokeWidth={BODY_STROKE}
            strokeLinecap="round"
          />
        </g>

        <path
          data-inline-outline
          d={drawn.outline}
          fill={INK}
          stroke={LAVENDER}
          strokeWidth={BODY_STROKE}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <path
          d={drawn.truss}
          fill={LAVENDER}
          opacity="0.14"
          data-inline-truss
        />

        <image
          href={INLINE_WORDMARK.src}
          x={INLINE_WORDMARK.cx - INLINE_WORDMARK.length / 2}
          y={INLINE_WORDMARK.cy - INLINE_WORDMARK.thickness / 2}
          width={INLINE_WORDMARK.length}
          height={INLINE_WORDMARK.thickness}
          transform={`rotate(-90 ${INLINE_WORDMARK.cx} ${INLINE_WORDMARK.cy})`}
          opacity={INLINE_WORDMARK.opacity}
          preserveAspectRatio="xMidYMid meet"
          clipPath="url(#omnician-inline-body-clip)"
          data-inline-wordmark
        />

        <rect
          x={INLINE_NUT.x}
          y={INLINE_NUT.y}
          width={INLINE_NUT.w}
          height={INLINE_NUT.h}
          rx="6"
          fill={INK}
          stroke={LAVENDER}
          strokeWidth="4"
        />

        {rest.map((peg) => {
          const tone = pegTone(peg.string.id, selectedId, tunedIds, inTune, live)
          return (
            <StringRun
              key={`s-${peg.string.id}`}
              peg={peg}
              color={tone === 'sticky' ? GREEN : WHITE}
              width={clover ? 4.2 : 2.6}
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
              width={clover ? 5.4 : 3.8}
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
}: {
  peg: InlinePeg
  color: string
  width: number
}) {
  return (
    <g stroke={color} fill="none" strokeLinecap="round">
      <line
        x1={peg.nutX}
        y1={peg.nutY}
        x2={peg.postX}
        y2={peg.postY}
        strokeWidth={width}
      />
      <g mask="url(#omnician-inline-neck-mask)">
        <line
          x1={peg.nutX}
          y1={peg.nutY}
          x2={peg.nutX}
          y2={peg.nutY + INLINE_NECK_FADE}
          stroke={color}
          strokeWidth={width}
        />
      </g>
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
  const locked = tone === 'green' || tone === 'sticky'
  const letter = peg.string.label
  const shaftY = peg.buttonY + peg.buttonH / 2

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
        <circle cx={peg.postX} cy={peg.postY} r={peg.postR + 8} fill={stroke} opacity="0.22" />
      ) : null}
      <circle
        cx={peg.postX}
        cy={peg.postY}
        r={peg.postR}
        fill={lit ? stroke : INK}
        stroke={stroke}
        strokeWidth={lit ? 4.2 : 3.4}
      />
      <line
        x1={peg.buttonX + peg.buttonW}
        y1={shaftY}
        x2={peg.postX - peg.postR}
        y2={shaftY}
        stroke={stroke}
        strokeWidth={lit ? 4.4 : 3.6}
        strokeLinecap="round"
      />
      <rect
        x={peg.buttonX}
        y={peg.buttonY}
        width={peg.buttonW}
        height={peg.buttonH}
        rx={peg.buttonRx}
        fill={fill}
        stroke={stroke}
        strokeWidth={tone === 'red' ? 4.6 : 3.8}
      />
      <line
        x1={peg.buttonX + peg.buttonW * 0.32}
        y1={shaftY}
        x2={peg.buttonX + peg.buttonW * 0.68}
        y2={shaftY}
        stroke={text}
        strokeWidth={Math.max(2.8, peg.buttonH * 0.1)}
        strokeLinecap="round"
        opacity={tone === 'idle' ? 0.7 : 1}
      />
      <text
        x={peg.buttonX - 16}
        y={shaftY + 8}
        textAnchor="end"
        fill={locked ? GREEN : tone === 'red' ? RED : WHITE}
        fontSize="28"
        fontWeight="700"
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
      >
        {letter}
      </text>
      {locked ? (
        <text
          x={peg.buttonX - 48}
          y={shaftY + 9}
          textAnchor="end"
          fill={GREEN}
          fontSize="28"
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
  const label = layoutModeLabel(layoutMode)
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
