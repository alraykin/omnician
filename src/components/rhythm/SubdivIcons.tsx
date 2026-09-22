import type { SubdivisionId } from '@/lib/rhythm'

type NoteSpec = {
  kind: 'notes'
  count: number
  beams: 0 | 1 | 2
  tuplet?: 3
}

type BracketSpec = {
  kind: 'bracket'
  tuplet: 5 | 6 | 7
}

const ICONS: Record<SubdivisionId, NoteSpec | BracketSpec> = {
  1: { kind: 'notes', count: 1, beams: 0 },
  2: { kind: 'notes', count: 2, beams: 1 },
  3: { kind: 'notes', count: 3, beams: 1, tuplet: 3 },
  4: { kind: 'notes', count: 4, beams: 2 },
  5: { kind: 'bracket', tuplet: 5 },
  6: { kind: 'bracket', tuplet: 6 },
  7: { kind: 'bracket', tuplet: 7 },
}

function noteXs(count: number): number[] {
  if (count === 1) return [28]
  if (count === 2) return [17, 39]
  if (count === 3) return [12, 28, 44]
  return [8.5, 21.5, 34.5, 47.5]
}

function BracketOnly({ n }: { n: 5 | 6 | 7 }) {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 7 28 V 13 H 18.5" />
      <path d="M 49 28 V 13 H 37.5" />
      <text
        x="28"
        y="21.5"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontSize="16"
        fontWeight="700"
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
      >
        {n}
      </text>
    </g>
  )
}

function NoteGroup({ spec }: { spec: NoteSpec }) {
  const xs = noteXs(spec.count)
  const headY = spec.tuplet ? 30 : 28
  const stemTop = spec.tuplet ? 11.5 : 9.2
  const stemX = (x: number) => x + 4.55
  const first = stemX(xs[0])
  const last = stemX(xs[xs.length - 1])

  return (
    <>
      {spec.tuplet ? (
        <g fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round">
          <path d={`M ${first - 1} 7.6 V 4.6 H ${first + (last - first) / 2 - 5.4}`} />
          <path d={`M ${last + 1} 7.6 V 4.6 H ${first + (last - first) / 2 + 5.4}`} />
        </g>
      ) : null}
      {spec.tuplet ? (
        <text
          x="28"
          y="7.2"
          textAnchor="middle"
          fill="currentColor"
          fontSize="8.4"
          fontWeight="700"
          fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
        >
          {spec.tuplet}
        </text>
      ) : null}
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

export function SubdivIcon({
  steps,
  className,
}: {
  steps: SubdivisionId
  className?: string
}) {
  const spec = ICONS[steps]
  return (
    <svg
      viewBox="0 0 56 40"
      className={className}
      width="48"
      height="34"
      aria-hidden
    >
      {spec.kind === 'bracket' ? <BracketOnly n={spec.tuplet} /> : <NoteGroup spec={spec} />}
    </svg>
  )
}
