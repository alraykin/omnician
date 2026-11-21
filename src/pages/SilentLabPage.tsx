import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { HomeWordmarkLink } from '@/components/HomeWordmarkLink'
import {
  disposeSilentLab,
  getSilentLabSnapshot,
  runDrumsWithoutSessionFromTap,
  runMicThenPlaybackFromTap,
  runPlaybackThenDrumsFromTap,
  runTenSecondClickLoopFromTap,
  silentLabBusy,
  silentLabLogText,
  stopSilentLabFromTap,
  subscribeSilentLab,
  type SilentLabSnapshot,
} from '@/lib/silent-lab'
import { activateOnPointer, cn } from '@/lib/utils'

const STEPS: { id: string; title: string; detail: string; run: () => void }[] = [
  {
    id: '1',
    title: '1 · Set playback, then drums',
    detail: "Writes navigator.audioSession.type = 'playback', then plays kick / hats / snare plus four wood clicks through our RhythmKit (this page’s own AudioContext).",
    run: runPlaybackThenDrumsFromTap,
  },
  {
    id: '2',
    title: '2 · Drums, do not set session',
    detail: 'Same hits as 1, without writing audioSession. If Silent is on, this is the control — Web Audio should stay muted.',
    run: runDrumsWithoutSessionFromTap,
  },
  {
    id: '3',
    title: '3 · Mic, release, playback, drums',
    detail: 'getUserMedia like Listen/Tuner (echo / noise / AGC off), hold 1.5s, stop tracks, set playback, then the same drum hits.',
    run: runMicThenPlaybackFromTap,
  },
  {
    id: '4',
    title: '4 · 10-second click loop',
    detail: 'Wood click at 120 BPM for 10 seconds (beat 1 accented). Watch whether it fades, freezes, or the context goes interrupted.',
    run: runTenSecondClickLoopFromTap,
  },
]

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn('font-semibold', ok ? 'text-emerald-300' : 'text-rose-300')}>{label}</span>
  )
}

export function SilentLabPage() {
  const [snap, setSnap] = useState<SilentLabSnapshot>(getSilentLabSnapshot)
  const [busy, setBusy] = useState(silentLabBusy)

  useEffect(() => {
    const unsub = subscribeSilentLab(() => {
      setSnap(getSilentLabSnapshot())
      setBusy(silentLabBusy())
    })
    const poll = window.setInterval(() => setSnap(getSilentLabSnapshot()), 400)
    return () => {
      unsub()
      window.clearInterval(poll)
      disposeSilentLab()
    }
  }, [])

  const copyLog = async () => {
    try {
      await navigator.clipboard.writeText(silentLabLogText())
    } catch {
      window.prompt('Copy this log', silentLabLogText())
    }
  }

  return (
    <div data-silent-lab className="safe-shell relative min-h-svh overflow-x-hidden">
      <header className="relative z-10 mb-5 flex items-center justify-center">
        <HomeWordmarkLink />
      </header>

      <main className="mx-auto w-full max-w-lg space-y-4">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
            Hidden iPhone lab
          </p>
          <h1 className="mt-1 text-3xl font-bold text-white">Silent switch</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Flip the ringer to <span className="text-white">Silent</span>. iOS 16.4+ Safari can set{' '}
            <span className="font-mono text-slate-200">audioSession.type = playback</span> so Web Audio
            ignores the switch. This page never uses a silent HTML audio loop, and it does not change
            Click / Drums / Tuner.
          </p>
        </div>

        <section
          data-silent-status
          className="rounded-2xl border border-white/12 bg-[#141A28] px-4 py-3 font-mono text-[0.78rem] leading-6 text-slate-200"
        >
          <p>
            audioSession{' '}
            {snap.sessionExists ? (
              <Flag ok label="exists" />
            ) : (
              <Flag ok={false} label="missing" />
            )}
            {' · '}type=<span className="text-white">{snap.sessionType}</span>
          </p>
          <p>
            context=<span className="text-white">{snap.contextState}</span>
            {' · '}t={snap.currentTime.toFixed(3)}s
            {' · '}
            {snap.timeAdvancing ? <Flag ok label="advancing" /> : <span className="text-slate-500">idle</span>}
            {snap.sampleRate ? ` · ${snap.sampleRate} Hz` : ''}
          </p>
          <p>
            mic live=<span className="text-white">{snap.micLive}</span>
            {snap.looping ? (
              <>
                {' · '}loop <span className="text-amber-200">{snap.loopLeftSec.toFixed(1)}s left</span>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-slate-300" data-silent-last>
            {snap.lastStep}
          </p>
        </section>

        <div className="space-y-2">
          {STEPS.map((step) => (
            <button
              key={step.id}
              type="button"
              data-silent-step={step.id}
              disabled={busy}
              className={cn(
                'w-full rounded-2xl border border-white/12 bg-[#141A28] px-4 py-3 text-left',
                busy && 'opacity-50',
              )}
              {...activateOnPointer(step.run)}
            >
              <span className="block text-base font-bold text-white">{step.title}</span>
              <span className="mt-1 block text-sm leading-5 text-slate-400">{step.detail}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" {...activateOnPointer(stopSilentLabFromTap)}>
            Stop
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            {...activateOnPointer(() => void copyLog())}
          >
            Copy log
          </Button>
        </div>

        <section data-silent-log>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Status log</h2>
          {snap.log.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Tap a step. Each one prints what happened here.</p>
          ) : (
            <ol className="mt-2 space-y-1.5">
              {[...snap.log].reverse().map((line, index) => (
                <li
                  key={`${line}-${index}`}
                  className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-[0.72rem] leading-5 text-slate-200"
                >
                  {line}
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  )
}
