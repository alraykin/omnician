import { useEffect, useState } from 'react'

import type { SpeedBuilderCue } from '@/lib/speed-builder'
import { cn } from '@/lib/utils'

export function SpeedBuilderPopup({ cue }: { cue: SpeedBuilderCue | null }) {
  const [shown, setShown] = useState<SpeedBuilderCue | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!cue) return
    setShown(cue)
    setVisible(true)
    const hide = window.setTimeout(() => setVisible(false), 1500)
    return () => window.clearTimeout(hide)
  }, [cue])

  if (!shown) return null

  return (
    <div
      data-speed-flash={visible ? 'on' : 'off'}
      data-speed-flash-pct={shown.pct}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-3"
      aria-live="polite"
    >
      <div
        className={cn(
          'flex w-[min(22.5rem,94%)] flex-col items-center rounded-[2rem] border border-[#A855F7]/35 bg-[#070A12]/80 px-5 py-8 text-center shadow-[0_28px_80px_-18px_rgba(0,0,0,0.9)] backdrop-blur-md transition-opacity duration-500',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      >
        <p className="text-[4.75rem] font-extrabold tabular-nums leading-none tracking-tight text-white sm:text-[6rem]">
          {shown.pct}%
        </p>
        <p className="mt-2 text-[2.25rem] font-bold tabular-nums leading-none text-white/90 sm:text-5xl">
          {shown.bpm} BPM
        </p>
      </div>
    </div>
  )
}
