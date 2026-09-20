import { layoutPegs, type PegSlot } from '@/lib/headstock'
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

const VIEW_W = 280

type PegGeom = PegSlot & {
  postX: number
  postY: number
  buttonX: number
  buttonY: number
  nutX: number
  nutY: number
}

function geometry(
  slots: PegSlot[],
  rows: number,
): { height: number; nutY: number; pegs: PegGeom[]; nutLeft: number; nutWidth: number } {
  const top = 64
  const rowGap = rows <= 2 ? 52 : rows <= 3 ? 48 : 42
  const nutY = top + Math.max(rows - 1, 0) * rowGap + 46
  const height = nutY + 22
  const bodyLeft = 62
  const bodyRight = VIEW_W - 62
  const postInset = 20
  const buttonOut = 26
  const nutWidth = 78
  const nutLeft = (VIEW_W - nutWidth) / 2

  const body = slots.filter((slot) => slot.side !== 'fifth')
  const maxNo = Math.max(...body.map((slot) => slot.string.stringNo), 1)
  const minNo = Math.min(...body.map((slot) => slot.string.stringNo), 1)
  const span = Math.max(1, maxNo - minNo)

  const pegs: PegGeom[] = slots.map((slot) => {
    if (slot.side === 'fifth') {
      return {
        ...slot,
        postX: bodyLeft + 18,
        postY: nutY - 18,
        buttonX: buttonOut + 4,
        buttonY: nutY - 10,
        nutX: nutLeft + 6,
        nutY,
      }
    }
    const postX = slot.side === 'left' ? bodyLeft + postInset : bodyRight - postInset
    const buttonX = slot.side === 'left' ? buttonOut : VIEW_W - buttonOut
    const postY = top + slot.row * rowGap
    const t = span === 0 ? 0.5 : (maxNo - slot.string.stringNo) / span
    return {
      ...slot,
      postX,
      postY,
      buttonX,
      buttonY: postY,
      nutX: nutLeft + 8 + t * (nutWidth - 16),
      nutY,
    }
  })

  return { height, nutY, pegs, nutLeft, nutWidth }
}

