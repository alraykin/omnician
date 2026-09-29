import { useEffect, useState } from 'react'

import { getAudioDebugSnapshot, type AudioDebugSnapshot } from '@/lib/audio-context'

function formatRate(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate)} Hz`
}

export function AudioDebugOverlay({
  getSnapshot = getAudioDebugSnapshot,
}: {
  getSnapshot?: () => AudioDebugSnapshot
}) {
  const [snap, setSnap] = useState<AudioDebugSnapshot>(() => getSnapshot())

  useEffect(() => {
    const tick = () => setSnap(getSnapshot())
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [getSnapshot])

  const rows: [string, string][] = [
    ['playback', snap.playbackState],
    ['play rate', formatRate(snap.playbackRate)],
    ['currentTime', snap.playbackTime.toFixed(3)],
    ['time moving', snap.timeAdvancing ? 'yes' : 'NO'],
    ['capture', snap.captureState],
    ['cap rate', formatRate(snap.captureRate)],
    ['audioSession', snap.sessionType],
    ['mic tracks', `${snap.micLive} live / ${snap.micTracks}`],
    ['need recover', snap.captureUsed ? 'yes' : 'no'],
    ['last recover', snap.lastRecovery],
    ['recoveries', String(snap.recoveries)],
    ['last error', snap.lastError],
    ['last stop', snap.lastStop],
    ['stop stack', snap.lastStopStack || '—'],
  ]

  return (
    <aside
      data-audio-debug="on"
      className="pointer-events-none fixed top-3 right-3 z-[80] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-amber-400/50 bg-[#0B0F1A]/94 px-3 py-2.5 font-mono text-[0.68rem] leading-5 text-slate-200 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
    >
      <p className="mb-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-amber-300">
        Audio session · screenshot for Alex
      </p>
      <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-2">
        {rows.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-slate-500">{key}</dt>
            <dd
              className={
                key === 'last error' || key === 'stop stack' || key === 'last stop'
                  ? 'min-w-0 whitespace-pre-wrap break-words text-white'
                  : 'min-w-0 truncate text-white'
              }
              title={value}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
