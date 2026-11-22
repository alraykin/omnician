import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

import { cn } from '@/lib/utils'

export function settingsBackFrom(from: unknown): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('/settings') ? from : '/'
}

export function SettingsChrome({
  title,
  titleAs = 'h1',
  backTo,
  backLabel = 'Back',
  backState,
  children,
}: {
  title: string
  titleAs?: 'h1' | 'p'
  backTo: string
  backLabel?: string
  backState?: { from?: string }
  children: ReactNode
}) {
  const TitleTag = titleAs
  return (
    <div data-page-in-half className="safe-shell relative min-h-svh overflow-x-hidden">
      <div className="stage-glow" aria-hidden />
      <header className="relative z-10 mx-auto flex w-full max-w-lg items-center gap-1">
        <Link
          to={backTo}
          state={backState}
          data-settings-back
          className="flex h-11 min-w-11 shrink-0 items-center gap-0.5 rounded-full pr-2 text-sm font-semibold text-slate-300 hover:text-white"
        >
          <ChevronLeft className="size-5" />
          {backLabel}
        </Link>
        <TitleTag className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-white">{title}</TitleTag>
      </header>
      <main className={cn('relative z-10 mx-auto mt-5 w-full max-w-lg')}>{children}</main>
    </div>
  )
}

export function SettingRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#141A28]/80 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        {hint ? <p className="mt-0.5 text-xs leading-4 text-slate-500">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingSwitch({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors',
        on ? 'justify-end bg-[#A855F7]' : 'justify-start bg-white/15',
      )}
    >
      <span className="block size-6 shrink-0 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.45)]" />
    </button>
  )
}