function bodyPath(nutY: number): string {
  const top = 10
  const shoulder = 50
  const waist = nutY - 10
  return [
    `M ${VIEW_W / 2 - 34} ${top}`,
    `C 86 ${top} 64 20 58 ${shoulder}`,
    `L 54 ${waist}`,
    `C 54 ${nutY - 2} 86 ${nutY + 8} ${VIEW_W / 2 - 40} ${nutY + 10}`,
    `L ${VIEW_W / 2 + 40} ${nutY + 10}`,
    `C ${VIEW_W - 86} ${nutY + 8} ${VIEW_W - 54} ${nutY - 2} ${VIEW_W - 54} ${waist}`,
    `L ${VIEW_W - 58} ${shoulder}`,
    `C ${VIEW_W - 64} 20 ${VIEW_W - 86} ${top} ${VIEW_W / 2 + 34} ${top}`,
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
  const slots = layoutPegs(strings, config)
  const left = slots.filter((slot) => slot.side === 'left')
  const right = slots.filter((slot) => slot.side === 'right')
  const rows = Math.max(left.length, right.length, 1)
  const { height, nutY, pegs, nutLeft, nutWidth } = geometry(slots, rows)

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
          viewBox={`0 0 ${VIEW_W} ${height}`}
          className="mx-auto block h-auto w-full"
          role="img"
          aria-label="Instrument headstock"
        >
          <defs>
            <linearGradient id="omni-wood" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#243044" />
              <stop offset="45%" stopColor="#1A2233" />
              <stop offset="100%" stopColor="#141A28" />
            </linearGradient>
            <linearGradient id="omni-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8D5A3" />
              <stop offset="55%" stopColor="#C9A36A" />
              <stop offset="100%" stopColor="#8B6B3D" />
            </linearGradient>
            <linearGradient id="omni-metal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F3E6C4" />
              <stop offset="100%" stopColor="#A4844C" />
            </linearGradient>
            <filter id="omni-invert" colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"
              />
            </filter>
          </defs>

          <circle cx={VIEW_W / 2} cy="32" r="17.5" fill="#ffffff" />
          <circle
            cx={VIEW_W / 2}
            cy="32"
            r="17.5"
            fill="none"
            stroke="#C9A36A"
            strokeWidth="1.4"
          />
          <image
            href="/omnician-mark.png"
            x={VIEW_W / 2 - 12.5}
            y="19.5"
            width="25"
            height="25"
            filter="url(#omni-invert)"
          />

          <path
            d={bodyPath(nutY)}
            fill="url(#omni-wood)"
            stroke="url(#omni-gold)"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          <path
            d={bodyPath(nutY)}
            fill="none"
            stroke="rgba(168, 85, 247, 0.22)"
            strokeWidth="1.1"
          />

          <rect
            x={nutLeft}
            y={nutY + 2}
            width={nutWidth}
            height="7"
            rx="1.4"
            fill="url(#omni-gold)"
          />
          {pegs
            .filter((peg) => peg.side !== 'fifth')
            .map((peg) => (
              <line
                key={`slot-${peg.string.id}`}
                x1={peg.nutX}
                y1={nutY + 2}
                x2={peg.nutX}
                y2={nutY + 9}
                stroke="#3B2A14"
                strokeWidth="1"
              />
            ))}

          {pegs.map((peg) => (
            <line
              key={`string-${peg.string.id}`}
              x1={peg.nutX}
              y1={nutY + 2}
              x2={peg.postX}
              y2={peg.postY}
              stroke="rgba(226, 214, 180, 0.42)"
              strokeWidth={1.1 + (peg.string.stringNo - 1) * 0.12}
              strokeLinecap="round"
            />
          ))}

          {pegs.map((peg) => {
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
        green stays until that string is played out of tune.
      </p>
    </div>
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
  const outward = peg.side === 'right' || peg.side === 'fifth' ? 1 : -1
  const buttonFill =
    tone === 'green' ? '#34d399' : tone === 'red' ? '#ef4444' : '#E8D5B0'
  const ring =
    tone === 'green' ? '#a7f3d0' : tone === 'red' ? '#fca5a5' : '#C9A36A'
  const glow =
    tone === 'green'
      ? 'rgba(52,211,153,0.55)'
      : tone === 'red'
        ? 'rgba(239,68,68,0.5)'
        : 'transparent'
  const labelX = peg.buttonX + outward * 16
  const fifth = peg.side === 'fifth'

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
        stroke="#8B6B3D"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <rect
        x={peg.side === 'left' ? peg.postX - 18 : peg.postX + 4}
        y={peg.postY - 5}
        width="14"
        height="10"
        rx="2"
        fill="url(#omni-metal)"
      />
      <circle cx={peg.postX} cy={peg.postY} r="7.2" fill="url(#omni-metal)" />
      <circle cx={peg.postX} cy={peg.postY} r="3.1" fill="#1A1520" />
      <circle
        cx={peg.buttonX}
        cy={peg.buttonY}
        r="12.5"
        fill={glow}
        opacity={tone === 'idle' ? 0 : 0.9}
      />
      <ellipse
        cx={peg.buttonX}
        cy={peg.buttonY}
        rx="10.5"
        ry="13"
        fill={buttonFill}
        stroke={ring}
        strokeWidth="2"
      />
      <ellipse
        cx={peg.buttonX - 2}
        cy={peg.buttonY - 3}
        rx="4.2"
        ry="5"
        fill="rgba(255,255,255,0.28)"
      />
      <text
        x={labelX}
        y={peg.buttonY - 3}
        textAnchor="middle"
        fill="white"
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
        fill="#cbd5e1"
        fontSize="9"
        fontWeight="600"
        fontFamily="Outfit, sans-serif"
      >
        {fifth ? '5th' : `${peg.string.stringNo}`}
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
