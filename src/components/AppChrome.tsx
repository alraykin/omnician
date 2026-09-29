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
  /** Rhythm wide screens park the tabs under Play; phones keep the floating bar. */
  wideTabPlacement?: 'dock' | 'inline'
}

const SHELL = {
  default: 'max-w-lg md:max-w-3xl lg:max-w-5xl wide:max-w-6xl',
  wide: 'max-w-lg md:max-w-3xl wide:max-w-6xl xl:max-w-7xl',
}

export function AppChrome({
  children,
  align = 'center',
  wide = false,
  compact = false,
  wideTabPlacement = 'dock',
}: AppChromeProps) {
  const shell = wide ? SHELL.wide : SHELL.default
  const inlineWideTabs = wideTabPlacement === 'inline'
  return (
    <div
      data-app-frame
      data-wide-tabs={wideTabPlacement}
      className={cn(
        'relative flex w-full max-w-full flex-col overscroll-x-none [touch-action:pan-y]',
        compact
          ? 'h-svh max-h-svh overflow-x-hidden overflow-y-hidden px-4 pt-3 sm:px-6 sm:pt-4 md:px-8 md:pt-5 lg:px-10 wide:h-auto wide:max-h-none wide:min-h-svh wide:overflow-x-clip wide:overflow-y-visible wide:px-3 wide:pt-2'
          : 'min-h-svh overflow-x-hidden px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9 wide:py-5',
      )}
    >
      <div className="stage-glow" aria-hidden />
      <header className={cn('relative z-10 mx-auto flex w-full items-center justify-center', shell)}>
        <Link to="/" aria-label="Omnician home">
          <OmnicianWordmark className={cn('w-auto', compact ? 'h-9 sm:h-11 wide:h-8' : 'h-10 sm:h-12 wide:h-9')} />
        </Link>
      </header>
      <main
        className={cn(
          'relative z-10 mx-auto flex w-full flex-1 flex-col',
          shell,
          compact ? 'pb-0' : cn('pb-[calc(2rem+var(--tabbar-clearance))]', inlineWideTabs && 'wide:pb-4'),
          align === 'center' && 'items-center justify-center px-2 text-center',
          align === 'fill' && (compact ? 'min-h-0 overflow-hidden pt-2 wide:overflow-visible' : 'pt-4'),
        )}
      >
        {children}
      </main>
      {compact ? (
        <div
          className={cn('h-[var(--tabbar-clearance)] shrink-0', inlineWideTabs && 'wide:hidden')}
          aria-hidden
          data-tabbar-spacer
        />
      ) : null}
      <AppTabBar className={inlineWideTabs ? 'wide:hidden' : undefined} />
    </div>
  )
}
