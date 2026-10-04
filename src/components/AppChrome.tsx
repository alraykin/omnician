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
  headerTrailing?: ReactNode
  /** Home hides the tool switcher. Tuner / Click / Drums keep it. */
  hideTabs?: boolean
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
  headerTrailing,
  hideTabs = false,
}: AppChromeProps) {
  const shell = wide ? SHELL.wide : SHELL.default
  return (
    <div
      data-app-frame
      className={cn(
        'relative flex w-full max-w-full flex-col overscroll-x-none [touch-action:pan-y]',
        compact
          ? 'h-svh max-h-svh overflow-x-hidden overflow-y-hidden px-4 pt-2.5 sm:px-6 sm:pt-3 md:px-8 lg:px-10 wide:h-auto wide:max-h-none wide:min-h-svh wide:overflow-x-clip wide:overflow-y-visible wide:px-3 wide:pt-2'
          : 'min-h-svh overflow-x-hidden px-5 pb-8 pt-4 sm:px-8 sm:pt-6 lg:px-10 wide:py-5',
      )}
    >
      <div className="stage-glow" aria-hidden />
      <header
        className={cn(
          'relative z-10 mx-auto flex w-full flex-col items-stretch gap-2 wide:flex-row wide:items-center wide:gap-3',
          shell,
        )}
      >
        <Link
          to="/"
          aria-label="Omnician home"
          className="mx-auto flex justify-center wide:mx-0 wide:shrink-0"
        >
          <OmnicianWordmark className={cn('w-auto', compact ? 'h-8 sm:h-9' : 'h-9 sm:h-10')} />
        </Link>
        {hideTabs ? null : (
          <div className="min-w-0 flex-1">
            <AppTabBar trailing={headerTrailing} />
          </div>
        )}
      </header>
      <main
        className={cn(
          'relative z-10 mx-auto flex w-full flex-1 flex-col',
          shell,
          compact ? 'pb-0' : 'pb-4',
          align === 'center' && 'items-center justify-center px-2 text-center',
          align === 'fill' && (compact ? 'min-h-0 overflow-hidden pt-2 wide:overflow-visible' : 'pt-4'),
        )}
      >
        {children}
      </main>
    </div>
  )
}
