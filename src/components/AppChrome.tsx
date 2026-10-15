import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'

import { AppTabBar } from '@/components/AppTabBar'
import { HomeWordmarkLink } from '@/components/HomeWordmarkLink'
import { cn } from '@/lib/utils'

type AppChromeProps = {
  children: ReactNode
  align?: 'center' | 'fill'
  wide?: boolean
  /** Let Click/Drums use the leftover desktop width for the grid. */
  fluid?: boolean
  compact?: boolean
  /** Home hides the tool switcher. Tuner / Click / Drums keep it. */
  hideTabs?: boolean
}

const SHELL = {
  default: 'max-w-lg md:max-w-3xl lg:max-w-5xl wide:max-w-6xl',
  wide: 'max-w-lg md:max-w-3xl wide:max-w-6xl xl:max-w-7xl',
  fluid: 'max-w-lg md:max-w-3xl wide:max-w-none',
}

function SettingsGearButton() {
  const location = useLocation()
  const from = `${location.pathname}${location.search}`
  return (
    <Link
      to="/settings"
      state={{ from }}
      aria-label="Settings"
      data-settings-gear
      className="absolute right-0 top-0 z-20 flex size-11 items-center justify-center rounded-full text-slate-500/80 hover:text-slate-300 wide:top-1/2 wide:-translate-y-1/2"
    >
      <Settings className="size-[1.15rem]" strokeWidth={1.75} />
    </Link>
  )
}

export function AppChrome({
  children,
  align = 'center',
  wide = false,
  fluid = false,
  compact = false,
  hideTabs = false,
}: AppChromeProps) {
  const shell = fluid ? SHELL.fluid : wide ? SHELL.wide : SHELL.default
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
      {hideTabs ? null : (
        <header
          className={cn(
            'relative z-10 mx-auto flex w-full flex-col items-stretch gap-2 wide:flex-row wide:items-center wide:gap-3 wide:pr-14',
            shell,
          )}
        >
          <div className="relative flex min-h-11 items-center justify-center pr-11 wide:min-h-0 wide:justify-start wide:pr-0">
            <HomeWordmarkLink compact={compact} />
          </div>
          <div className="min-w-0 flex-1">
            <AppTabBar />
          </div>
          <SettingsGearButton />
        </header>
      )}
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
