import { useEffect, useState } from 'react'
import { AudioDebugOverlay } from '@/components/AudioDebugOverlay'
import { HomeWordmarkLink } from '@/components/HomeWordmarkLink'
import { Button } from '@/components/ui/button'
import {
  beginSilentSwitchAfterRunningFromTap,
  beginSilentSwitchFromTap,
  beginStrategyFromTap,
  clearLabLog,
  getLabAudioSnapshot,
  getLabView,
  hardReset,
  labLogText,
  markVerdict,
  playTestClickFromTap,
  subscribeLab,
  type LabStrategy,
} from '@/lib/audio-lab'
import { activateOnPointer, cn } from '@/lib/utils'

const STRATEGIES: { id: LabStrategy; title: string; detail: string }[] = [
  {
    id: 'H',
    title: 'H · Play while the mic is still live',
    detail: 'Starts the mic and leaves it on. Tap Play test click during capture — do not assume this works; mark what you hear.',
  },
  {
    id: 'A',
    title: 'A · Control (after mic stop, same context)',
    detail: 'Stop mic tracks and close capture, then wait. Play resumes the SAME playback context.',
  },
  {
    id: 'L',
    title: 'A-long · Real click + drums for 5 seconds',
    detail: 'Same mic stop as A, then a lookahead scheduler plays wood click plus kick/snare samples for about 5 seconds.',
  },
  {
    id: 'P',
    title: 'P · After mic: preview, then lookahead Play (the 0.5s stop)',
    detail:
      'Stop mic tracks and leave capture open (what Click/Drums now do). Play does 4 Listen-style preview clicks, then the real lookahead scheduler for 8 bars — no precount. Mark Heard only if it keeps going past ~0.5s and does not stop. A probe logs playback state every 100ms for 2 seconds, and every stop / statechange includes a stack trace.',
  },
  {
    id: 'B',
    title: 'B · Wait and retry if interrupted',
    detail: 'Same as A, but if the new context is interrupted, wait up to 1.5s, resume every 250ms, and recreate once at 800ms.',
  },
  {
    id: 'C',
    title: 'C · Stop tracks only',
    detail: 'Stop the mic tracks. Do not close capture. Do not replace playback. Play only calls resume() on the existing playback context.',
  },
  {
    id: 'D',
    title: 'D · Set audioSession playback after mic',
    detail: 'After the mic stops, set session type to playback, then Play makes a new context. (This is the write that broke first Play when done too early.)',
  },
  {
    id: 'E',
    title: 'E · One shared AudioContext',
    detail: 'Mic and clicks share one context that is never closed. After 3s we only stop tracks.',
  },
  {
    id: 'F',
    title: 'F · HTML audio element',
    detail: 'Same mic stop as A, but Play uses a WAV in an HTMLAudioElement instead of Web Audio.',
  },
  {
    id: 'G',
    title: 'G · Mute tracks, keep stream',
    detail: 'Do not stop the mic. Set track.enabled = false (orange mic dot may stay on). Play resumes the playback context.',
  },
]

