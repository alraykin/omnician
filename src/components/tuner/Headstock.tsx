import { headKindFor, layoutPegs, type HeadKind, type PegSlot } from '@/lib/headstock'
import type { InstrumentString } from '@/lib/notes'
import type { InstrumentId } from '@/lib/presets'
import { cn } from '@/lib/utils'

type HeadstockProps = {
  strings: readonly InstrumentString[]
  config: InstrumentId
  selectedId: string | null
  tunedIds: ReadonlySet<string>
  autoString: boolean
  onAutoChange: (value: boolean) => void
  onTapPeg: (string: InstrumentString) => void
}

const VIEW_W = 340
const NECK_H = 58

type PegGeom = PegSlot & {
  postX: number
  postY: number
  buttonX: number
  buttonY: number
  nutX: number
  nutY: number
  chipX: number
  chipY: number
}

type Layout = {
  kind: HeadKind
  height: number
  nutY: number
  nutLeft: number
  nutWidth: number
  pegs: PegGeom[]
  logo: { x: number; y: number; r: number }
  body: string
  neck: { x: number; y: number; w: number; h: number; boardX: number; boardW: number }
}

function layout(slots: PegSlot[], kind: HeadKind): Layout {
  const left = slots.filter((slot) => slot.side === 'left')
  const right = slots.filter((slot) => slot.side === 'right')
  const inline = slots.filter((slot) => slot.side === 'inline')
  const rows = Math.max(left.length, right.length, inline.length, 1)
  const rowGap = kind === 'inline' ? 38 : rows <= 2 ? 50 : rows <= 3 ? 44 : 36
  const crown = kind === 'scroll' ? 64 : kind === 'inline' ? 52 : kind === 'crown' ? 62 : 70
  const nutY = crown + Math.max(rows - 1, 0) * rowGap + 38
  const height = nutY + 10 + NECK_H
  const nutWidth = kind === 'inline' ? 58 : kind === 'crown' ? 72 : 82
  const nutLeft = (VIEW_W - nutWidth) / 2
  const bodySlots = slots.filter((slot) => slot.side !== 'fifth')
  const maxNo = Math.max(...bodySlots.map((slot) => slot.string.stringNo), 1)
  const minNo = Math.min(...bodySlots.map((slot) => slot.string.stringNo), 1)
  const span = Math.max(1, maxNo - minNo)

  const pegs: PegGeom[] = slots.map((slot) => {
    const nutX = nutLeft + 8 + ((maxNo - slot.string.stringNo) / span) * (nutWidth - 16)
    if (slot.side === 'inline') {
      const postY = crown + slot.row * rowGap
      return {
        ...slot,
        postX: 128,
        postY,
        buttonX: 58,
        buttonY: postY,
        chipX: 28,
        chipY: postY,
        nutX,
        nutY,
      }
    }
    if (slot.side === 'fifth') {
      return {
        ...slot,
        postX: 112,
        postY: nutY - 14,
        buttonX: 58,
        buttonY: nutY - 6,
        chipX: 28,
        chipY: nutY - 6,
        nutX: nutLeft + 6,
        nutY,
      }
    }
    const leftSide = slot.side === 'left'
    const postX = leftSide ? 118 : VIEW_W - 118
    const buttonX = leftSide ? 58 : VIEW_W - 58
    const chipX = leftSide ? 26 : VIEW_W - 26
    const postY = crown + slot.row * rowGap
    return {
      ...slot,
      postX,
      postY,
      buttonX,
      buttonY: postY,
      chipX,
      chipY: postY,
      nutX,
      nutY,
    }
  })

  const logo =
    kind === 'inline'
      ? { x: 210, y: 44, r: 11 }
      : kind === 'scroll'
        ? { x: VIEW_W / 2, y: 28, r: 9 }
        : { x: VIEW_W / 2, y: kind === 'crown' ? 32 : 34, r: 11 }

  const boardW = nutWidth - 6
  return {
    kind,
    height,
    nutY,
    nutLeft,
    nutWidth,
    pegs,
    logo,
    body: bodyPath(kind, nutY),
    neck: {
      x: nutLeft - 7,
      y: nutY + 7,
      w: nutWidth + 14,
      h: NECK_H,
      boardX: (VIEW_W - boardW) / 2,
      boardW,
    },
  }
}

