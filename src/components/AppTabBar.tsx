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
  void getTempoListener().cancel()
  if (next === 'tuner') return
  leaveTunerPage()
  releaseAllCapture()
}

export function AppTabBar() {
  const location = useLocation()
  const [params] = useSearchParams()
  const current = activeTab(location.pathname, params.get('mode'))

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(0.45rem,env(safe-area-inset-bottom,0px))] pt-1"
      data-tab-bar-wrap
    >
      <nav
        aria-label="Omnician tools"
        data-tab-bar
        className="pointer-events-auto mx-auto grid max-w-[23.75rem] grid-cols-4 gap-0.5 rounded-full border border-white/12 bg-[rgb(16_22_36/0.58)] px-1.5 py-1 shadow-[0_16px_44px_rgba(0,0,0,0.5)] backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)] lg:max-w-[26rem]"
      >
        {TABS.map((tab) => {
          const active = current === tab.id
          const className =
            'min-w-0 touch-manipulation rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]'
          const label = (
            <span
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[0.62rem] font-semibold leading-none',
                active ? 'bg-[#0B0F1A]/82 text-[#C084FC]' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              <TabIcon id={tab.id} className={cn('size-[1.35rem]', active && 'text-[#A855F7]')} />
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
    </div>
  )
}

function TabIcon({ id, className }: { id: TabId; className?: string }) {
  if (id === 'home') return <HomeGlyph className={className} />
  if (id === 'tuner') return <TunerGlyph className={className} />
  if (id === 'click') return <ClickGlyph className={className} />
  return <DrumsGlyph className={className} />
}

function HomeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4.5 11.2 12 4.8l7.5 6.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.4 10.6V19h4.1v-5.1h3V19h4.1v-8.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TunerGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9.2 3.8 7.4 20.2M14.8 3.8l1.8 16.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M8.6 8.2h6.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="8.2" r="1.15" fill="currentColor" />
    </svg>
  )
}

function ClickGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6.2 20.2h11.6L12 4.6 6.2 20.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 11.4 16.6 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17.2" cy="6.4" r="1.15" fill="currentColor" />
    </svg>
  )
}

function DrumsGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <ellipse cx="12" cy="8.4" rx="7.2" ry="3.1" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.8 8.4v6.3c0 1.7 3.2 3.1 7.2 3.1s7.2-1.4 7.2-3.1V8.4"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M5.6 4.4 10 8.1M18.4 4.4 14 8.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
