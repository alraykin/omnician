import { Link, useLocation } from 'react-router-dom'

import { TunerLink } from '@/components/TunerLink'
import { releaseAllCapture } from '@/lib/audio-context'
import { getTempoListener } from '@/lib/tempo-listen'
import { primeRhythmKit } from '@/lib/rhythm-audio'
import { CLICK_PATH, DRUMS_PATH, TUNER_PATH } from '@/lib/tool-routes'
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
  { id: 'tuner', label: 'Tuner', to: TUNER_PATH },
  { id: 'click', label: 'Click', to: CLICK_PATH, prime: primeRhythmKit },
  { id: 'drums', label: 'Drums', to: DRUMS_PATH, prime: primeRhythmKit },
]

function activeTab(pathname: string): TabId {
  if (pathname.startsWith(TUNER_PATH)) return 'tuner'
  if (pathname.startsWith(DRUMS_PATH) || pathname === '/drum-machine') return 'drums'
  if (pathname.startsWith(CLICK_PATH) || pathname === '/metronome' || pathname.startsWith('/rhythm')) {
    return 'click'
  }
  return 'home'
}

/** Same teardown as tapping a header tab. Wordmark Home uses this too. */
export function leaveForTab(next: TabId) {
  getTempoListener().release()
  if (next === 'tuner') return
  leaveTunerPage()
  releaseAllCapture()
}

export function AppTabBar({
  className,
}: {
  className?: string
}) {
  const location = useLocation()
  const current = activeTab(location.pathname)
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
                onClick={() => leaveForTab(tab.id)}
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
                leaveForTab(tab.id)
              }}
              onClick={() => leaveForTab(tab.id)}
              className={className}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