export function AudioLabPage() {
  const [view, setView] = useState(getLabView)

  useEffect(() => {
    const unsub = subscribeLab(() => setView(getLabView()))
    return () => {
      unsub()
      hardReset(false)
    }
  }, [])

  const copyLog = async () => {
    try {
      await navigator.clipboard.writeText(labLogText())
    } catch {
      window.prompt('Copy this log', labLogText())
    }
  }

  return (
    <div
      data-audio-lab="on"
      className="relative min-h-svh overflow-x-hidden px-4 pb-16 pt-3 sm:px-6"
    >
      <AudioDebugOverlay getSnapshot={getLabAudioSnapshot} />
      <header className="relative z-10 mb-6 flex items-center justify-center">
        <HomeWordmarkLink />
      </header>

      <main className="mx-auto w-full max-w-lg space-y-5 pt-[16.5rem] sm:pt-2">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
            Hidden iPhone audio lab
          </p>
          <h1 className="mt-1 text-3xl font-bold text-white">Audio lab</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            We do <span className="text-white">not</span> assume the click can play while the mic is
            on. Start with <span className="text-white">H</span> if you want that check. A resumes the
            same playback context after the mic (what Click/Listen now do). <span className="text-white">
              A-long
            </span>{' '}
            is A plus five seconds of real click and drum samples. <span className="text-white">P</span> is
            after the mic: preview clicks, then a lookahead scheduler like Drums with Precount off,
            with a 100ms state probe and STOP stacks. Then tap{' '}
            <span className="text-white">Play test click</span> and mark Heard or Silent. Reset
            between letters. Fully quit Safari only after D or Silent switch if the next letter is
            silent, or if Reset leaves playback interrupted.
          </p>
        </div>

        <div
          className="rounded-2xl border border-white/12 bg-white/4 px-4 py-3"
          data-lab-phase={view.phase}
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Now {view.strategy ? `· strategy ${view.strategy}` : ''}
          </p>
          <p className="mt-1 text-base font-semibold leading-6 text-white">{view.status}</p>
        </div>

        <Button
          type="button"
          size="lg"
          className="h-16 w-full text-lg"
          disabled={!view.canPlay}
          data-lab-play
          {...activateOnPointer(() => playTestClickFromTap())}
        >
          Play test click
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-14"
            disabled={!view.canMark}
            data-lab-heard
            {...activateOnPointer(() => markVerdict('heard'))}
          >
            Heard
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-14"
            disabled={!view.canMark}
            data-lab-silent
            {...activateOnPointer(() => markVerdict('silent'))}
          >
            Silent
          </Button>
        </div>

        <div className="space-y-2">
          {STRATEGIES.map((item) => {
            const active = view.strategy === item.id
            const locked = view.phase !== 'idle'
            return (
              <button
                key={item.id}
                type="button"
                disabled={locked}
                data-lab-strategy={item.id}
                {...activateOnPointer(() => beginStrategyFromTap(item.id))}
                className={cn(
                  'w-full rounded-2xl border px-4 py-3 text-left touch-manipulation',
                  active
                    ? 'border-[#A855F7] bg-[#A855F7]/20 text-white'
                    : 'border-white/12 bg-white/4 text-slate-200',
                  locked && 'opacity-50',
                )}
              >
                <span className="block text-base font-bold">{item.title}</span>
                <span className="mt-1 block text-sm leading-5 text-slate-400">{item.detail}</span>
              </button>
            )
          })}
        </div>

        <section className="rounded-2xl border border-amber-400/35 bg-amber-400/8 p-4">
          <h2 className="text-base font-bold text-amber-200">Silent switch</h2>
          <p className="mt-1 text-sm leading-5 text-slate-400">
            These two buttons write audioSession to playback on purpose so we can hear whether
            Silent unmutes. The first write happens before the context (B6KcZYEI killed first Play).
            The second writes after clicks are already running — that is the fade Alex heard after
            one or two precount clicks, so the main app no longer does it. Try each with the ringer
            on, then with Silent on. If either poisons later letters, tap Reset, or fully quit
            Safari before the next letter.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-14 w-full"
            data-lab-silent-switch
            disabled={view.phase !== 'idle'}
            {...activateOnPointer(() => beginSilentSwitchFromTap())}
          >
            Set playback first, then click
          </Button>
          <Button
            type="button"
            variant="outline"
            className="mt-2 h-14 w-full"
            data-lab-silent-switch-after
            disabled={view.phase !== 'idle'}
            {...activateOnPointer(() => beginSilentSwitchAfterRunningFromTap())}
          >
            Click first, then set playback
          </Button>
        </section>

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" {...activateOnPointer(() => hardReset())}>
            Reset lab
          </Button>
          <Button type="button" variant="outline" className="flex-1" {...activateOnPointer(() => void copyLog())}>
            Copy log
          </Button>
          <Button type="button" variant="ghost" className="flex-1" {...activateOnPointer(() => clearLabLog())}>
            Clear log
          </Button>
        </div>

        <section data-lab-probe>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
            100ms probe + STOP stacks (first 2s of lookahead)
          </h2>
          {view.probe.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Runs automatically on P Play. Copy log includes state, STOP lines, and stacks.</p>
          ) : (
            <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-[0.72rem] leading-5 text-slate-200">
              {view.probe.join('\n')}
            </pre>
          )}
        </section>

        <section data-lab-log>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Results</h2>
          {view.log.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nothing marked yet.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {view.log.map((row, index) => (
                <li
                  key={`${row.at}-${row.strategy}-${index}`}
                  className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-[0.72rem] leading-5 text-slate-200"
                >
                  <span className="text-slate-500">{row.at}</span>{' '}
                  <span className="font-bold text-white">{row.strategy}</span>{' '}
                  <span className={row.verdict === 'heard' ? 'text-emerald-300' : 'text-rose-300'}>
                    {row.verdict.toUpperCase()}
                  </span>
                  <span className="mt-1 block whitespace-pre-wrap break-words text-slate-400">{row.note}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  )
}
