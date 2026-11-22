import { Link, useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'

import { leaveForTab, TAB_IDS, type TabId } from '@/components/AppTabBar'
import { TunerLink } from '@/components/TunerLink'
import { primeRhythmKit } from '@/lib/rhythm-audio'
import { CLICK_PATH, DRUMS_PATH, TUNER_PATH } from '@/lib/tool-routes'
import { cn } from '@/lib/utils'

const RAIL: { id: TabId; label: string; to: string; prime?: () => void }[] = [
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

/** Vertical tool rail for the Duo outer cover, inset from the right status strip. */
export function DuoRail() {
  const location = useLocation()
  const current = activeTab(location.pathname)
  const from = `${location.pathname}${location.search}`
  const q = location.search

  return (
    <aside
      data-duo-rail
      aria-label="Omnician tools"
      className="pointer-events-auto absolute bottom-[max(0.65rem,var(--safe-bottom))] top-[max(0.55rem,var(--safe-top))] z-30 flex w-[var(--duo-rail-width)] flex-col items-center"
      style={{ right: 'var(--duo-status-strip)' }}
    >
      <nav className="mt-auto flex w-full min-h-0 flex-col items-stretch justify-end gap-1 pb-1">
        {RAIL.map((tab) => {
          const active = current === tab.id
          const className = cn(
            'flex min-h-11 w-full items-center justify-center rounded-2xl px-0.5 text-center text-[0.58rem] font-semibold leading-tight tracking-tight touch-manipulation',
            active ? 'bg-[#A855F7] text-white' : 'text-slate-300 hover:bg-white/8 hover:text-white',
          )
          if (tab.id === 'tuner') {
            return (
              <TunerLink
                key={tab.id}
                to={`/tuner${q}`}
                data-tab={tab.id}
                data-duo-rail-tab={tab.id}
                aria-current={active ? 'page' : undefined}
                onClick={() => leaveForTab(tab.id)}
                className={className}
              >
                {tab.label}
              </TunerLink>
            )
          }
          return (
            <Link
              key={tab.id}
              to={`${tab.to}${q}`}
              data-tab={tab.id}
              data-duo-rail-tab={tab.id}
              aria-current={active ? 'page' : undefined}
              onPointerDown={() => {
                tab.prime?.()
                leaveForTab(tab.id)
              }}
              onClick={() => leaveForTab(tab.id)}
              className={className}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
      <Link
        to={`/settings${q}`}
        state={{ from }}
        aria-label="Settings"
        data-settings-gear
        className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-white"
      >
        <Settings className="size-[1.05rem]" strokeWidth={1.75} />
      </Link>
      <span className="sr-only">{RAIL.find((tab) => tab.id === current)?.label ?? 'Omnician'}</span>
    </aside>
  )
}

export const DUO_RAIL_TAB_IDS = TAB_IDS
