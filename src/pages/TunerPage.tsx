import { Check } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AppChrome } from '@/components/AppChrome'
import { ChromaticCalibration } from '@/components/tuner/ChromaticCalibration'
import { CustomPresetEditor } from '@/components/tuner/CustomPresetEditor'
import { SensitivityControl } from '@/components/tuner/SensitivityControl'
import { StringStrip } from '@/components/tuner/StringStrip'
import { TunerGauge } from '@/components/tuner/TunerGauge'
import { TuningSheet } from '@/components/tuner/TuningSheet'
import { Button } from '@/components/ui/button'
import { useCustomTunings } from '@/hooks/useCustomTunings'
import { useTuner, type TunerStatus } from '@/hooks/useTuner'
import { loadTunerPrefs, saveTunerPrefs } from '@/lib/custom-presets'
import { playInTuneChime } from '@/lib/in-tune-chime'
import { matchString } from '@/lib/notes'
import {
  customToPreset,
  findInstrument,
  inferInstrument,
  resolvePreset,
  type InstrumentId,
} from '@/lib/presets'
import { SENSITIVITY, type Sensitivity } from '@/lib/sensitivity'
import { cn } from '@/lib/utils'

export function TunerPage() {
  const prefs = useMemo(() => loadTunerPrefs(), [])
  const { tunings, upsert, remove } = useCustomTunings()
  const [presetId, setPresetId] = useState(prefs.presetId)
  const [instrumentId, setInstrumentId] = useState<InstrumentId>(prefs.instrumentId)
  const [sensitivity, setSensitivity] = useState<Sensitivity>(prefs.sensitivity)
  const [a4Hz, setA4Hz] = useState(prefs.a4Hz)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editor, setEditor] = useState<null | { id?: string }>(null)

  const { status, reading, level, start, stop } = useTuner(sensitivity, a4Hz)

  const customPresets = tunings.map(customToPreset)
  const current = resolvePreset(presetId, customPresets)
  const activeInstrument = inferInstrument(current, instrumentId)
  const instrument = findInstrument(activeInstrument)

  useEffect(() => {
    saveTunerPrefs({
      presetId: current.id,
      instrumentId: activeInstrument,
      sensitivity,
      a4Hz,
    })
  }, [activeInstrument, a4Hz, current.id, sensitivity])

  const demoTone = useMemo(() => {
    const hz = Number(new URLSearchParams(window.location.search).get('demo'))
    return Number.isFinite(hz) && hz > 20 && hz < 4000
  }, [])

  const strings = current.strings
  const instrumentMode = strings.length > 0
  const locked = reading && instrumentMode
    ? matchString(reading.frequency, strings, a4Hz)
    : null
  const activeString = locked?.string ?? null
  const displayCents = demoTone
    ? (reading?.cents ?? null)
    : locked
      ? locked.cents
      : (reading?.cents ?? null)
  const inTuneWindow = SENSITIVITY[sensitivity].inTuneCents
  const inTune =
    displayCents !== null &&
    Math.abs(displayCents) <= inTuneWindow &&
    (demoTone || !instrumentMode || locked !== null)
  const live = status === 'listening' && reading !== null
  const stringInTune = Boolean(
    locked && Math.abs(locked.cents) <= inTuneWindow,
  )
  const unmatchedNote =
    live && instrumentMode && !locked && !demoTone && reading
      ? `${reading.sharpName}${reading.octave}`
      : null

  const wasInTune = useRef(false)
  useEffect(() => {
    const celebrating = live && inTune
    if (celebrating && !wasInTune.current) {
      playInTuneChime()
    }
    wasInTune.current = celebrating
  }, [inTune, live])

  const openEdit = (id: string) => {
    setPickerOpen(false)
    setEditor({ id })
  }

  const deleteCustom = (id: string) => {
    if (!window.confirm('Delete this saved tuning from this device?')) return
    remove(id)
    if (presetId === id) {
      setPresetId('chromatic')
      setInstrumentId('chromatic')
    }
  }

  return (
    <AppChrome align="fill">
      <div className="flex flex-1 flex-col">
        <h1 className="text-center text-2xl font-bold tracking-tight text-white">
          Tuner
        </h1>
        <p className="mt-1 text-center text-sm text-slate-400">
          A4 = {a4Hz} Hz · equal temperament
        </p>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#141A28] px-4 py-3 text-left"
          >
            <span>
              <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
                {instrument.label}
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-white">
                {current.name}
              </span>
              <span className="block font-mono text-xs tracking-wide text-slate-500">
                {current.notes}
              </span>
            </span>
            <span className="text-xs font-semibold text-slate-400">Change</span>
          </button>
          <SensitivityControl value={sensitivity} onChange={setSensitivity} />
        </div>

        <section
          className={cn(
            'mt-5 flex flex-1 flex-col items-center rounded-3xl border px-4 py-6 sm:px-6',
            live && inTune
              ? 'border-emerald-400/40 bg-emerald-500/8'
              : 'border-white/10 bg-[#141A28]/80',
          )}
          aria-live="polite"
        >
          <NoteDisplay
            live={live}
            inTune={inTune}
            sharpName={reading?.sharpName}
            flatName={reading?.flatName}
            isNatural={reading?.isNatural}
            octave={reading?.octave}
            target={
              instrumentMode && activeString
                ? `${activeString.label}${activeString.octave} · ${activeString.stringNo}${ordinal(activeString.stringNo)}`
                : null
            }
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
              ? formatCents(displayCents, inTune)
              : '— cents'}
          </p>

          <TunerGauge cents={displayCents} inTune={inTune} active={live} />

          <LevelMeter level={level} on={status === 'listening'} />

          {instrumentMode ? (
            <div className="mt-4 w-full">
              <StringStrip
                strings={strings}
                activeId={live ? (activeString?.id ?? null) : null}
                inTune={stringInTune}
              />
            </div>
          ) : (
            <div className="mt-4 w-full">
              <ChromaticCalibration a4Hz={a4Hz} onChange={setA4Hz} compact />
            </div>
          )}

          <p className="mt-5 min-h-10 text-center text-sm leading-6 text-slate-400">
            {statusMessage(status, live, instrumentMode, unmatchedNote)}
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

      <TuningSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        current={current}
        instrumentId={activeInstrument}
        customs={customPresets}
        a4Hz={a4Hz}
        onA4Change={setA4Hz}
        onConfirm={({ instrumentId: nextInstrument, presetId: nextPreset }) => {
          setInstrumentId(nextInstrument)
          setPresetId(nextPreset)
        }}
        onCreate={() => {
          setPickerOpen(false)
          setEditor({})
        }}
        onEdit={openEdit}
        onDelete={deleteCustom}
      />

      {editor !== null ? (
        <CustomPresetEditor
          draft={
            editor.id
              ? (tunings.find((item) => item.id === editor.id) ?? null)
              : null
          }
          onClose={() => setEditor(null)}
          onSave={(draft) => {
            const id = upsert(draft)
            if (id) {
              setPresetId(id)
              setInstrumentId('custom')
            }
            return id
          }}
        />
      ) : null}
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
  target,
}: {
  live: boolean
  inTune: boolean
  sharpName?: string
  flatName?: string
  isNatural?: boolean
  octave?: number
  target: string | null
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
          'relative inline-flex items-start text-6xl font-extrabold tracking-tight sm:text-7xl',
          inTune ? 'text-emerald-300' : 'text-white',
        )}
      >
        {sharpName}
        <span className="ml-1 align-super text-2xl font-semibold text-slate-400 sm:text-3xl">
          {octave}
        </span>
        {inTune ? (
          <span className="omni-in-tune-pop absolute -right-8 top-1 flex size-7 items-center justify-center rounded-full bg-emerald-400 text-[#06281c] sm:-right-9">
            <Check className="size-4 stroke-[3]" />
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-slate-400">
        {isNatural ? 'Natural' : `${sharpName} / ${flatName}`}
        {target ? ` · toward ${target}` : ''}
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

function formatCents(cents: number, inTune: boolean): string {
  const rounded = Math.round(cents)
  if (inTune && Math.abs(rounded) <= 1) return '0 cents · in tune'
  if (Math.abs(rounded) <= 1) return '0 cents'
  if (rounded > 0) return `${rounded} cents sharp`
  return `${Math.abs(rounded)} cents flat`
}

function statusMessage(
  status: TunerStatus,
  live: boolean,
  instrumentMode: boolean,
  unmatchedNote: string | null,
): string {
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
  if (unmatchedNote) {
    return `Heard ${unmatchedNote} — not in this tuning. Play a string from the set below.`
  }
  return instrumentMode
    ? 'Needle eases toward the highlighted string. Hold until the checkmark lands.'
    : 'Hold steady until the needle settles and the checkmark appears.'
}

function ordinal(value: number): string {
  if (value === 1) return 'st'
  if (value === 2) return 'nd'
  if (value === 3) return 'rd'
  return 'th'
}
