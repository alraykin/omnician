import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { AppTabBar } from '@/components/AppTabBar'
import { OmnicianWordmark } from '@/components/OmnicianMark'
import { cn } from '@/lib/utils'

type AppChromeProps = {
  children: ReactNode
  align?: 'center' | 'fill'
  wide?: boolean
  compact?: boolean
}

const SHELL = {
  default: 'max-w-lg md:max-w-3xl lg:max-w-5xl',
  wide: 'max-w-lg md:max-w-3xl lg:max-w-6xl xl:max-w-7xl',
}

export function AppChrome({
  children,
  align = 'center',
  wide = false,
  compact = false,
}: AppChromeProps) {
  const shell = wide ? SHELL.wide : SHELL.default
  return (
    <div
      data-app-frame
      className={cn(
        'relative flex w-full max-w-full flex-col overscroll-x-none [touch-action:pan-y]',
        compact
          ? 'h-svh max-h-svh overflow-x-hidden overflow-y-hidden px-4 pt-3 sm:px-6 sm:pt-4 md:px-8 md:pt-5 lg:px-10'
          : 'min-h-svh overflow-x-hidden px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9',
      )}
    >
      <div className="stage-glow" aria-hidden />
      <header className={cn('relative z-10 mx-auto flex w-full items-center justify-center', shell)}>
        <Link to="/" aria-label="Omnician home">
          <OmnicianWordmark className={cn('w-auto', compact ? 'h-9 sm:h-11' : 'h-10 sm:h-12')} />
        </Link>
      </header>
      <main
        className={cn(
          'relative z-10 mx-auto flex w-full flex-1 flex-col',
          shell,
          compact ? 'pb-0' : 'pb-[calc(2rem+var(--tabbar-clearance))]',
          align === 'center' && 'items-center justify-center px-2 text-center',
          align === 'fill' && (compact ? 'min-h-0 overflow-hidden pt-2' : 'pt-4'),
        )}
      >
        {children}
      </main>
      {compact ? <div className="h-[var(--tabbar-clearance)] shrink-0" aria-hidden data-tabbar-spacer /> : null}
      <AppTabBar />
    </div>
  )
}
