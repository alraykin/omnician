import { cn } from '@/lib/utils'
import type { FoldChoice } from '@/lib/fold-mode'
import { saveFoldChoice } from '@/lib/fold-mode'

/** Fold mode is automatic. Kept as a no-op so leftover imports compile. */
export function FoldModePicker(_props?: { compact?: boolean }) {
  return null
}

export function FoldModeButton(_props?: {
  className?: string
  always?: boolean
  menuAlign?: 'start' | 'end'
}) {
  return null
}

export function FoldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4', className)} aria-hidden>
      <rect x="3" y="5" width="8.2" height="14" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="12.8" y="5" width="8.2" height="14" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 5v14" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

export function setFoldChoice(next: FoldChoice) {
  saveFoldChoice(next)
}
