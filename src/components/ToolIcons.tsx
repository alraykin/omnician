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

function RhythmIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn('size-7', className)}
      aria-hidden
    >
      <circle cx="16" cy="16" r="10.5" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="16" cy="16" r="4.2" fill="currentColor" />
      <path
        d="M7 16h3.2M21.8 16H25M16 7v3.2M16 21.8V25"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
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
  return <RhythmIcon className={className} />
}
