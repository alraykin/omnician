import { useLocation } from 'react-router-dom'
import { useState } from 'react'

import { useFoldChoice, useFoldHeaderVisible, useFoldHardware, useInnerFoldAvailable } from '@/hooks/useFoldMode'
import {
  FOLD_CHOICE_LABELS,
  FOLD_CHOICES,
  FOLD_COVER_CHOICES,
  cycleFoldChoice,
  saveFoldChoice,
  type FoldChoice,
} from '@/lib/fold-mode'
import { activateOnPointer, cn } from '@/lib/utils'

export function FoldModePicker({
  compact = false,
}: {
  compact?: boolean
}) {
  const choice = useFoldChoice()
  const detected = useFoldHardware()
  const innerOk = useInnerFoldAvailable()
  const choices = innerOk ? FOLD_CHOICES : FOLD_COVER_CHOICES
  const visibleChoice = (choices as readonly string[]).includes(choice) ? choice : 'off'
  return (
    <div data-fold-picker className={cn('flex flex-col gap-2', compact && 'gap-1.5')}>
      <div
        role="radiogroup"
        aria-label="Fold mode"
        className={cn(
          'grid gap-1 rounded-2xl border border-white/12 bg-[#141A28]/80 p-1',
          innerOk ? 'grid-cols-5' : 'grid-cols-3',
          compact && 'rounded-xl',
        )}
      >
        {choices.map((id) => {
          const on = visibleChoice === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              data-fold-choice={id}
              {...activateOnPointer(() => saveFoldChoice(id))}
              className={cn(
                'min-h-10 rounded-xl px-1 text-[0.68rem] font-semibold touch-manipulation',
                on ? 'bg-[#A855F7] text-white' : 'text-slate-300 hover:bg-white/6',
              )}
            >
              {FOLD_CHOICE_LABELS[id]}
            </button>
          )
        })}
      </div>
      <p className="text-[0.68rem] leading-4 text-slate-500" data-fold-tent-hint>
        {compact || !innerOk
          ? 'Tent is the outer/cover screen. Turn Click sideways for a pendulum.'
          : 'Tent (outer screen, landscape) is the cover display — turn Click sideways for a pendulum. Laptop needs the unfolded inner screen. Tuner landscape on that inner screen uses Book on its own.'}
      </p>
      {choice === 'auto' ? (
        <p className="text-[0.68rem] leading-4 text-slate-500" data-fold-auto-hint>
          Auto uses the hinge posture and viewport segments when the browser exposes them.
          Vertical split becomes Laptop, side-by-side becomes Book. Tent is always manual.
          {detected === 'off' ? ' This browser is not reporting a fold, so Auto matches Off.' : ` Detected ${detected}.`}
        </p>
      ) : null}
    </div>
  )
}

export function FoldModeButton({
  className,
  always = false,
  menuAlign = 'end',
}: {
  className?: string
  always?: boolean
  menuAlign?: 'start' | 'end'
}) {
  const choice = useFoldChoice()
  const visible = useFoldHeaderVisible()
  const innerOk = useInnerFoldAvailable()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const onTool =
    location.pathname.startsWith('/tuner') ||
    location.pathname.startsWith('/click') ||
    location.pathname.startsWith('/drums')
  if (!always && (!visible || !onTool)) return null

  return (
    <div className={cn('relative', className)} data-fold-button-wrap>
      <button
        type="button"
        data-fold-button
        aria-label={`Fold mode, ${FOLD_CHOICE_LABELS[choice]}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        {...activateOnPointer(() => setOpen((value) => !value))}
        onContextMenu={(event) => {
          event.preventDefault()
          saveFoldChoice(cycleFoldChoice(choice, innerOk))
        }}
        className={cn(
          'flex size-10 items-center justify-center rounded-full border border-white/12 text-slate-200 touch-manipulation',
          choice !== 'off' ? 'border-[#A855F7]/70 bg-[#A855F7]/20 text-white' : 'bg-white/4',
        )}
      >
        <FoldIcon />
      </button>
      {open ? (
        <div
          data-fold-popover
          className={cn(
            'absolute top-11 z-[95] w-[min(19.5rem,calc(100vw-1.25rem))] rounded-2xl border border-white/12 bg-[#101626] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.55)]',
            menuAlign === 'end' ? 'right-0' : 'left-0',
          )}
        >
          <FoldModePicker compact />
          <button
            type="button"
            className="mt-1 h-10 w-full rounded-xl text-[0.72rem] font-semibold text-slate-400"
            {...activateOnPointer(() => setOpen(false))}
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  )
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
