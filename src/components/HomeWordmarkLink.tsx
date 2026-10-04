import { Link } from 'react-router-dom'

import { leaveForTab } from '@/components/AppTabBar'
import { OmnicianWordmark } from '@/components/OmnicianMark'
import { cn } from '@/lib/utils'

export function HomeWordmarkLink({
  compact = false,
  className,
  markClassName,
}: {
  compact?: boolean
  className?: string
  markClassName?: string
}) {
  return (
    <Link
      to="/"
      aria-label="Home"
      data-home-wordmark
      onPointerDown={() => leaveForTab('home')}
      onClick={() => leaveForTab('home')}
      className={cn(
        'mx-auto flex cursor-pointer justify-center touch-manipulation select-none rounded-sm outline-none transition-opacity duration-150 active:opacity-60 focus-visible:ring-2 focus-visible:ring-[#A855F7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F1A] wide:mx-0 wide:shrink-0',
        className,
      )}
    >
      <OmnicianWordmark className={cn('w-auto', compact ? 'h-8 sm:h-9' : 'h-9 sm:h-10', markClassName)} />
    </Link>
  )
}
