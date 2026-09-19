import { useState } from 'react'

import { AppChrome } from '@/components/AppChrome'
import { StringStrip } from '@/components/tuner/StringStrip'
import { TunerGauge } from '@/components/tuner/TunerGauge'
import { Button } from '@/components/ui/button'
import { useTuner, type TunerStatus } from '@/hooks/useTuner'
import {
  A4_HZ,
  IN_TUNE_CENTS,
  centsBetween,
  nearestString,
  stringsForPreset,
  type InstrumentPreset,
} from '@/lib/notes'
import { cn } from '@/lib/utils'

const PRESETS: { id: InstrumentPreset; label: string }[] = [
  { id: 'chromatic', label: 'Chromatic' },
  { id: 'guitar', label: 'Guitar' },
  { id: 'bass', label: 'Bass' },
]

export function TunerPage() {
  const { status, reading, level, start, stop } = useTuner()
  const [preset, setPreset] = useState<InstrumentPreset>('chromatic')

  const strings = stringsForPreset(preset)
  const activeString =
    reading && strings.length > 0
      ? nearestString(reading.frequency, strings)
      : null
  const displayCents = reading?.cents ?? null
  const inTune =
    displayCents !== null && Math.abs(displayCents) <= IN_TUNE_CENTS
  const live = status === 'listening' && reading !== null
  const stringInTune =
    reading && activeString
      ? Math.abs(centsBetween(reading.frequency, activeString.midi)) <=
        IN_TUNE_CENTS
      : false

  return (
    <AppChrome align="fill">
      <div className="flex flex-1 flex-col">
        <h1 className="text-center text-2xl font-bold tracking-tight text-white">
          Tuner
        </h1>
        <p className="mt-1 text-center text-sm text-slate-400">
          A4 = {A4_HZ} Hz · equal temperament
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id)}
              className={cn(
                'rounded-xl border px-2 py-2.5 text-sm font-semibold transition',
                preset === item.id
                  ? 'border-[#A855F7] bg-[#A855F7]/20 text-white'
                  : 'border-white/10 bg-white/4 text-slate-300 hover:border-white/20',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">
          {preset === 'guitar' && 'Standard guitar · E A D G B e'}
          {preset === 'bass' && 'Standard bass · E A D G'}
          {preset === 'chromatic' && 'Any pitch · nearest note'}
        </p>

        <section
          className="mt-6 flex flex-1 flex-col items-center rounded-3xl border border-white/10 bg-[#141A28]/80 px-4 py-6 sm:px-6"
          aria-live="polite"
        >
          <NoteDisplay
            live={live}
            inTune={inTune}
            sharpName={reading?.sharpName}
            flatName={reading?.flatName}
            isNatural={reading?.isNatural}
            octave={reading?.octave}
          />

          <p
            className={cn(
              'mt-3 text-lg font-semibold tabular-nums',
              !live && 'text-slate-500',
              live && inTune && 'text-emerald-300',
              live && !inTune && displayCents !== null && displayCents < 0 &&
                'text-sky-300',
              live && !inTune && displayCents !== null && displayCents > 0 &&
                'text-orange-300',
            )}
          >
            {live && displayCents !== null
              ? formatCents(displayCents)
              : '— cents'}
          </p>

          <TunerGauge cents={displayCents} inTune={inTune} active={live} />

          <LevelMeter level={level} on={status === 'listening'} />

          {strings.length > 0 ? (
            <div className="mt-4 w-full">
              <StringStrip
                strings={strings}
                activeId={live ? (activeString?.id ?? null) : null}
                inTune={stringInTune}
              />
            </div>
          ) : null}

          <p className="mt-5 min-h-10 text-center text-sm leading-6 text-slate-400">
            {statusMessage(status, live)}
          </p>
        </section>

        <div className="mt-5">
          {status === 'listening' || status === 'starting' ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-14 w-full text-base"
              onClick={stop}
              disabled={status === 'starting'}
            >
              {status === 'starting' ? 'Starting…' : 'Stop'}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="h-14 w-full text-base"
              onClick={() => void start()}
            >
              Start Tuning
            </Button>
          )}
        </div>
      </div>
    </AppChrome>
  )
}

function NoteDisplay({
  live,
  inTune,
  sharpName,
  flatName,
  isNatural,
  octave,
}: {
  live: boolean
  inTune: boolean
  sharpName?: string
  flatName?: string
  isNatural?: boolean
  octave?: number
}) {
  if (!live || !sharpName) {
    return (
      <div className="text-center">
        <div className="text-6xl font-extrabold tracking-tight text-white/25 sm:text-7xl">
          —
        </div>
        <p className="mt-1 text-sm text-slate-500">Waiting for a note</p>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div
        className={cn(
          'text-6xl font-extrabold tracking-tight sm:text-7xl',
          inTune ? 'text-emerald-300' : 'text-white',
        )}
      >
        {sharpName}
        <span className="ml-1 align-super text-2xl font-semibold text-slate-400 sm:text-3xl">
          {octave}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        {isNatural ? 'Natural' : `${sharpName} / ${flatName}`}
      </p>
    </div>
  )
}

function LevelMeter({ level, on }: { level: number; on: boolean }) {
  return (
    <div className="mt-1 flex w-full max-w-xs items-center gap-2">
      <span className="w-10 text-[0.65rem] uppercase tracking-wider text-slate-500">
        Mic
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-75',
            on ? 'bg-[#A855F7]' : 'bg-white/20',
          )}
          style={{ width: `${Math.round((on ? level : 0) * 100)}%` }}
        />
      </div>
    </div>
  )
}

function formatCents(cents: number): string {
  const rounded = Math.round(cents)
  if (Math.abs(rounded) <= 1) return '0 cents · in tune'
  if (rounded > 0) return `${rounded} cents sharp`
  return `${Math.abs(rounded)} cents flat`
}

function statusMessage(status: TunerStatus, live: boolean): string {
  if (status === 'idle') {
    return 'Tap Start Tuning, allow the microphone, then play a note near the phone.'
  }
  if (status === 'starting') return 'Asking for microphone access…'
  if (status === 'denied') {
    return 'Microphone is blocked. Allow the mic for this site in your browser or phone settings, then tap Start Tuning again.'
  }
  if (status === 'unavailable') {
    return 'Omnician could not find a microphone, or this page is not using a secure (https) connection.'
  }
  if (status === 'error') {
    return 'Something went wrong starting the tuner. Close other apps using the mic, then try again.'
  }
  if (status === 'listening' && !live) return 'Play a note…'
  return 'Hold steady until the needle sits in the green.'
}
