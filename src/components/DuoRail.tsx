import { Link, useLocation } from 'react-router-dom'
import { Drum, House, Metronome, Settings, type LucideIcon } from 'lucide-react'

import { leaveForTab, TAB_IDS, type TabId } from '@/components/AppTabBar'
import { TunerLink } from '@/components/TunerLink'
import { primeRhythmKit } from '@/lib/rhythm-audio'
import { CLICK_PATH, DRUMS_PATH, TUNER_PATH } from '@/lib/tool-routes'
import { cn } from '@/lib/utils'

const RAIL: { id: TabId; label: string; to: string; icon: LucideIcon | 'fork'; prime?: () => void }[] = [
  { id: 'home', label: 'Home', to: '/', icon: House },
  { id: 'tuner', label: 'Tuner', to: TUNER_PATH, icon: 'fork' },
  { id: 'click', label: 'Click', to: CLICK_PATH, icon: Metronome, prime: primeRhythmKit },
  { id: 'drums', label: 'Drums', to: DRUMS_PATH, icon: Drum, prime: primeRhythmKit },
]

function activeTab(pathname: string): TabId {
  if (pathname.startsWith(TUNER_PATH)) return 'tuner'
  if (pathname.startsWith(DRUMS_PATH) || pathname === '/drum-machine') return 'drums'
  if (pathname.startsWith(CLICK_PATH) || pathname === '/metronome' || pathname.startsWith('/rhythm')) {
    return 'click'
  }
  return 'home'
}

function TuningForkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden>
      <path
        d="M9 3.5v8.25a3 3 0 1 0 6 0V3.5"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 14.75V20.5" strokeWidth="1.85" strokeLinecap="round" />
      <path d="M9.25 20.5h5.5" strokeWidth="1.85" strokeLinecap="round" />
    </svg>
  )
}

function TabGlyph({ icon }: { icon: LucideIcon | 'fork' }) {
  if (icon === 'fork') return <TuningForkIcon className="size-[1.05rem]" />
  const Icon = icon
  return <Icon className="size-[1.05rem]" strokeWidth={1.85} />
}

function TabFace({ icon, label }: { icon: LucideIcon | 'fork'; label: string }) {
  return (
    <>
      <span data-duo-rail-icon={label.toLowerCase()} className="flex size-[1.15rem] items-center justify-center">
        <TabGlyph icon={icon} />
      </span>
      <span className="text-[0.52rem] font-semibold leading-none tracking-tight">{label}</span>
    </>
  )
}

function tabClass(active: boolean) {
  return cn(
    'flex w-[2.85rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[0.85rem] py-1.5 touch-manipulation',
    active
      ? 'bg-[#A855F7] text-white shadow-[0_4px_12px_rgba(168,85,247,0.35)]'
      : 'bg-white/[0.06] text-slate-300 ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-white',
  )
}

/** Vertical tool rail in the Duo outer right status band (thumb-reach, below island/clock). */
export function DuoRail() {
  const location = useLocation()
  const current = activeTab(location.pathname)
  const from = `${location.pathname}${location.search}`
  const q = location.search

  return (
    <aside
      data-duo-rail
      aria-label="Omnician tools"
      className="pointer-events-auto absolute right-0 z-30 flex w-[var(--duo-rail-width)] flex-col items-center"
      style={{
        bottom: 'max(0.35rem, var(--safe-bottom))',
        top: 'max(7.25rem, calc(var(--safe-top) + 5.75rem), var(--cluster-clear-height))',
      }}
    >
      <nav className="mt-auto flex w-full min-h-0 flex-col items-center justify-end gap-1.5 px-1.5 pb-1">
        {RAIL.map((tab) => {
          const active = current === tab.id
          const className = tabClass(active)
          const face = <TabFace icon={tab.icon} label={tab.label} />
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
                {face}
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
              {face}
            </Link>
          )
        })}
      </nav>
      <Link
        to={`/settings${q}`}
        state={{ from }}
        aria-label="Settings"
        data-settings-gear
        className="mb-0.5 flex size-[2.85rem] shrink-0 items-center justify-center rounded-[0.85rem] text-slate-400 ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-white"
      >
        <Settings className="size-[1.05rem]" strokeWidth={1.85} />
      </Link>
      <span className="sr-only">{RAIL.find((tab) => tab.id === current)?.label ?? 'Omnician'}</span>
    </aside>
  )
}

export const DUO_RAIL_TAB_IDS = TAB_IDS
