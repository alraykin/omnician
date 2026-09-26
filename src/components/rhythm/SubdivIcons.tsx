import type { SubdivisionId } from '@/lib/rhythm'

type NoteSpec = {
  kind: 'notes'
  count: number
  beams: 0 | 1 | 2
}

type BracketSpec = {
  kind: 'bracket'
  tuplet: 5 | 6 | 7
}

const ICONS: Record<Exclude<SubdivisionId, 3>, NoteSpec | BracketSpec> = {
  1: { kind: 'notes', count: 1, beams: 0 },
  2: { kind: 'notes', count: 2, beams: 1 },
  4: { kind: 'notes', count: 4, beams: 2 },
  5: { kind: 'bracket', tuplet: 5 },
  6: { kind: 'bracket', tuplet: 6 },
  7: { kind: 'bracket', tuplet: 7 },
}

function noteXs(count: number): number[] {
  if (count === 1) return [28]
  if (count === 2) return [17, 39]
  return [8.5, 21.5, 34.5, 47.5]
}

function BracketOnly({ n }: { n: 5 | 6 | 7 }) {
  return (
    <>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 10 29 V 11 H 19" />
        <path d="M 46 29 V 11 H 37" />
      </g>
      <text
        x="28"
        y="22.5"
        textAnchor="middle"
        fill="currentColor"
        fontSize="15.5"
        fontWeight="700"
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
      >
        {n}
      </text>
    </>
  )
}

function NoteGroup({ spec }: { spec: NoteSpec }) {
  const xs = noteXs(spec.count)
  const headY = 28
  const stemTop = 9.2
  const stemX = (x: number) => x + 4.55
  const first = stemX(xs[0])
  const last = stemX(xs[xs.length - 1])

  return (
    <>
      {xs.map((x) => (
        <g key={x} fill="currentColor">
          <ellipse cx={x} cy={headY} rx="5.15" ry="3.45" transform={`rotate(-22 ${x} ${headY})`} />
          <rect x={stemX(x) - 0.7} y={stemTop} width="1.4" height={headY - stemTop - 1.1} rx="0.6" />
        </g>
      ))}
      {spec.beams >= 1 ? (
        <rect
          x={first - 0.4}
          y={stemTop}
          width={last - first + 0.8}
          height="2.55"
          rx="0.7"
          fill="currentColor"
        />
      ) : null}
      {spec.beams >= 2 ? (
        <rect
          x={first - 0.4}
          y={stemTop + 3.7}
          width={last - first + 0.8}
          height="2.15"
          rx="0.6"
          fill="currentColor"
        />
      ) : null}
    </>
  )
}

/** Three beamed eighths with a 3-bracket — eighth-note triplets. */
function EighthTriplets() {
  const xs = [12, 28, 44]
  const headY = 32
  const stemTop = 14.5
  const stemX = (x: number) => x + 4.5
  const first = stemX(xs[0])
  const last = stemX(xs[xs.length - 1])
  const mid = (first + last) / 2

  return (
    <>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={`M ${first} 12.2 V 4.6 H ${mid - 6.4}`} />
        <path d={`M ${last} 12.2 V 4.6 H ${mid + 6.4}`} />
      </g>
      <text
        x={mid}
        y="10.4"
        textAnchor="middle"
        fill="currentColor"
        fontSize="10"
        fontWeight="700"
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
      >
        3
      </text>
      {xs.map((x) => (
        <g key={x} fill="currentColor">
          <ellipse cx={x} cy={headY} rx="4.9" ry="3.25" transform={`rotate(-22 ${x} ${headY})`} />
          <rect x={stemX(x) - 0.7} y={stemTop} width="1.4" height={headY - stemTop - 1} rx="0.6" />
        </g>
      ))}
      <rect
        x={first - 0.4}
        y={stemTop}
        width={last - first + 0.8}
        height="2.55"
        rx="0.7"
        fill="currentColor"
      />
    </>
  )
}

export function SubdivIcon({
  steps,
  className,
  compact = false,
}: {
  steps: SubdivisionId
  className?: string
  compact?: boolean
}) {
  const spec = steps === 3 ? null : ICONS[steps]
  return (
    <svg
      viewBox="0 0 56 40"
      className={className}
      width={compact ? 28 : 48}
      height={compact ? 20 : 34}
      aria-hidden
    >
      {steps === 3 ? (
        <EighthTriplets />
      ) : spec?.kind === 'bracket' ? (
        <BracketOnly n={spec.tuplet} />
      ) : spec ? (
        <NoteGroup spec={spec} />
      ) : null}
    </svg>
  )
}
