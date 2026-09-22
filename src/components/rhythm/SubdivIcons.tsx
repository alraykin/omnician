import type { SubdivisionId } from '@/lib/rhythm'

type IconSpec = {
  count: number
  beams: 0 | 1 | 2 | 3
  tuplet?: 3 | 5 | 6 | 7
}

const ICONS: Record<SubdivisionId, IconSpec> = {
  1: { count: 1, beams: 0 },
  2: { count: 2, beams: 1 },
  3: { count: 3, beams: 1, tuplet: 3 },
  4: { count: 4, beams: 2 },
  5: { count: 4, beams: 2, tuplet: 5 },
  6: { count: 4, beams: 2, tuplet: 6 },
  7: { count: 4, beams: 2, tuplet: 7 },
  8: { count: 4, beams: 3 },
}

function noteXs(count: number): number[] {
  if (count === 1) return [28]
  if (count === 2) return [17, 39]
  if (count === 3) return [12, 28, 44]
  return [8.5, 21.5, 34.5, 47.5]
}

export function SubdivIcon({
  steps,
  className,
}: {
  steps: SubdivisionId
  className?: string
}) {
  const spec = ICONS[steps]
  const xs = noteXs(spec.count)
  const headY = spec.tuplet ? 30 : 28
  const stemTop = spec.tuplet ? 11.5 : 9.2
  const stemX = (x: number) => x + 4.55
  const first = stemX(xs[0])
  const last = stemX(xs[xs.length - 1])

  return (
    <svg
      viewBox="0 0 56 40"
      className={className}
      width="44"
      height="32"
      aria-hidden
    >
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
      {spec.beams >= 3 ? (
        <rect
          x={first - 0.4}
          y={stemTop + 7.15}
          width={last - first + 0.8}
          height="1.9"
          rx="0.55"
          fill="currentColor"
        />
      ) : null}
    </svg>
  )
}
