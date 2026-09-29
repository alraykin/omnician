import type { ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import { TunerLink } from '@/components/TunerLink'
import { releaseAllCapture } from '@/lib/audio-context'
import { getTempoListener } from '@/lib/tempo-listen'
import { primeRhythmKit } from '@/lib/rhythm-audio'
import { leaveTunerPage } from '@/lib/tuner-session'
import { cn } from '@/lib/utils'

export const TAB_IDS = ['home', 'tuner', 'click', 'drums'] as const
export type TabId = (typeof TAB_IDS)[number]

const TABS: {
  id: TabId
  label: string
  to: string
  prime?: () => void
}[] = [
  { id: 'home', label: 'Home', to: '/' },
  { id: 'tuner', label: 'Tuner', to: '/tuner' },
  { id: 'click', label: 'Click', to: '/rhythm?mode=click', prime: primeRhythmKit },
  { id: 'drums', label: 'Drums', to: '/rhythm?mode=drums', prime: primeRhythmKit },
]

function activeTab(pathname: string, mode: string | null): TabId {
  if (pathname.startsWith('/tuner')) return 'tuner'
  if (pathname.startsWith('/rhythm') || pathname === '/metronome' || pathname === '/drum-machine') {
    return mode === 'drums' ? 'drums' : 'click'
  }
  return 'home'
}

function onLeave(next: TabId) {
  getTempoListener().release()
  if (next === 'tuner') return
  leaveTunerPage()
  releaseAllCapture()
}

export function AppTabBar({
  trailing,
  className,
}: {
  trailing?: ReactNode
  className?: string
}) {
  const location = useLocation()
  const [params] = useSearchParams()
  const current = activeTab(location.pathname, params.get('mode'))
  const currentLabel = TABS.find((tab) => tab.id === current)?.label ?? 'Omnician'

  return (
    <div
      className={cn(
        'rhythm-glass flex w-full min-w-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2',
        className,
      )}
      data-tab-bar-wrap
      data-tab-placement="header"
      data-rhythm-header
    >
      <h1 className="sr-only">{currentLabel}</h1>
      <nav
        aria-label="Omnician tools"
        data-tab-bar
        className="grid min-w-0 flex-1 grid-cols-4 gap-0.5"
      >
        {TABS.map((tab) => {
          const active = current === tab.id
          const className =
            'min-w-0 touch-manipulation rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F1A]'
          const label = (
            <span
              className={cn(
                'flex h-8 items-center justify-center rounded-full px-1 text-[0.72rem] font-semibold leading-none sm:text-sm',
                active ? 'bg-[#A855F7] text-white' : 'text-slate-300 hover:bg-white/6 hover:text-white',
              )}
            >
              {tab.label}
            </span>
          )
          if (tab.id === 'tuner') {
            return (
              <TunerLink
                key={tab.id}
                data-tab={tab.id}
                aria-current={active ? 'page' : undefined}
                onClick={() => onLeave(tab.id)}
                className={className}
              >
                {label}
              </TunerLink>
            )
          }
          return (
            <Link
              key={tab.id}
              to={tab.to}
              data-tab={tab.id}
              aria-current={active ? 'page' : undefined}
              onPointerDown={() => {
                tab.prime?.()
                onLeave(tab.id)
              }}
              onClick={() => onLeave(tab.id)}
              className={className}
            >
              {label}
            </Link>
          )
        })}
      </nav>
      {trailing ? (
        <div className="shrink-0 pr-1" data-header-trailing>
          {trailing}
        </div>
      ) : null}
    </div>
  )
}
