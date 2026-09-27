import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { OmnicianWordmark } from '@/components/OmnicianMark'
import { Button } from '@/components/ui/button'
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
          ? 'h-svh max-h-svh overflow-x-hidden overflow-y-hidden px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-5 lg:px-10'
          : 'min-h-svh overflow-x-hidden px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9',
      )}
    >
      <div className="stage-glow" aria-hidden />
      <header className={cn('relative z-10 mx-auto flex w-full items-center justify-between', shell)}>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/">
            <ArrowLeft className="size-4" />
            Home
          </Link>
        </Button>
        <OmnicianWordmark className={cn('w-auto', compact ? 'h-9 sm:h-11' : 'h-10 sm:h-12')} />
        <span className="w-[4.5rem]" aria-hidden />
      </header>
      <main
        className={cn(
          'relative z-10 mx-auto flex w-full flex-1 flex-col',
          shell,
          compact ? 'pb-0' : 'pb-8',
          align === 'center' && 'items-center justify-center px-2 text-center',
          align === 'fill' && (compact ? 'min-h-0 overflow-hidden pt-2' : 'pt-4'),
        )}
      >
        {children}
      </main>
    </div>
  )
}