function bodyPath(kind: HeadKind, nutY: number): string {
  const cx = VIEW_W / 2
  if (kind === 'crown') {
    return [
      `M ${cx} 8`,
      `C ${cx - 14} 10 ${cx - 28} 8 ${cx - 42} 22`,
      `C ${cx - 62} 38 ${cx - 74} 58 ${cx - 76} 86`,
      `L ${cx - 74} ${nutY - 6}`,
      `C ${cx - 72} ${nutY + 4} ${cx - 36} ${nutY + 8} ${cx - 28} ${nutY + 8}`,
      `L ${cx + 28} ${nutY + 8}`,
      `C ${cx + 36} ${nutY + 8} ${cx + 72} ${nutY + 4} ${cx + 74} ${nutY - 6}`,
      `L ${cx + 76} 86`,
      `C ${cx + 74} 58 ${cx + 62} 38 ${cx + 42} 22`,
      `C ${cx + 28} 8 ${cx + 14} 10 ${cx} 8`,
      'Z',
    ].join(' ')
  }
  if (kind === 'inline') {
    return [
      `M 198 10`,
      `C 168 8 142 22 130 54`,
      `L 118 ${nutY - 8}`,
      `C 116 ${nutY + 4} 136 ${nutY + 8} 152 ${nutY + 8}`,
      `L 214 ${nutY + 8}`,
      `C 232 ${nutY + 6} 240 ${nutY - 4} 236 ${nutY - 16}`,
      `L 228 52`,
      `C 222 24 216 10 198 10`,
      'Z',
    ].join(' ')
  }
  if (kind === 'scroll') {
    return [
      `M ${cx + 10} 6`,
      `C ${cx + 32} 8 ${cx + 40} 26 ${cx + 32} 40`,
      `C ${cx + 26} 50 ${cx + 16} 54 ${cx + 16} 54`,
      `L ${cx + 42} ${nutY - 8}`,
      `C ${cx + 44} ${nutY + 4} ${cx + 20} ${nutY + 8} ${cx} ${nutY + 8}`,
      `C ${cx - 20} ${nutY + 8} ${cx - 44} ${nutY + 4} ${cx - 42} ${nutY - 8}`,
      `L ${cx - 16} 54`,
      `C ${cx - 16} 54 ${cx - 26} 50 ${cx - 32} 40`,
      `C ${cx - 36} 22 ${cx - 16} 6 ${cx + 10} 6`,
      'Z',
    ].join(' ')
  }
  const flare = kind === 'banjo' ? 78 : 72
  return [
    `M ${cx} 10`,
    `C ${cx - 36} 10 ${cx - 58} 22 ${cx - flare} 48`,
    `C ${cx - flare - 8} 70 ${cx - flare - 10} 100 ${cx - flare - 8} 128`,
    `L ${cx - flare - 6} ${nutY - 8}`,
    `C ${cx - flare - 4} ${nutY + 4} ${cx - 40} ${nutY + 8} ${cx - 32} ${nutY + 8}`,
    `L ${cx + 32} ${nutY + 8}`,
    `C ${cx + 40} ${nutY + 8} ${cx + flare + 4} ${nutY + 4} ${cx + flare + 6} ${nutY - 8}`,
    `L ${cx + flare + 8} 128`,
    `C ${cx + flare + 10} 100 ${cx + flare + 8} 70 ${cx + flare} 48`,
    `C ${cx + 58} 22 ${cx + 36} 10 ${cx} 10`,
    'Z',
  ].join(' ')
}

