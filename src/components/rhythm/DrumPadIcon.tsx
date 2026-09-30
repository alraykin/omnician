import type { ReactNode } from 'react'

import type { VoiceId } from '@/lib/rhythm'
import { cn } from '@/lib/utils'

function PadSvg({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-[52%] w-[52%]', className)}
      aria-hidden
    >
      {children}
    </svg>
  )
}

export function DrumPadIcon({ voice, className }: { voice: VoiceId; className?: string }) {
  switch (voice) {
    case 'crash':
      return (
        <PadSvg className={className}>
          <ellipse cx="32" cy="28" rx="18" ry="5.5" />
          <path d="M32 22.5v18" />
          <path d="M26 48h12" />
          <path d="M32 40.5v7.5" />
          <path d="M18 18l-5-6M46 18l5-6M14 26l-7-2M50 26l7-2" />
        </PadSvg>
      )
    case 'splash':
      return (
        <PadSvg className={className}>
          <ellipse cx="32" cy="30" rx="12" ry="4.2" />
          <path d="M32 25.8v16" />
          <path d="M27 48h10" />
          <path d="M32 42v6" />
          <path d="M22 22l-4-5M42 22l4-5" />
        </PadSvg>
      )
    case 'china':
      return (
        <PadSvg className={className}>
          <path d="M16 32c6-10 26-10 32 0-6 6-26 6-32 0Z" />
          <path d="M22 30c4-3 16-3 20 0" />
          <path d="M32 36v10" />
          <path d="M26 50h12" />
        </PadSvg>
      )
    case 'stack':
      return (
        <PadSvg className={className}>
          <ellipse cx="32" cy="26" rx="14" ry="4.5" />
          <ellipse cx="32" cy="32" rx="14" ry="4.5" />
          <ellipse cx="32" cy="38" rx="14" ry="4.5" />
          <path d="M32 42v6" />
          <path d="M26 52h12" />
        </PadSvg>
      )
    case 'highTom':
      return (
        <PadSvg className={className}>
          <ellipse cx="32" cy="24" rx="14" ry="6" />
          <path d="M18 24v14c0 4 6 7 14 7s14-3 14-7V24" />
          <path d="M22 48l-4 6M42 48l4 6" />
        </PadSvg>
      )
    case 'midTom':
      return (
        <PadSvg className={className}>
          <ellipse cx="32" cy="26" rx="15" ry="6.5" />
          <path d="M17 26v13c0 4.5 6.5 8 15 8s15-3.5 15-8V26" />
          <path d="M22 50l-5 6M42 50l5 6" />
        </PadSvg>
      )
    case 'floorTom':
      return (
        <PadSvg className={className}>
          <ellipse cx="32" cy="20" rx="16" ry="6" />
          <path d="M16 20v18c0 5 7 9 16 9s16-4 16-9V20" />
          <path d="M22 47v9M32 47v9M42 47v9" />
        </PadSvg>
      )
    case 'rideBell':
      return (
        <PadSvg className={className}>
          <ellipse cx="32" cy="30" rx="18" ry="6" />
          <ellipse cx="32" cy="30" rx="5" ry="2.4" />
          <path d="M32 24v20" />
          <path d="M26 50h12" />
        </PadSvg>
      )
    case 'openHat':
      return (
        <PadSvg className={className}>
          <ellipse cx="32" cy="24" rx="16" ry="5" />
          <ellipse cx="32" cy="34" rx="16" ry="5" />
          <path d="M32 39v9" />
          <path d="M26 52h12" />
        </PadSvg>
      )
    case 'closedHat':
      return (
        <PadSvg className={className}>
          <ellipse cx="32" cy="28" rx="16" ry="5" />
          <ellipse cx="32" cy="32" rx="16" ry="5" />
          <path d="M32 37v11" />
          <path d="M26 52h12" />
        </PadSvg>
      )
    case 'rim':
      return (
        <PadSvg className={className}>
          <ellipse cx="32" cy="34" rx="16" ry="10" />
          <ellipse cx="32" cy="34" rx="10" ry="6" />
          <path d="M20 18l10 14M44 16l-8 16" />
        </PadSvg>
      )
    case 'ride':
      return (
        <PadSvg className={className}>
          <ellipse cx="32" cy="28" rx="18" ry="6" />
          <path d="M32 22v22" />
          <path d="M26 50h12" />
          <path d="M32 44v6" />
        </PadSvg>
      )
    case 'kick':
      return (
        <PadSvg className={className}>
          <circle cx="34" cy="32" r="16" />
          <circle cx="34" cy="32" r="6" />
          <path d="M18 44l-6 10M14 36H8" />
          <circle cx="12" cy="36" r="3.2" />
        </PadSvg>
      )
    case 'snare':
      return (
        <PadSvg className={className}>
          <ellipse cx="32" cy="28" rx="16" ry="7" />
          <path d="M16 28v10c0 4 7 7 16 7s16-3 16-7V28" />
          <path d="M20 36l4 4M28 38l4 4M36 38l4 4M44 36l3 3" />
          <path d="M18 16l12 12M46 16l-12 12" />
        </PadSvg>
      )
    default:
      return null
  }
}
