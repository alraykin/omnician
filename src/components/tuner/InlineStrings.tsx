import { pegLetter } from '@/lib/headstock'
import { inlineStringsForView } from '@/lib/inline-layout'
import type { InstrumentString } from '@/lib/notes'
import {
  PEG_GREEN,
  PEG_INK,
  PEG_LAVENDER,
  PEG_WHITE,
  pegActiveColor,
  pegColors,
  pegTone,
  type PegTone,
} from '@/lib/peg-style'
import { cn } from '@/lib/utils'

const VIEW_W = 480

type InlineStringsProps = {
  strings: readonly InstrumentString[]
  selectedId: string | null
  tunedIds: ReadonlySet<string>
  inTune: boolean
  live: boolean
  onTapPeg: (string: InstrumentString) => void
}

function metrics(count: number) {
  if (count <= 4) return { r: 20, post: 7.2, gap: 20, padX: 36 }
  if (count <= 6) return { r: 17, post: 6.6, gap: 18, padX: 28 }
  if (count <= 8) return { r: 14.5, post: 5.8, gap: 16, padX: 20 }
  return { r: 12.2, post: 5.2, gap: 14, padX: 14 }
}

export function InlineStrings({
  strings,
  selectedId,
  tunedIds,
  inTune,
  live,
  onTapPeg,
}: InlineStringsProps) {
  const ordered = inlineStringsForView(strings)
  const count = ordered.length
  if (count === 0) return null

  const m = metrics(count)
  const postY = m.post + 10
  const buttonY = postY + m.gap + m.r
  const labelY = buttonY + m.r + 16
  const height = labelY + 14
  const span = Math.max(1, count - 1)
  const inner = VIEW_W - m.padX * 2

  return (
    <div id="inline-strings" data-inline-row className="relative mx-auto w-full">
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        className="mx-auto block h-auto w-full"
        role="img"
        aria-label="Inline string tuners"
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
        </defs>

        <line
          x1={m.padX - 8}
          y1={postY}
          x2={VIEW_W - m.padX + 8}
          y2={postY}
          stroke={PEG_LAVENDER}
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.55"
        />

        {ordered.map((string, index) => {
          const x = count === 1 ? VIEW_W / 2 : m.padX + (index / span) * inner
          const tone = pegTone(string.id, selectedId, tunedIds, inTune, live)
          const letter = pegLetter(string, strings)
          return (
            <InlinePeg
              key={string.id}
              x={x}
              postY={postY}
              buttonY={buttonY}
              labelY={labelY}
              r={m.r}
              postR={m.post}
              letter={letter}
              note={`${string.label}${string.octave}`}
              tone={tone}
              string={string}
              onClick={() => onTapPeg(string)}
            />
          )
        })}
      </svg>
    </div>
  )
}

function InlinePeg({
  x,
  postY,
  buttonY,
  labelY,
  r,
  postR,
  letter,
  note,
  tone,
  string,
  onClick,
}: {
  x: number
  postY: number
  buttonY: number
  labelY: number
  r: number
  postR: number
  letter: string
  note: string
  tone: PegTone
  string: InstrumentString
  onClick: () => void
}) {
  const { fill, stroke, text } = pegColors(tone)
  const glow = tone === 'red' || tone === 'green' || tone === 'selected'
  const lit = tone !== 'idle'
  const shaftW = Math.max(5.2, r * 0.34)
  const active = pegActiveColor(tone)
  const shaftColor = active ?? stroke

  return (
    <g
      role="button"
      tabIndex={0}
      data-inline-string={string.id}
      aria-label={`String ${string.stringNo}, ${letter}${tone === 'green' || tone === 'sticky' ? ', in tune' : ''}`}
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
      <line
        x1={x}
        y1={postY}
        x2={x}
        y2={buttonY - r + 1}
        stroke={shaftColor}
        strokeWidth={lit ? 2.6 : 2.1}
        strokeLinecap="round"
      />
      {lit ? (
        <circle cx={x} cy={postY} r={postR + 3.6} fill={stroke} opacity="0.22" />
      ) : null}
      <circle
        cx={x}
        cy={postY}
        r={postR}
        fill={PEG_INK}
        stroke={stroke}
        strokeWidth={lit ? 2.5 : 2.05}
      />
      <circle
        cx={x}
        cy={postY}
        r={postR * 0.42}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
      />
      <rect
        x={x - shaftW / 2}
        y={postY + postR * 0.55}
        width={shaftW}
        height={Math.max(6, buttonY - r - postY - postR * 0.4)}
        rx={1.8}
        fill={fill}
        stroke={stroke}
        strokeWidth="2.1"
      />
      <circle
        cx={x}
        cy={buttonY}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth="2.35"
      />
      <text
        x={x}
        y={buttonY + (letter.length > 1 ? 4.2 : 5.2)}
        textAnchor="middle"
        fill={text}
        fontSize={letter.length > 1 ? (r < 14 ? 10 : 11.5) : r < 14 ? 13.5 : 15.5}
        fontWeight="700"
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
      >
        {letter}
      </text>
      <text
        x={x}
        y={labelY}
        textAnchor="middle"
        fill={tone === 'green' || tone === 'sticky' ? PEG_GREEN : PEG_WHITE}
        opacity={tone === 'idle' ? 0.72 : 1}
        fontSize={note.length > 3 ? 10 : 11.5}
        fontWeight="600"
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
      >
        {note}
      </text>
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