export function Headstock({
  strings,
  config,
  selectedId,
  tunedIds,
  autoString,
  onAutoChange,
  onTapPeg,
}: HeadstockProps) {
  const kind = headKindFor(config)
  const slots = layoutPegs(strings, config)
  const drawn = layout(slots, kind)

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

      <div className="relative mx-auto w-full max-w-sm">
        <svg
          viewBox={`0 0 ${VIEW_W} ${drawn.height}`}
          className="mx-auto block h-auto w-full drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)]"
          role="img"
          aria-label="Instrument headstock"
        >
          <Defs />

          <ellipse
            cx={VIEW_W / 2}
            cy={drawn.height - 8}
            rx={drawn.neck.w * 0.55}
            ry="10"
            fill="rgba(0,0,0,0.35)"
          />

          <rect
            x={drawn.neck.x}
            y={drawn.neck.y}
            width={drawn.neck.w}
            height={drawn.neck.h}
            rx="3"
            fill="url(#omni-maple)"
            filter="url(#omni-grain)"
          />
          <rect
            x={drawn.neck.boardX}
            y={drawn.nutY + 8}
            width={drawn.neck.boardW}
            height={drawn.neck.h - 2}
            fill="url(#omni-ebony)"
          />
          {[18, 36].map((offset) => (
            <rect
              key={offset}
              x={drawn.neck.boardX}
              y={drawn.nutY + 8 + offset}
              width={drawn.neck.boardW}
              height="1.4"
              fill="#c9b48a"
              opacity="0.55"
            />
          ))}

          <path
            d={drawn.body}
            fill="url(#omni-maple)"
            filter="url(#omni-grain)"
          />
          <path
            d={drawn.body}
            fill="url(#omni-wood-light)"
            opacity="0.35"
          />
          <path
            d={drawn.body}
            fill="none"
            stroke="#6b4424"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          <WoodMark cx={drawn.logo.x} cy={drawn.logo.y} r={drawn.logo.r} />

          <rect
            x={drawn.nutLeft}
            y={drawn.nutY + 1}
            width={drawn.nutWidth}
            height="8"
            rx="1.2"
            fill="url(#omni-bone)"
            stroke="#c8b48a"
            strokeWidth="0.6"
          />

          {drawn.pegs.map((peg) => (
            <path
              key={`string-${peg.string.id}`}
              d={`M ${peg.postX} ${peg.postY} C ${peg.postX} ${(peg.postY + peg.nutY) / 2} ${peg.nutX} ${peg.nutY - 8} ${peg.nutX} ${peg.nutY + 5}`}
              fill="none"
              stroke="url(#omni-string)"
              strokeWidth={1.05 + (peg.string.stringNo - 1) * 0.18}
              strokeLinecap="round"
            />
          ))}
          {drawn.pegs
            .filter((peg) => peg.side !== 'fifth')
            .map((peg) => (
              <line
                key={`board-${peg.string.id}`}
                x1={peg.nutX}
                y1={drawn.nutY + 9}
                x2={peg.nutX}
                y2={drawn.height - 4}
                stroke="#d7d2c8"
                strokeWidth={0.85 + (peg.string.stringNo - 1) * 0.12}
                opacity="0.85"
              />
            ))}

          {drawn.pegs.map((peg) => {
            const tone = tunedIds.has(peg.string.id)
              ? 'green'
              : peg.string.id === selectedId
                ? 'red'
                : 'idle'
            return (
              <MachineHead
                key={peg.string.id}
                peg={peg}
                tone={tone}
                onClick={() => onTapPeg(peg.string)}
              />
            )
          })}
        </svg>
      </div>
      <p className="mt-2 text-center text-[0.65rem] leading-4 text-slate-500">
        Tap a note to hear its pitch and set the target. Red is the active string;
        green stays until that string is played clearly out of tune.
      </p>
    </div>
  )
}

function Defs() {
  return (
    <defs>
      <linearGradient id="omni-maple" x1="0.2" y1="0" x2="0.9" y2="1">
        <stop offset="0%" stopColor="#E8C399" />
        <stop offset="38%" stopColor="#D2A06A" />
        <stop offset="72%" stopColor="#C48A52" />
        <stop offset="100%" stopColor="#A86B3A" />
      </linearGradient>
      <linearGradient id="omni-wood-light" x1="0" y1="0" x2="1" y2="0.2">
        <stop offset="0%" stopColor="#fff6e8" stopOpacity="0.55" />
        <stop offset="45%" stopColor="#fff6e8" stopOpacity="0" />
        <stop offset="100%" stopColor="#5a3418" stopOpacity="0.18" />
      </linearGradient>
      <linearGradient id="omni-ebony" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2A2420" />
        <stop offset="100%" stopColor="#12100E" />
      </linearGradient>
      <linearGradient id="omni-bone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F7F1E1" />
        <stop offset="100%" stopColor="#D9CBA8" />
      </linearGradient>
      <linearGradient id="omni-string" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F3F0EA" />
        <stop offset="100%" stopColor="#9A958C" />
      </linearGradient>
      <radialGradient id="omni-chrome" cx="32%" cy="28%" r="75%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="28%" stopColor="#E2E6EE" />
        <stop offset="62%" stopColor="#9AA3B0" />
        <stop offset="100%" stopColor="#4A5160" />
      </radialGradient>
      <linearGradient id="omni-chrome-bar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F5F7FA" />
        <stop offset="45%" stopColor="#B8C0CC" />
        <stop offset="100%" stopColor="#5C6573" />
      </linearGradient>
      <filter id="omni-grain" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.035 0.55"
          numOctaves="4"
          seed="4"
          result="noise"
        />
        <feColorMatrix
          in="noise"
          type="matrix"
          values="0 0 0 0 0.55  0 0 0 0 0.32  0 0 0 0 0.14  0 0 0 0.42 0"
          result="grain"
        />
        <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
      </filter>
      <filter id="omni-soft" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="#000" floodOpacity="0.35" />
      </filter>
    </defs>
  )
}

