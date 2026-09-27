import { useEffect, useState } from 'react'

import type { SpeedBuilderCue } from '@/lib/speed-builder'

export function SpeedBuilderPopup({ cue }: { cue: SpeedBuilderCue | null }) {
  const [shown, setShown] = useState<SpeedBuilderCue | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!cue) return
    setShown(cue)
    setVisible(true)
    const hide = window.setTimeout(() => setVisible(false), 1200)
    return () => window.clearTimeout(hide)
  }, [cue])

  if (!shown) return null

  return (
    <div
      data-speed-flash={visible ? 'on' : 'off'}
      data-speed-flash-pct={shown.pct}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
      aria-live="polite"
    >
      <p
        className={`rounded-full border border-[#A855F7]/50 bg-[#0B0F1A]/90 px-4 py-2 text-sm font-bold tabular-nums text-white shadow-[0_10px_28px_-16px_rgba(0,0,0,0.9)] backdrop-blur-sm ${
          visible ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-300`}
      >
        {shown.pct}%&nbsp;&nbsp;·&nbsp;&nbsp;{shown.bpm} BPM
      </p>
    </div>
  )
}
