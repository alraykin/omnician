import { beatUnitBeams, type BeatUnit, type SubdivisionId } from '@/lib/rhythm'

type NoteLook = {
  hollow: boolean
  beams: number
  count: number
}

function lookFor(steps: SubdivisionId, beatUnit: BeatUnit): NoteLook {
  const beatBeams = beatUnitBeams(beatUnit)
  if (steps === 1) {
    return { hollow: beatBeams < 0, beams: Math.max(0, beatBeams), count: 1 }
  }
  if (steps === 4) {
    const beams = beatBeams + 2
    return { hollow: beams < 0, beams: Math.min(4, Math.max(0, beams)), count: 4 }
  }
  const beams = beatBeams + 1
  if (steps === 3) {
    return { hollow: beams < 0, beams: Math.min(4, Math.max(0, beams)), count: 3 }
  }
  if (steps === 2) {
    return { hollow: beams < 0, beams: Math.min(4, Math.max(0, beams)), count: 2 }
  }
  return { hollow: beams < 0, beams: Math.min(4, Math.max(0, beams)), count: 2 }
}

function noteXs(count: number): number[] {
  if (count === 1) return [28]
  if (count === 2) return [17, 39]
  if (count === 3) return [12, 28, 44]
  return [8.5, 21.5, 34.5, 47.5]
}

function NoteGlyphs({ look, headY = 28, stemTop = 9.2 }: { look: NoteLook; headY?: number; stemTop?: number }) {
  const xs = noteXs(look.count)
  const stemX = (x: number) => x + 4.55
  const first = stemX(xs[0])
  const last = stemX(xs[xs.length - 1])
  const beamGap = look.beams >= 4 ? 2.55 : 3.15

  return (
    <>
      {xs.map((x) => (
        <g key={x}>
          {look.hollow ? (
            <ellipse
              cx={x}
              cy={headY}
              rx="5.15"
              ry="3.45"
              transform={`rotate(-22 ${x} ${headY})`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            />
          ) : (
            <ellipse
              cx={x}
              cy={headY}
              rx="5.15"
              ry="3.45"
              transform={`rotate(-22 ${x} ${headY})`}
              fill="currentColor"
            />
          )}
          <rect
            x={stemX(x) - 0.7}
            y={stemTop}
            width="1.4"
            height={headY - stemTop - 1.1}
            rx="0.6"
            fill="currentColor"
          />
        </g>
      ))}
      {look.beams >= 1 && look.count >= 2
        ? Array.from({ length: look.beams }, (_, beam) => (
            <rect
              key={beam}
              x={first - 0.4}
              y={stemTop + beam * beamGap}
              width={last - first + 0.8}
              height={beam === 0 ? 2.45 : 2.05}
              rx="0.6"
              fill="currentColor"
            />
          ))
        : null}
      {look.beams >= 1 && look.count === 1
        ? Array.from({ length: look.beams }, (_, flag) => (
            <path
              key={flag}
              d={`M ${first + 0.2} ${stemTop + flag * 3.15} C ${first + 7} ${stemTop + flag * 3.15 + 2}, ${first + 8.2} ${stemTop + flag * 3.15 + 9}, ${first + 3.4} ${stemTop + flag * 3.15 + 13.5}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          ))
        : null}
    </>
  )
}

function TripletBracket({ first, last }: { first: number; last: number }) {
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
    </>
  )
}

function TupletOverNotes({ n, look }: { n: 5 | 6 | 7; look: NoteLook }) {
  return (
    <>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 10 16 V 6 H 19" />
        <path d="M 46 16 V 6 H 37" />
      </g>
      <text
        x="28"
        y="15"
        textAnchor="middle"
        fill="currentColor"
        fontSize="12"
        fontWeight="700"
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
      >
        {n}
      </text>
      <g transform="translate(0 6)">
        <NoteGlyphs look={{ ...look, count: 2 }} headY={26} stemTop={12} />
      </g>
    </>
  )
}

export function SubdivIcon({
  steps,
  beatUnit = 4,
  className,
  compact = false,
  tiny = false,
}: {
  steps: SubdivisionId
  beatUnit?: BeatUnit
  className?: string
  compact?: boolean
  tiny?: boolean
}) {
  const look = lookFor(steps, beatUnit)
  const xs = noteXs(look.count)
  const stemX = (x: number) => x + 4.55

  return (
    <svg
      viewBox="0 0 56 40"
      className={className}
      width={tiny ? 24 : compact ? 28 : 48}
      height={tiny ? 17 : compact ? 20 : 34}
      aria-hidden
      data-subdiv-icon={`${steps}:${beatUnit}`}
    >
      {steps === 3 ? (
        <>
          <TripletBracket first={stemX(xs[0])} last={stemX(xs[xs.length - 1])} />
          <NoteGlyphs look={look} headY={32} stemTop={14.5} />
        </>
      ) : steps === 5 || steps === 6 || steps === 7 ? (
        <TupletOverNotes n={steps} look={look} />
      ) : (
        <NoteGlyphs look={look} />
      )}
    </svg>
  )
}
