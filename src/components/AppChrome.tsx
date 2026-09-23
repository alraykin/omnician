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

export function AppChrome({
  children,
  align = 'center',
  wide = false,
  compact = false,
}: AppChromeProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col',
        compact
          ? 'h-svh max-h-svh overflow-hidden px-4 py-3 sm:px-8 sm:py-5'
          : 'min-h-svh overflow-x-hidden px-5 py-6 sm:px-8 sm:py-8',
      )}
    >
      <div className="stage-glow" aria-hidden />
      <header
        className={cn(
          'relative z-10 mx-auto flex w-full items-center justify-between',
          wide ? 'max-w-3xl' : 'max-w-lg',
        )}
      >
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
          'relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col',
          compact ? 'pb-0' : 'pb-8',
          align === 'center' && 'items-center justify-center px-2 text-center',
          align === 'fill' && (wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'),
          align === 'fill' && (compact ? 'min-h-0 overflow-hidden pt-2' : 'pt-4'),
        )}
      >
        {children}
      </main>
    </div>
  )
}
