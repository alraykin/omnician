import type { ToolSlug } from '@/data/tools'
import { cn } from '@/lib/utils'

type IconProps = {
  className?: string
}

function TunerIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn('size-7', className)}
      aria-hidden
    >
      <path
        d="M10 27V13.5M16 27V7M22 27V16.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="11" r="2.2" fill="currentColor" />
      <circle cx="16" cy="11.5" r="2.2" fill="currentColor" />
      <circle cx="22" cy="14" r="2.2" fill="currentColor" />
    </svg>
  )
}

function MetronomeIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn('size-7', className)}
      aria-hidden
    >
      <path
        d="M8.5 27H23.5L19.2 6.8C19.05 6.18 18.5 5.75 17.86 5.75H14.14C13.5 5.75 12.95 6.18 12.8 6.8L8.5 27Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 20.5H21.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 20.5L21.5 9.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="21.5" cy="9.2" r="1.7" fill="currentColor" />
    </svg>
  )
}

function DrumMachineIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn('size-7', className)}
      aria-hidden
    >
      <rect
        x="5"
        y="5"
        width="9.5"
        height="9.5"
        rx="2.4"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <rect
        x="17.5"
        y="5"
        width="9.5"
        height="9.5"
        rx="2.4"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <rect
        x="5"
        y="17.5"
        width="9.5"
        height="9.5"
        rx="2.4"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <rect
        x="17.5"
        y="17.5"
        width="9.5"
        height="9.5"
        rx="2.4"
        fill="currentColor"
      />
    </svg>
  )
}

export function ToolIcon({
  slug,
  className,
}: {
  slug: ToolSlug
  className?: string
}) {
  if (slug === 'tuner') return <TunerIcon className={className} />
  if (slug === 'metronome') return <MetronomeIcon className={className} />
  return <DrumMachineIcon className={className} />
}
