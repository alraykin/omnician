import { PEG_PURPLE } from '@/lib/peg-style'

export function PegSpeakerIcon({
  cx,
  cy,
  size,
  fill,
  flip,
}: {
  cx: number
  cy: number
  size: number
  fill: string
  flip: boolean
}) {
  const s = size
  return (
    <g
      data-peg-speaker
      transform={flip ? `translate(${cx} ${cy}) scale(-1 1)` : `translate(${cx} ${cy})`}
    >
      <path
        d={`M ${-0.44 * s} ${-0.2 * s} L ${-0.16 * s} ${-0.2 * s} L ${0.16 * s} ${-0.4 * s} L ${0.16 * s} ${0.4 * s} L ${-0.16 * s} ${0.2 * s} L ${-0.44 * s} ${0.2 * s} Z`}
        fill={fill}
      />
      <path
        d={`M ${0.28 * s} ${-0.16 * s} A ${0.2 * s} ${0.26 * s} 0 0 1 ${0.28 * s} ${0.16 * s}`}
        fill="none"
        stroke={fill}
        strokeWidth={Math.max(2.2, s * 0.1)}
        strokeLinecap="round"
      />
      <path
        d={`M ${0.44 * s} ${-0.3 * s} A ${0.36 * s} ${0.44 * s} 0 0 1 ${0.44 * s} ${0.3 * s}`}
        fill="none"
        stroke={fill}
        strokeWidth={Math.max(2.2, s * 0.1)}
        strokeLinecap="round"
      />
    </g>
  )
}

export function PegPulseRings({
  cx,
  cy,
  radius,
}: {
  cx: number
  cy: number
  radius: number
}) {
  return (
    <g data-peg-pulse pointerEvents="none">
      <circle
        cx={cx}
        cy={cy}
        r={radius * 0.82}
        fill="none"
        stroke={PEG_PURPLE}
        strokeWidth={4}
        opacity={0.32}
      />
      <circle
        className="omni-fork-ring"
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={PEG_PURPLE}
        strokeWidth={3.6}
      />
      <circle
        className="omni-fork-ring omni-fork-ring-delay"
        cx={cx}
        cy={cy}
        r={radius * 1.32}
        fill="none"
        stroke={PEG_PURPLE}
        strokeWidth={2.8}
      />
    </g>
  )
}