function WoodMark({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const s = r / 12
  return (
    <g transform={`translate(${cx} ${cy})`} opacity="0.72">
      <g
        transform={`scale(${s})`}
        fill="none"
        stroke="#3B2414"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle r="8.15" strokeWidth="1.7" />
        <path
          d="M 0 -3.05 C 2.5 -3.05 3.45 -0.65 3 1.8 C 2.3 4.25 0 5.4 0 5.4 C 0 5.4 -2.3 4.25 -3 1.8 C -3.45 -0.65 -2.5 -3.05 0 -3.05 Z"
          strokeWidth="1.45"
        />
        <path d="M -1.5 -0.1 L 0 -1.65 L 1.5 -0.1" strokeWidth="1.25" />
      </g>
    </g>
  )
}

function MachineHead({
  peg,
  tone,
  onClick,
}: {
  peg: PegGeom
  tone: 'green' | 'red' | 'idle'
  onClick: () => void
}) {
  const towardPost = peg.side === 'right' ? -1 : 1
  const shaftX2 = peg.postX - towardPost * 6

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`String ${peg.string.stringNo}, ${peg.string.label}${peg.string.octave}${tone === 'green' ? ', in tune' : ''}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      className="cursor-pointer"
      filter="url(#omni-soft)"
    >
      <line
        x1={peg.buttonX}
        y1={peg.buttonY}
        x2={shaftX2}
        y2={peg.postY}
        stroke="url(#omni-chrome-bar)"
        strokeWidth="4.4"
        strokeLinecap="round"
      />
      <rect
        x={peg.side === 'right' ? peg.postX + 1 : peg.postX - 14}
        y={peg.postY - 5}
        width="13"
        height="10"
        rx="2"
        fill="url(#omni-chrome-bar)"
      />
      <circle cx={peg.postX} cy={peg.postY} r="6.4" fill="url(#omni-chrome)" />
      <circle cx={peg.postX} cy={peg.postY} r="3.4" fill="#1A1C22" />
      <circle cx={peg.postX - 1.2} cy={peg.postY - 1.4} r="1.1" fill="rgba(255,255,255,0.35)" />

      <ellipse
        cx={peg.buttonX + 1}
        cy={peg.buttonY + 3}
        rx="11"
        ry="5"
        fill="rgba(0,0,0,0.28)"
      />
      <ellipse
        cx={peg.buttonX}
        cy={peg.buttonY}
        rx="12.2"
        ry="13.6"
        fill="url(#omni-chrome)"
        stroke="#6d7380"
        strokeWidth="0.7"
      />
      <ellipse
        cx={peg.buttonX}
        cy={peg.buttonY}
        rx="8.4"
        ry="9.4"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1.1"
      />
      <ellipse
        cx={peg.buttonX - 3.4}
        cy={peg.buttonY - 4.2}
        rx="4.6"
        ry="3.4"
        fill="rgba(255,255,255,0.55)"
      />
      <circle cx={peg.buttonX} cy={peg.buttonY + 0.6} r="2.1" fill="#5a6270" />
      <circle cx={peg.buttonX - 0.5} cy={peg.buttonY} r="0.8" fill="#d7dce6" />

      <NoteChip x={peg.chipX} y={peg.chipY} label={peg.string.label} tone={tone} />
    </g>
  )
}

function NoteChip({
  x,
  y,
  label,
  tone,
}: {
  x: number
  y: number
  label: string
  tone: 'green' | 'red' | 'idle'
}) {
  const fill =
    tone === 'green' ? '#22c55e' : tone === 'red' ? '#ef4444' : 'transparent'
  const ring =
    tone === 'green' ? '#86efac' : tone === 'red' ? '#fca5a5' : 'transparent'
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r="13"
        fill={fill}
        stroke={ring}
        strokeWidth={tone === 'idle' ? 0 : 1.6}
      />
      <text
        x={x}
        y={y + 4.2}
        textAnchor="middle"
        fill={tone === 'idle' ? '#F8FAFC' : '#0B1020'}
        fontSize="13"
        fontWeight="700"
        fontFamily="Outfit, sans-serif"
      >
        {label}
      </text>
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
