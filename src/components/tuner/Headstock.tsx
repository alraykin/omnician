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

const VIEW_W = 300

type PegGeom = PegSlot & {
  postX: number
  postY: number
  buttonX: number
  buttonY: number
  nutX: number
  nutY: number
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
}

function layout(
  slots: PegSlot[],
  kind: HeadKind,
): Layout {
  const left = slots.filter((slot) => slot.side === 'left')
  const right = slots.filter((slot) => slot.side === 'right')
  const inline = slots.filter((slot) => slot.side === 'inline')
  const rows = Math.max(left.length, right.length, inline.length, 1)
  const rowGap = kind === 'inline' ? 36 : rows <= 2 ? 46 : rows <= 3 ? 42 : 36
  const crown = kind === 'scroll' ? 70 : kind === 'inline' ? 56 : 72
  const nutY = crown + Math.max(rows - 1, 0) * rowGap + (kind === 'scroll' ? 36 : 40)
  const height = nutY + 20
  const nutWidth = kind === 'inline' ? 64 : kind === 'small' ? 70 : 78
  const nutLeft = (VIEW_W - nutWidth) / 2
  const bodySlots = slots.filter((slot) => slot.side !== 'fifth')
  const maxNo = Math.max(...bodySlots.map((slot) => slot.string.stringNo), 1)
  const minNo = Math.min(...bodySlots.map((slot) => slot.string.stringNo), 1)
  const span = Math.max(1, maxNo - minNo)

  const pegs: PegGeom[] = slots.map((slot) => {
    const nutX = nutLeft + 9 + ((maxNo - slot.string.stringNo) / span) * (nutWidth - 18)
    if (slot.side === 'inline') {
      const postY = crown + slot.row * rowGap
      return {
        ...slot,
        postX: 108,
        postY,
        buttonX: 46,
        buttonY: postY,
        nutX,
        nutY,
      }
    }
    if (slot.side === 'fifth') {
      return {
        ...slot,
        postX: 96,
        postY: nutY - 16,
        buttonX: 44,
        buttonY: nutY - 8,
        nutX: nutLeft + 6,
        nutY,
      }
    }
    const postX = slot.side === 'left' ? 92 : VIEW_W - 92
    const buttonX = slot.side === 'left' ? 38 : VIEW_W - 38
    const postY = crown + slot.row * rowGap
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

  const logo =
    kind === 'inline'
      ? { x: 186, y: 46, r: 16 }
      : kind === 'scroll'
        ? { x: VIEW_W / 2, y: 36, r: 13 }
        : { x: VIEW_W / 2, y: 38, r: 17 }

  return {
    kind,
    height,
    nutY,
    nutLeft,
    nutWidth,
    pegs,
    logo,
    body: bodyPath(kind, nutY),
  }
}

function bodyPath(kind: HeadKind, nutY: number): string {
  const cx = VIEW_W / 2
  if (kind === 'inline') {
    return [
      `M 172 10`,
      `C 148 10 126 24 116 52`,
      `L 100 ${nutY - 16}`,
      `C 96 ${nutY + 2} 118 ${nutY + 11} 136 ${nutY + 11}`,
      `L 198 ${nutY + 11}`,
      `C 218 ${nutY + 10} 226 ${nutY - 2} 222 ${nutY - 16}`,
      `L 208 58`,
      `C 202 26 192 10 172 10`,
      'Z',
    ].join(' ')
  }
  if (kind === 'scroll') {
    return [
      `M ${cx + 8} 8`,
      `C ${cx + 28} 8 ${cx + 38} 22 ${cx + 34} 38`,
      `C ${cx + 30} 52 ${cx + 18} 58 ${cx + 18} 58`,
      `L ${cx + 40} ${nutY - 14}`,
      `C ${cx + 42} ${nutY + 2} ${cx + 22} ${nutY + 11} ${cx} ${nutY + 11}`,
      `L ${cx} ${nutY + 11}`,
      `C ${cx - 22} ${nutY + 11} ${cx - 42} ${nutY + 2} ${cx - 40} ${nutY - 14}`,
      `L ${cx - 18} 58`,
      `C ${cx - 18} 58 ${cx - 30} 52 ${cx - 34} 38`,
      `C ${cx - 38} 22 ${cx - 20} 8 ${cx + 8} 8`,
      'Z',
    ].join(' ')
  }
  const flare = kind === 'small' ? 52 : kind === 'banjo' ? 64 : 60
  const top = kind === 'small' ? 12 : 10
  return [
    `M ${cx} ${top}`,
    `C ${cx - 30} ${top} ${cx - 50} ${top + 10} ${cx - flare} ${top + 32}`,
    `C ${cx - flare - 10} ${top + 52} ${cx - flare - 12} 96 ${cx - flare - 14} 120`,
    `L ${cx - flare - 16} ${nutY - 16}`,
    `C ${cx - flare - 16} ${nutY} ${cx - 36} ${nutY + 11} ${cx - 30} ${nutY + 11}`,
    `L ${cx + 30} ${nutY + 11}`,
    `C ${cx + 36} ${nutY + 11} ${cx + flare + 16} ${nutY} ${cx + flare + 16} ${nutY - 16}`,
    `L ${cx + flare + 14} 120`,
    `C ${cx + flare + 12} 96 ${cx + flare + 10} ${top + 52} ${cx + flare} ${top + 32}`,
    `C ${cx + 50} ${top + 10} ${cx + 30} ${top} ${cx} ${top}`,
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
      <div className="mb-2 flex items-center justify-between gap-3">
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
          className="mx-auto block h-auto w-full"
          role="img"
          aria-label="Instrument headstock"
        >
          <defs>
            <linearGradient id="omni-wood" x1="0.15" y1="0" x2="0.9" y2="1">
              <stop offset="0%" stopColor="#2A3348" />
              <stop offset="48%" stopColor="#1A2233" />
              <stop offset="100%" stopColor="#121826" />
            </linearGradient>
            <linearGradient id="omni-brass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E6D3A6" />
              <stop offset="50%" stopColor="#C4A56A" />
              <stop offset="100%" stopColor="#8A6A3A" />
            </linearGradient>
          </defs>

          <path
            d={drawn.body}
            fill="url(#omni-wood)"
            stroke="url(#omni-brass)"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d={drawn.body}
            fill="none"
            stroke="rgba(168, 85, 247, 0.16)"
            strokeWidth="1"
          />

          <Medallion cx={drawn.logo.x} cy={drawn.logo.y} r={drawn.logo.r} />

          <rect
            x={drawn.nutLeft}
            y={drawn.nutY + 2}
            width={drawn.nutWidth}
            height="6"
            rx="1.2"
            fill="url(#omni-brass)"
          />
          {drawn.pegs
            .filter((peg) => peg.side !== 'fifth')
            .map((peg) => (
              <line
                key={`slot-${peg.string.id}`}
                x1={peg.nutX}
                y1={drawn.nutY + 2}
                x2={peg.nutX}
                y2={drawn.nutY + 8}
                stroke="#2A1E10"
                strokeWidth="0.9"
              />
            ))}

          {drawn.pegs.map((peg) => (
            <path
              key={`string-${peg.string.id}`}
              d={`M ${peg.nutX} ${drawn.nutY + 2} Q ${(peg.nutX + peg.postX) / 2} ${(drawn.nutY + peg.postY) / 2 + 4} ${peg.postX} ${peg.postY}`}
              fill="none"
              stroke="rgba(232, 220, 188, 0.38)"
              strokeWidth={0.9 + (peg.string.stringNo - 1) * 0.1}
              strokeLinecap="round"
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
        Tap a peg to hear its pitch and set the target. Red is the active string;
        green stays until that string is played clearly out of tune.
      </p>
    </div>
  )
}

/** Official O + pick, geometrically centered in a light medallion. */
function Medallion({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const s = r / 12
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={r} fill="#F4F0E6" />
      <circle r={r - 0.4} fill="none" stroke="#1A1D27" strokeWidth="0.7" />
      <g transform={`scale(${s})`} fill="none" stroke="#14161F" strokeLinecap="round">
        <circle r="8.2" strokeWidth="1.85" />
        <path
          d="M 0 -3.1 C 2.55 -3.1 3.55 -0.7 3.05 1.85 C 2.35 4.35 0 5.55 0 5.55 C 0 5.55 -2.35 4.35 -3.05 1.85 C -3.55 -0.7 -2.55 -3.1 0 -3.1 Z"
          strokeWidth="1.55"
        />
        <path d="M -1.55 -0.15 L 0 -1.7 L 1.55 -0.15" strokeWidth="1.35" />
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
  const side = peg.side === 'right' ? 1 : -1
  const buttonFill =
    tone === 'green' ? '#34d399' : tone === 'red' ? '#ef4444' : '#EDE4D0'
  const ring =
    tone === 'green' ? '#a7f3d0' : tone === 'red' ? '#fca5a5' : '#C4A56A'
  const glow =
    tone === 'green'
      ? 'rgba(52,211,153,0.45)'
      : tone === 'red'
        ? 'rgba(239,68,68,0.4)'
        : 'transparent'
  const labelX = peg.buttonX + side * 18
  const housingX = side < 0 ? peg.postX - 15 : peg.postX + 2

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
    >
      <line
        x1={peg.buttonX}
        y1={peg.buttonY}
        x2={peg.postX}
        y2={peg.postY}
        stroke="url(#omni-brass)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <rect
        x={housingX}
        y={peg.postY - 4.2}
        width="13"
        height="8.4"
        rx="1.6"
        fill="url(#omni-brass)"
      />
      <circle cx={peg.postX} cy={peg.postY} r="5.6" fill="url(#omni-brass)" />
      <circle cx={peg.postX} cy={peg.postY} r="2.4" fill="#14161F" />
      <circle cx={peg.buttonX} cy={peg.buttonY} r="11" fill={glow} />
      <ellipse
        cx={peg.buttonX}
        cy={peg.buttonY}
        rx="8.2"
        ry="10.4"
        fill={buttonFill}
        stroke={ring}
        strokeWidth="1.6"
      />
      <ellipse
        cx={peg.buttonX - 1.6}
        cy={peg.buttonY - 2.6}
        rx="3.1"
        ry="4.2"
        fill="rgba(255,255,255,0.28)"
      />
      <text
        x={labelX}
        y={peg.buttonY - 2}
        textAnchor="middle"
        fill="#F8FAFC"
        fontSize="11"
        fontWeight="700"
        fontFamily="Outfit, sans-serif"
      >
        {peg.string.label}
      </text>
      <text
        x={labelX}
        y={peg.buttonY + 10}
        textAnchor="middle"
        fill="#94A3B8"
        fontSize="8.5"
        fontWeight="600"
        fontFamily="Outfit, sans-serif"
      >
        {peg.side === 'fifth' ? '5th' : `${peg.string.stringNo}`}
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
