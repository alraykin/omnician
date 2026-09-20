import {
  layoutPegs,
  pegLetter,
  usesCloverPegs,
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

const VIEW_W = 400
const CX = VIEW_W / 2
const WHITE = '#F4F7FB'
const RED = '#EF4444'
const GREEN = '#22C55E'
const INK = '#0B1020'
const NECK_H = 72

type Tone = 'idle' | 'selected' | 'red' | 'green' | 'sticky'

type PegGeom = PegSlot & {
  postX: number
  postY: number
  buttonX: number
  buttonY: number
  nutX: number
  nutY: number
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
  return { fill: 'none', stroke: WHITE, text: WHITE }
}

function layout(slots: PegSlot[]): {
  height: number
  nutY: number
  nutLeft: number
  nutWidth: number
  pegs: PegGeom[]
  rows: number
} {
  const left = slots.filter((slot) => slot.side === 'left')
  const right = slots.filter((slot) => slot.side === 'right')
  const rows = Math.max(left.length, right.length, 1)
  const rowGap = rows <= 2 ? 58 : rows <= 3 ? 50 : 42
  const firstY = 52
  const nutY = firstY + (rows - 1) * rowGap + 56
  const height = nutY + NECK_H
  const nutWidth = 18 + rows * 14
  const nutLeft = CX - nutWidth / 2

  const body = slots.filter((slot) => slot.side !== 'fifth')
  const maxNo = Math.max(...body.map((slot) => slot.string.stringNo), 1)
  const minNo = Math.min(...body.map((slot) => slot.string.stringNo), 1)
  const span = Math.max(1, maxNo - minNo)
  const pad = 5

  const pegs: PegGeom[] = slots.map((slot) => {
    const nutX = nutLeft + pad + ((maxNo - slot.string.stringNo) / span) * (nutWidth - pad * 2)
    if (slot.side === 'fifth') {
      return {
        ...slot,
        postX: CX - 34,
        postY: nutY - 16,
        buttonX: 52,
        buttonY: nutY - 8,
        nutX: nutLeft + pad,
        nutY,
      }
    }
    const postY = firstY + slot.row * rowGap
    const postX = slot.side === 'left' ? CX - 40 : CX + 40
    const buttonX = slot.side === 'left' ? 54 : VIEW_W - 54
    return {
      ...slot,
      postX,
      postY,
      buttonX,
      buttonY: postY,
      nutX,
      nutY,
    }
  })

  return { height, nutY, nutLeft, nutWidth, pegs, rows }
}

function batwing(nutY: number, inset: number): string {
  const top = 12 + inset
  const dip = 28 + inset * 0.4
  const bottom = nutY - inset
  const topHalf = 62 - inset * 0.4
  const midHalf = 54 - inset * 0.35
  const nutHalf = 38 - inset
  const waist = top + (bottom - top) * 0.4

  return [
    `M ${CX - topHalf} ${top + 10}`,
    `C ${CX - topHalf + 12} ${top - 1}, ${CX - 22} ${dip}, ${CX} ${dip}`,
    `C ${CX + 22} ${dip}, ${CX + topHalf - 12} ${top - 1}, ${CX + topHalf} ${top + 10}`,
    `C ${CX + topHalf + 8} ${waist - 8}, ${CX + midHalf + 10} ${waist + 8}, ${CX + midHalf} ${waist + 28}`,
    `L ${CX + nutHalf + 10} ${bottom - 20}`,
    `C ${CX + nutHalf + 6} ${bottom - 6}, ${CX + nutHalf + 2} ${bottom}, ${CX + nutHalf - 2} ${bottom}`,
    `L ${CX - nutHalf + 2} ${bottom}`,
    `C ${CX - nutHalf - 2} ${bottom}, ${CX - nutHalf - 6} ${bottom - 6}, ${CX - nutHalf - 10} ${bottom - 20}`,
    `L ${CX - midHalf} ${waist + 28}`,
    `C ${CX - midHalf - 10} ${waist + 8}, ${CX - topHalf - 8} ${waist - 8}, ${CX - topHalf} ${top + 10}`,
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
  const drawn = layout(slots)
  const neckLeft = drawn.nutLeft - 3
  const neckWidth = drawn.nutWidth + 6
  const active = drawn.pegs.find((peg) => peg.string.id === selectedId) ?? null
  const rest = drawn.pegs.filter((peg) => peg.string.id !== selectedId)

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

      <div className="relative mx-auto w-full max-w-md">
        <svg
          viewBox={`0 0 ${VIEW_W} ${drawn.height}`}
          className="mx-auto block h-auto w-full"
          role="img"
          aria-label="Instrument headstock"
        >
          <rect
            x={neckLeft}
            y={drawn.nutY}
            width={neckWidth}
            height={NECK_H}
            fill={INK}
            stroke={WHITE}
            strokeWidth="2.2"
          />
          <rect
            x={neckLeft + 4}
            y={drawn.nutY}
            width={neckWidth - 8}
            height={NECK_H}
            fill="none"
            stroke={WHITE}
            strokeWidth="1.1"
            opacity="0.85"
          />
          {[0.28, 0.52, 0.76].map((t) => (
            <line
              key={t}
              x1={neckLeft}
              y1={drawn.nutY + NECK_H * t}
              x2={neckLeft + neckWidth}
              y2={drawn.nutY + NECK_H * t}
              stroke={WHITE}
              strokeWidth="1.1"
            />
          ))}

          <path d={batwing(drawn.nutY, 0)} fill={INK} stroke={WHITE} strokeWidth="2.4" strokeLinejoin="round" />
          <path
            d={batwing(drawn.nutY, 6)}
            fill="none"
            stroke={WHITE}
            strokeWidth="1.15"
            strokeLinejoin="round"
          />

          <rect
            x={drawn.nutLeft}
            y={drawn.nutY - 3}
            width={drawn.nutWidth}
            height="6"
            fill={INK}
            stroke={WHITE}
            strokeWidth="1.6"
          />

          {rest.map((peg) => (
            <StringRun
              key={`s-${peg.string.id}`}
              peg={peg}
              color={WHITE}
              width={1.35}
              toNeck={drawn.height}
            />
          ))}
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
                  toneFor(active.string.id, selectedId, tunedIds, inTune, live) === 'green'
                    ? GREEN
                    : toneFor(active.string.id, selectedId, tunedIds, inTune, live) === 'red'
                      ? RED
                      : WHITE
                }
                width={2.4}
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
  toNeck,
}: {
  peg: PegGeom
  color: string
  width: number
  toNeck: number
}) {
  const midY = (peg.nutY + peg.postY) / 2
  const inward = peg.side === 'right' ? -6 : peg.side === 'left' ? 6 : 0
  return (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line
        x1={peg.nutX}
        y1={toNeck - 2}
        x2={peg.nutX}
        y2={peg.nutY}
        strokeWidth={width}
      />
      <path
        d={`M ${peg.nutX} ${peg.nutY} Q ${peg.nutX + inward} ${midY} ${peg.postX} ${peg.postY}`}
        strokeWidth={width}
      />
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
  const inner = peg.side === 'right' ? -1 : 1
  const stemX = peg.buttonX + inner * 17
  const glow = tone === 'red' || tone === 'green'

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
    >
      {glow ? (
        <circle cx={peg.postX} cy={peg.postY} r="11" fill={stroke} opacity="0.22" />
      ) : null}
      <line
        x1={stemX}
        y1={peg.buttonY}
        x2={peg.postX}
        y2={peg.postY}
        stroke={stroke}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle
        cx={peg.postX}
        cy={peg.postY}
        r="7.2"
        fill={INK}
        stroke={stroke}
        strokeWidth={tone === 'idle' ? 2 : 2.6}
      />
      <circle cx={peg.postX} cy={peg.postY} r="3.1" fill="none" stroke={stroke} strokeWidth="1.4" />
      {clover ? (
        <path
          d={cloverPath(peg.buttonX, peg.buttonY)}
          fill={fill === 'none' ? INK : fill}
          stroke={stroke}
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d={hexPath(peg.buttonX, peg.buttonY, 21)}
          fill={fill === 'none' ? INK : fill}
          stroke={stroke}
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
      )}
      <text
        x={peg.buttonX}
        y={peg.buttonY + 6}
        textAnchor="middle"
        fill={text}
        fontSize="16"
        fontWeight="700"
        fontFamily="Outfit, sans-serif"
      >
        {letter}
      </text>
    </g>
  )
}

function hexPath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index)
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
  })
  return `M ${pts.join(' L ')} Z`
}

function cloverPath(cx: number, cy: number): string {
  return [
    `M ${cx} ${cy - 13}`,
    `C ${cx + 7} ${cy - 13}, ${cx + 12} ${cy - 8}, ${cx + 12} ${cy - 3}`,
    `C ${cx + 17} ${cy - 2}, ${cx + 20} ${cy + 4}, ${cx + 17} ${cy + 9}`,
    `C ${cx + 14} ${cy + 14}, ${cx + 7} ${cy + 15}, ${cx} ${cy + 13}`,
    `C ${cx - 7} ${cy + 15}, ${cx - 14} ${cy + 14}, ${cx - 17} ${cy + 9}`,
    `C ${cx - 20} ${cy + 4}, ${cx - 17} ${cy - 2}, ${cx - 12} ${cy - 3}`,
    `C ${cx - 12} ${cy - 8}, ${cx - 7} ${cy - 13}, ${cx} ${cy - 13}`,
    'Z',
  ].join(' ')
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
