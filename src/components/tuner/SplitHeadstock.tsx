import { PegPulseRings, PegSpeakerIcon } from '@/components/tuner/PegSpeaker'
import { usesCloverPegs } from '@/lib/headstock'
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
import {
  SPLIT_NECK_FADE,
  SPLIT_VIEW_H,
  SPLIT_VIEW_W,
  SPLIT_WORDMARK,
  layoutSplit,
  type SplitPeg,
} from '@/lib/split-layout'
import type { InstrumentString } from '@/lib/notes'
import type { InstrumentId } from '@/lib/presets'

const WHITE = PEG_WHITE
const LAVENDER = PEG_LAVENDER
const GREEN = PEG_GREEN
const RED = PEG_RED
const INK = PEG_INK
const BODY_STROKE = 5.6

type SplitHeadstockProps = {
  strings: readonly InstrumentString[]
  config: InstrumentId
  selectedId: string | null
  tunedIds: ReadonlySet<string>
  inTune: boolean
  live: boolean
  onTapPeg: (string: InstrumentString) => void
  playingId?: string | null
}

export function SplitHeadstock({
  strings,
  config,
  selectedId,
  tunedIds,
  inTune,
  live,
  onTapPeg,
  playingId = null,
}: SplitHeadstockProps) {
  const drawn = layoutSplit(strings, config)
  const clover = usesCloverPegs(config)
  const active = drawn.pegs.find((peg) => peg.string.id === selectedId) ?? null
  const rest = drawn.pegs.filter((peg) => peg.string.id !== selectedId)

  return (
    <div
      id="headstock"
      data-split-headstock
      data-split-shape="paddle-a"
      data-fork-id={playingId ?? ''}
      className="relative h-full w-full"
    >
      <svg
        viewBox="140 170 920 1180"
        data-split-viewbox={`${SPLIT_VIEW_W}x${SPLIT_VIEW_H}`}
        className="mx-auto block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Split headstock"
      >
        <defs>
          <filter id="omnician-split-peg-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="omnician-split-body-glow" x="-18%" y="-10%" width="136%" height="124%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
            </feMerge>
          </filter>
          <linearGradient
            id="omnician-split-drop-fade"
            x1="0"
            y1={drawn.nutY}
            x2="0"
            y2={drawn.nutY + SPLIT_NECK_FADE}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="45%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask
            id="omnician-split-neck-mask"
            maskUnits="userSpaceOnUse"
            x="0"
            y={drawn.nutY - 2}
            width={SPLIT_VIEW_W}
            height={SPLIT_NECK_FADE + 4}
          >
            <rect
              x="0"
              y={drawn.nutY - 2}
              width={SPLIT_VIEW_W}
              height={SPLIT_NECK_FADE + 4}
              fill="url(#omnician-split-drop-fade)"
            />
          </mask>
        </defs>

        <path
          d={drawn.outline}
          fill="none"
          stroke={PEG_PURPLE}
          strokeWidth="18"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.28"
          filter="url(#omnician-split-body-glow)"
        />

        <g mask="url(#omnician-split-neck-mask)" data-split-neck-fade>
          <line
            x1={drawn.neckLeft}
            y1={drawn.nutY}
            x2={drawn.neckLeft}
            y2={drawn.nutY + SPLIT_NECK_FADE}
            stroke={LAVENDER}
            strokeWidth={BODY_STROKE}
            strokeLinecap="round"
          />
          <line
            x1={drawn.neckRight}
            y1={drawn.nutY}
            x2={drawn.neckRight}
            y2={drawn.nutY + SPLIT_NECK_FADE}
            stroke={LAVENDER}
            strokeWidth={BODY_STROKE}
            strokeLinecap="round"
          />
        </g>

        <path
          data-split-outline
          d={drawn.outline}
          fill={INK}
          stroke={LAVENDER}
          strokeWidth={BODY_STROKE}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <path d={drawn.truss} fill={LAVENDER} opacity="0.14" data-split-truss />

        <image
          href={SPLIT_WORDMARK.src}
          x={SPLIT_WORDMARK.cx - SPLIT_WORDMARK.length / 2}
          y={SPLIT_WORDMARK.cy - SPLIT_WORDMARK.thickness / 2}
          width={SPLIT_WORDMARK.length}
          height={SPLIT_WORDMARK.thickness}
          transform={`rotate(${SPLIT_WORDMARK.rotate} ${SPLIT_WORDMARK.cx} ${SPLIT_WORDMARK.cy})`}
          opacity={SPLIT_WORDMARK.opacity}
          preserveAspectRatio="xMidYMid meet"
          data-split-wordmark
        />

        <rect
          x={drawn.nut.x}
          y={drawn.nut.y}
          width={drawn.nut.w}
          height={drawn.nut.h}
          rx={drawn.nut.rx}
          fill={INK}
          stroke={LAVENDER}
          strokeWidth="4"
        />
        {drawn.courses.map((course, index) => (
          <rect
            key={`course-${index}`}
            x={course.leftX - 2.2}
            y={drawn.nut.y - 1}
            width={Math.max(5, course.rightX - course.leftX + 4.4)}
            height={drawn.nut.h + 2}
            rx="2"
            fill={INK}
            stroke={WHITE}
            strokeWidth="1.6"
          />
        ))}

        {rest.map((peg) => {
          const tone = pegTone(peg.string.id, selectedId, tunedIds, inTune, live)
          const playing = peg.string.id === playingId
          return (
            <StringRun
              key={`s-${peg.string.id}`}
              peg={peg}
              color={playing ? PEG_PURPLE : tone === 'sticky' ? GREEN : WHITE}
              width={playing ? (clover ? 5.4 : drawn.twelve ? 3.1 : 3.8) : clover ? 4.2 : drawn.twelve ? 2.1 : 2.6}
            />
          )
        })}
        {rest.map((peg) => (
          <Peg
            key={peg.string.id}
            peg={peg}
            tone={pegTone(peg.string.id, selectedId, tunedIds, inTune, live)}
            playing={peg.string.id === playingId}
            onClick={() => onTapPeg(peg.string)}
          />
        ))}

        {active ? (
          <>
            <StringRun
              peg={active}
              color={
                active.string.id === playingId
                  ? PEG_PURPLE
                  : pegActiveColor(
                      pegTone(active.string.id, selectedId, tunedIds, inTune, live),
                    ) ?? WHITE
              }
              width={clover ? 5.4 : drawn.twelve ? 3.1 : 3.8}
            />
            <Peg
              peg={active}
              tone={pegTone(active.string.id, selectedId, tunedIds, inTune, live)}
              playing={active.string.id === playingId}
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
  peg: SplitPeg
  color: string
  width: number
}) {
  if (peg.side === 'fifth') {
    return (
      <g stroke={color} fill="none" strokeLinecap="round">
        <line
          x1={peg.postX}
          y1={peg.postY}
          x2={peg.buttonX + peg.buttonW}
          y2={peg.postY}
          strokeWidth={width}
        />
      </g>
    )
  }
  return (
    <g stroke={color} fill="none" strokeLinecap="round">
      <line
        x1={peg.nutX}
        y1={peg.nutY}
        x2={peg.innerX}
        y2={peg.innerY}
        strokeWidth={width}
      />
      <g mask="url(#omnician-split-neck-mask)">
        <line
          x1={peg.nutX}
          y1={peg.nutY}
          x2={peg.nutX}
          y2={peg.nutY + SPLIT_NECK_FADE}
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
  playing,
  onClick,
}: {
  peg: SplitPeg
  tone: PegTone
  playing: boolean
  onClick: () => void
}) {
  const colors = playing
    ? { fill: PEG_PURPLE, stroke: PEG_PURPLE, text: PEG_WHITE }
    : pegColors(tone)
  const { fill, stroke, text } = colors
  const glow = playing || tone === 'red' || tone === 'green' || tone === 'sticky' || tone === 'selected'
  const lit = playing || tone !== 'idle'
  const locked = !playing && (tone === 'green' || tone === 'sticky')
  const letter = peg.letter
  const shaftY = peg.buttonY + peg.buttonH / 2
  const bassSide = peg.side !== 'right'
  const shaftFrom = bassSide ? peg.buttonX + peg.buttonW : peg.buttonX
  const shaftTo = bassSide ? peg.postX - peg.postR : peg.postX + peg.postR
  const labelX = bassSide ? peg.buttonX - 16 : peg.buttonX + peg.buttonW + 16
  const labelAnchor = bassSide ? 'end' : 'start'
  const checkX = bassSide ? peg.buttonX - 48 : peg.buttonX + peg.buttonW + 48
  const chipCx = peg.buttonX + peg.buttonW / 2
  const chipCy = peg.buttonY + peg.buttonH / 2

  return (
    <g
      role="button"
      tabIndex={0}
      data-split-string={peg.string.id}
      data-peg-tone={playing ? 'playing' : tone}
      data-peg-playing={playing ? '1' : '0'}
      aria-label={`String ${peg.string.stringNo}, ${letter}${playing ? ', playing reference' : locked ? ', in tune' : ''}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      className="cursor-pointer"
      filter={glow ? 'url(#omnician-split-peg-glow)' : undefined}
    >
      {playing ? <PegPulseRings cx={chipCx} cy={chipCy} radius={peg.buttonW * 0.78} /> : null}
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
        x1={shaftFrom}
        y1={shaftY}
        x2={shaftTo}
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
        strokeWidth={playing || tone === 'red' ? 4.6 : 3.8}
      />
      <PegSpeakerIcon
        cx={chipCx}
        cy={chipCy}
        size={Math.min(peg.buttonW, peg.buttonH) * 0.44}
        fill={text}
        flip={bassSide}
      />
      <text
        x={labelX}
        y={shaftY + 8}
        textAnchor={labelAnchor}
        fill={playing ? WHITE : locked ? GREEN : tone === 'red' ? RED : WHITE}
        fontSize="28"
        fontWeight="700"
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
      >
        {letter}
      </text>
      {locked ? (
        <text
          x={checkX}
          y={shaftY + 9}
          textAnchor={labelAnchor}
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
