import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'

import { AppTabBar } from '@/components/AppTabBar'
import { DuoRail } from '@/components/DuoRail'
import { HomeWordmarkLink } from '@/components/HomeWordmarkLink'
import { useCoverPortraitRail } from '@/hooks/useDuoLayout'
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

function HeaderTools() {
  const location = useLocation()
  const from = `${location.pathname}${location.search}`
  return (
    <div
      className="absolute top-0 z-20 flex items-center gap-0.5 wide:top-1/2 wide:-translate-y-1/2"
      style={{ right: 'var(--cluster-clear-right, 0px)' }}
    >
      <Link
        to="/settings"
        state={{ from }}
        aria-label="Settings"
        data-settings-gear
        className="flex size-11 items-center justify-center rounded-full text-slate-500/80 hover:text-slate-300"
      >
        <Settings className="size-[1.15rem]" strokeWidth={1.75} />
      </Link>
    </div>
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
  const coverRail = useCoverPortraitRail() && !hideTabs
  const fit = compact || coverRail
  const shell = fluid ? SHELL.fluid : wide ? SHELL.wide : SHELL.default
  return (
    <div
      data-app-frame
      data-duo-cover={coverRail ? '1' : undefined}
      className={cn(
        'safe-shell relative flex w-full max-w-full flex-col overscroll-x-none [touch-action:pan-y]',
        fit
          ? 'h-svh max-h-svh overflow-x-hidden overflow-y-hidden'
          : 'min-h-svh overflow-x-hidden',
        coverRail && 'duo-cover-shell',
      )}
    >
      <div className="stage-glow" aria-hidden />
      {coverRail ? <DuoRail /> : null}
      {hideTabs || coverRail ? null : (
        <header
          className={cn(
            'relative z-10 mx-auto flex w-full flex-col items-stretch gap-2 wide:flex-row wide:items-center wide:gap-3',
            'pr-[max(5.5rem,var(--cluster-clear-right))]',
            shell,
          )}
        >
          <div className="relative flex min-h-11 items-center justify-center pr-24 wide:min-h-0 wide:justify-start wide:pr-0">
            <HomeWordmarkLink compact={fit} />
          </div>
          <div className="min-w-0 flex-1">
            <AppTabBar />
          </div>
          <HeaderTools />
        </header>
      )}
      <main
        className={cn(
          'relative z-10 mx-auto flex w-full flex-1 flex-col',
          shell,
          fit ? 'pb-0' : 'pb-4',
          align === 'center' && 'items-center justify-center px-2 text-center',
          coverRail && 'pr-[var(--duo-rail-width)]',
          align === 'fill' &&
            (coverRail ? 'min-h-0 overflow-x-hidden overflow-y-auto pt-1' : fit ? 'min-h-0 overflow-hidden pt-1' : 'pt-4'),
        )}
      >
        {children}
      </main>
    </div>
  )
}
