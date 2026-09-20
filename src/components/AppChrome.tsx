import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { OmnicianWordmark } from '@/components/OmnicianMark'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type AppChromeProps = {
  children: ReactNode
  align?: 'center' | 'fill'
}

export function AppChrome({ children, align = 'center' }: AppChromeProps) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-x-hidden px-5 py-6 sm:px-8 sm:py-8">
      <div className="stage-glow" aria-hidden />
      <header className="relative z-10 mx-auto flex w-full max-w-lg items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/">
            <ArrowLeft className="size-4" />
            Home
          </Link>
        </Button>
        <OmnicianWordmark className="h-7 w-auto sm:h-8" />
        <span className="w-[4.5rem]" aria-hidden />
      </header>
      <main
        className={cn(
          'relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col pb-8',
          align === 'center' && 'items-center justify-center px-2 text-center',
          align === 'fill' && 'pt-4 sm:max-w-xl',
        )}
      >
        {children}
      </main>
    </div>
  )
}
