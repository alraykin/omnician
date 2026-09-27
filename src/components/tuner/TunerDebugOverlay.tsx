import type { TunerDebugInfo } from '@/lib/tuner-session'

export function TunerDebugOverlay({ debug }: { debug: TunerDebugInfo }) {
  const rows: [string, string][] = [
    ['sampleRate', debug.sampleRate ? `${Math.round(debug.sampleRate)} Hz` : '—'],
    ['captureRate', debug.captureRate ? `${Math.round(debug.captureRate)} Hz` : '—'],
    ['channels', debug.channelCount == null ? '—' : String(debug.channelCount)],
    ['device', debug.deviceLabel || '—'],
    ['RMS', debug.rms.toFixed(4)],
    ['raw Hz', debug.rawHz > 0 ? debug.rawHz.toFixed(2) : '—'],
    ['clarity', debug.clarity.toFixed(3)],
    ['note', debug.note],
    [
      'cents',
      debug.cents == null ? '—' : `${debug.cents >= 0 ? '+' : ''}${debug.cents.toFixed(1)}`,
    ],
    ['engine', debug.engine],
  ]

  return (
    <aside
      data-tuner-debug="on"
      className="pointer-events-none fixed bottom-3 left-3 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-[#A855F7]/40 bg-[#0B0F1A]/94 px-3 py-2.5 font-mono text-[0.68rem] leading-5 text-slate-200 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
    >
      <p className="mb-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
        Tuner debug · send Alex a screenshot
      </p>
      <dl className="grid grid-cols-[7.25rem_minmax(0,1fr)] gap-x-2">
        {rows.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-slate-500">{key}</dt>
            <dd className="min-w-0 truncate text-white" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
