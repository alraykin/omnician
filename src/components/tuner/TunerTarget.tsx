import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

type TunerTargetProps = {
  cents: number | null
  inTune: boolean
  active: boolean
}

const REACH = 0.42

export function TunerTarget({ cents, inTune, active }: TunerTargetProps) {
  const ballRef = useRef<HTMLSpanElement>(null)
  const shownRef = useRef(0)
  const centsRef = useRef(cents)
  const activeRef = useRef(active)

  centsRef.current = cents
  activeRef.current = active

  useEffect(() => {
    let raf = 0

    const tick = () => {
      const live = activeRef.current
      const targetCents = centsRef.current

      if (live && targetCents !== null) {
        const clamped = Math.max(-50, Math.min(50, targetCents))
        const delta = clamped - shownRef.current
        const follow = Math.abs(delta) > 8 ? 0.48 : 0.34
        shownRef.current += delta * follow
      } else {
        shownRef.current *= 0.9
      }

      const ball = ballRef.current
      if (ball) {
        const offset = (shownRef.current / 50) * REACH * 100
        ball.style.left = `${50 + offset}%`
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const locked = inTune && active
  const live = active && cents !== null

  return (
    <div className="flex w-full flex-col" aria-hidden>
      <div
        data-tuner-target
        className={cn(
          'relative h-[6rem] w-full overflow-hidden rounded-2xl bg-[#070A12] ring-1 sm:h-[6.75rem]',
          locked ? 'omni-hold-glow ring-emerald-400/70' : 'ring-white/8',
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-1.5 z-10 flex justify-between px-4 text-[0.6rem] font-medium uppercase tracking-wider text-slate-500">
          <span>Flat</span>
          <span className={cn('min-h-[1em]', locked ? 'text-emerald-300' : 'text-transparent')}>
            {locked ? 'Locked' : ''}
          </span>
          <span>Sharp</span>
        </div>

        <div className="absolute inset-x-[8%] top-1/2 h-0 -translate-y-1/2">
          <div
            className={cn(
              'absolute inset-x-0 top-0 h-1 -translate-y-1/2 rounded-full',
              locked ? 'bg-emerald-400/55' : 'bg-[#A855F7]/25',
            )}
          />
          <div
            className={cn(
              'absolute left-1/2 top-0 h-1 w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[1px]',
              locked ? 'bg-emerald-300/70' : 'bg-[#A855F7]/45',
            )}
          />

          {([-50, -25, 0, 25, 50] as const).map((mark) => (
            <span
              key={mark}
              className={cn(
                'absolute top-3 w-px -translate-x-1/2 bg-white/20',
                mark === 0 ? 'h-0' : 'h-2.5',
              )}
              style={{ left: `${50 + (mark / 50) * REACH * 100}%` }}
            />
          ))}

          <span
            className={cn(
              'absolute left-1/2 top-0 size-[2.85rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] transition-colors',
              locked
                ? 'border-emerald-400 bg-emerald-400/35 shadow-[0_0_28px_rgba(52,211,153,0.7)]'
                : 'border-[#A855F7]/80 bg-[#A855F7]/10',
            )}
          />

          <span
            ref={ballRef}
            data-target-ball
            className={cn(
              'absolute top-0 size-[2.3rem] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors',
              !live && 'opacity-35',
              locked
                ? 'bg-emerald-300 shadow-[0_0_28px_rgba(52,211,153,0.95)]'
                : 'bg-[#E9D5FF] shadow-[0_0_22px_rgba(168,85,247,0.75)]',
            )}
            style={{ left: '50%' }}
          />
        </div>

        <div className="pointer-events-none absolute inset-x-[8%] bottom-1.5 flex justify-between text-[0.6rem] text-slate-500">
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${50 - REACH * 100}%` }}
          >
            −50¢
          </span>
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${50 + REACH * 100}%` }}
          >
            +50¢
          </span>
        </div>
      </div>
    </div>
  )
}
