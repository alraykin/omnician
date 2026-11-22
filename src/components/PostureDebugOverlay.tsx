import { useEffect, useState } from 'react'

import {
  armLogoDebugGestures,
  isPostureDebugEnabled,
  readPostureDiagnostics,
  setPostureDebugEnabled,
  subscribePostureDebug,
  subscribePostureDiagnostics,
  type PostureDiagnostics,
} from '@/lib/posture-debug'

const ROWS: { key: keyof PostureDiagnostics; label: string }[] = [
  { key: 'display', label: 'display' },
  { key: 'hingeAvailable', label: 'hingeAvailable' },
  { key: 'hingeAttachFailed', label: 'hingeAttachFailed' },
  { key: 'hingeStatus', label: 'hingeStatus' },
  { key: 'hingeAngleDeg', label: 'hingeAngleDeg' },
  { key: 'foldDivisionActive', label: 'foldDivision*' },
  { key: 'foldDivisionHorizontal', label: 'foldDivHoriz' },
  { key: 'gravityX', label: 'gravity X' },
  { key: 'gravityY', label: 'gravity Y' },
  { key: 'gravityZ', label: 'gravity Z' },
  { key: 'motionAvailable', label: 'motionAvailable' },
  { key: 'model', label: 'model' },
  { key: 'windowSize', label: 'window' },
  { key: 'screenSize', label: 'screen' },
  { key: 'safeArea', label: 'safe-area' },
  { key: 'foldLayout', label: 'fold layout' },
  { key: 'coverPortraitRail', label: 'cover rail' },
  { key: 'nativeApp', label: 'nativeApp' },
  { key: 'pluginPresent', label: 'plugin' },
  { key: 'registered', label: 'registered' },
  { key: 'source', label: 'source' },
  { key: 'orientation', label: 'orientation' },
]

export function PostureDebugOverlay() {
  const [open, setOpen] = useState(() => isPostureDebugEnabled())
  const [snap, setSnap] = useState<PostureDiagnostics>(() => readPostureDiagnostics())

  useEffect(() => armLogoDebugGestures(), [])
  useEffect(() => subscribePostureDebug(setOpen), [])
  useEffect(() => {
    if (!open) return
    const tick = () => setSnap(readPostureDiagnostics())
    tick()
    const unsub = subscribePostureDiagnostics(tick)
    const id = window.setInterval(tick, 250)
    return () => {
      unsub()
      window.clearInterval(id)
    }
  }, [open])

  if (!open) return null

  return (
    <button
      type="button"
      data-posture-debug="on"
      aria-label="Dismiss posture diagnostics"
      onClick={() => setPostureDebugEnabled(false)}
      className="fixed inset-0 z-[220] flex items-end justify-center bg-black/45 px-3 py-4 text-left sm:items-center"
    >
      <aside className="w-[min(26rem,calc(100vw-1.5rem))] rounded-2xl border border-[#A855F7]/55 bg-[#0B0F1A]/96 px-3 py-2.5 font-mono text-[0.68rem] leading-5 text-slate-200 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        <p className="mb-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
          Posture debug · tap to dismiss
        </p>
        <dl className="grid grid-cols-[7.6rem_minmax(0,1fr)] gap-x-2">
          {ROWS.map((row) => (
            <div key={row.key} className="contents">
              <dt className="text-slate-500">{row.label}</dt>
              <dd className="min-w-0 break-words text-white">{snap[row.key]}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </button>
  )
}
