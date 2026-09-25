import { Check } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AppChrome } from '@/components/AppChrome'
import { ChromaticCalibration } from '@/components/tuner/ChromaticCalibration'
import { CustomPresetEditor } from '@/components/tuner/CustomPresetEditor'
import { Headstock } from '@/components/tuner/Headstock'
import { TunerGauge } from '@/components/tuner/TunerGauge'
import { TuningSheet } from '@/components/tuner/TuningSheet'
import { useCustomTunings } from '@/hooks/useCustomTunings'
import { useTuner, type TunerStatus } from '@/hooks/useTuner'
import { loadTunerPrefs, saveTunerPrefs } from '@/lib/custom-presets'
import {
  GREEN_CLEAR_CENTS,
  IN_TUNE_CENTS,
  IN_TUNE_EXIT_CENTS,
  STRING_HYSTERESIS_CENTS,
  settleCents,
} from '@/lib/feel'
import { playInTuneChime } from '@/lib/in-tune-chime'
import { centsBetween, midiToFreq, trackString } from '@/lib/notes'
import {
  customToPreset,
  familyHasSubmenu,
  familyOf,
  findConfig,
  findFamily,
  inferInstrument,
  resolvePreset,
  type InstrumentId,
} from '@/lib/presets'
import { playReferenceTone } from '@/lib/reference-tone'
import {
  enterTunerPage,
  leaveTunerPage,
  resumeTuner,
  startTuner,
} from '@/lib/tuner-session'
import { cn } from '@/lib/utils'

export function TunerPage() {
  const prefs = useMemo(() => loadTunerPrefs(), [])
  const { tunings, upsert, remove } = useCustomTunings()
  const [presetId, setPresetId] = useState(prefs.presetId)
  const [instrumentId, setInstrumentId] = useState<InstrumentId>(prefs.instrumentId)
  const [a4Hz, setA4Hz] = useState(prefs.a4Hz)
  const [autoString, setAutoString] = useState(prefs.autoString)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editor, setEditor] = useState<null | { id?: string }>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [autoId, setAutoId] = useState<string | null>(null)
  const [tunedIds, setTunedIds] = useState<Set<string>>(() => new Set())
  const [inTune, setInTune] = useState(false)
  const inTuneRef = useRef(false)
  const autoPendingRef = useRef<{ id: string; hits: number } | null>(null)

  const { status, reading, needsGesture } = useTuner(a4Hz)

  useEffect(() => {
    enterTunerPage()

    const onGesture = () => {
      void startTuner({ fromGesture: true })
    }
    const onResume = () => {
      void resumeTuner()
    }

    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('touchstart', onGesture, { passive: true })
    window.addEventListener('keydown', onGesture)
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('pageshow', onResume)

    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('touchstart', onGesture)
      window.removeEventListener('keydown', onGesture)
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('pageshow', onResume)
      leaveTunerPage()
    }
  }, [])

  const customPresets = tunings.map(customToPreset)
  const current = resolvePreset(presetId, customPresets)
  const activeInstrument = inferInstrument(current, instrumentId)
  const config = findConfig(activeInstrument)
  const family = findFamily(familyOf(activeInstrument))
  const instrumentLabel = familyHasSubmenu(family.id)
    ? `${family.label} · ${config.label}`
    : family.label

  useEffect(() => {
    saveTunerPrefs({
      presetId: current.id,
      instrumentId: activeInstrument,
      a4Hz,
      autoString,
    })
  }, [activeInstrument, a4Hz, autoString, current.id])

  useEffect(() => {
    setFocusIndex(0)
    setAutoId(null)
    setTunedIds(new Set())
    inTuneRef.current = false
    setInTune(false)
  }, [current.id])

  const strings = current.strings
  const instrumentMode = strings.length > 0
  const safeFocus = Math.min(focusIndex, Math.max(0, strings.length - 1))
  const lockedString = instrumentMode ? strings[safeFocus] ?? null : null
  const live = status === 'listening' && reading !== null

  const tracked = useMemo(() => {
    if (!reading || !instrumentMode) return null
    if (autoString) {
      return trackString(
        reading.frequency,
        strings,
        autoId,
        a4Hz,
        STRING_HYSTERESIS_CENTS,
      )
    }
    if (!lockedString) return null
    return {
      string: lockedString,
      cents: centsBetween(reading.frequency, lockedString.midi, a4Hz),
    }
  }, [a4Hz, autoId, autoString, instrumentMode, lockedString, reading, strings])

  useEffect(() => {
    if (!autoString || !tracked) return
    if (tracked.string.id === autoId) {
      autoPendingRef.current = null
      return
    }
    const pending = autoPendingRef.current
    if (!pending || pending.id !== tracked.string.id) {
      autoPendingRef.current = { id: tracked.string.id, hits: 1 }
      return
    }
    pending.hits += 1
    if (pending.hits < 2) return
    autoPendingRef.current = null
    setAutoId(tracked.string.id)
    const index = strings.findIndex((item) => item.id === tracked.string.id)
    if (index >= 0) setFocusIndex(index)
  }, [autoId, autoString, strings, tracked])

  const activeString = instrumentMode
    ? (tracked?.string ??
        (autoString
          ? (strings.find((item) => item.id === autoId) ?? lockedString)
          : lockedString))
    : null

  const rawCents = instrumentMode
    ? (tracked?.cents ?? null)
    : (reading?.cents ?? null)

  useEffect(() => {
    inTuneRef.current = false
    setInTune(false)
  }, [activeString?.id])

  useEffect(() => {
    if (!live || rawCents === null) {
      if (inTuneRef.current) {
        inTuneRef.current = false
        setInTune(false)
      }
      return
    }

    const abs = Math.abs(rawCents)
    let next = inTuneRef.current
    if (abs <= IN_TUNE_CENTS) next = true
    else if (abs > IN_TUNE_EXIT_CENTS) next = false

    const crossedIn = next && !inTuneRef.current
    if (next !== inTuneRef.current) {
      inTuneRef.current = next
      setInTune(next)
    }

    if (!instrumentMode) {
      if (crossedIn) playInTuneChime()
      return
    }
    if (!activeString) return
    const id = activeString.id

    if (next && abs <= IN_TUNE_CENTS && !tunedIds.has(id)) {
      playInTuneChime()
      setTunedIds((currentIds) => {
        if (currentIds.has(id)) return currentIds
        const nextIds = new Set(currentIds)
        nextIds.add(id)
        return nextIds
      })
      return
    }

    if (tunedIds.has(id) && abs > GREEN_CLEAR_CENTS) {
      setTunedIds((currentIds) => {
        if (!currentIds.has(id)) return currentIds
        const nextIds = new Set(currentIds)
        nextIds.delete(id)
        return nextIds
      })
    }
  }, [activeString, instrumentMode, live, rawCents, tunedIds])

  const displayCents =
    rawCents === null ? null : settleCents(rawCents, inTune)
  const targetLabel = activeString
    ? `${activeString.label}${activeString.octave}`
    : null

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
      <div className="flex min-h-0 flex-1 flex-col">
        <h1 className="text-center text-xl font-bold tracking-tight text-white sm:text-2xl">
          Tuner
        </h1>
        <p className="mt-1 text-center text-sm text-slate-400">
          A4 = {a4Hz} Hz · ±{IN_TUNE_CENTS} cents
        </p>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#141A28] px-4 py-3 text-left"
          >
            <span>
              <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
                {instrumentLabel}
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
        </div>

        <section
          className={cn(
            'mt-4 flex min-h-0 flex-1 flex-col items-center rounded-3xl border px-4 py-4 sm:px-6 sm:py-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8',
            inTune && live
              ? 'border-emerald-400/50 bg-emerald-500/10'
              : 'border-white/10 bg-[#141A28]/80',
          )}
          aria-live="polite"
          data-tuner-status={status}
          data-tuner-gesture={needsGesture ? 'needed' : 'ready'}
        >
          <div className="flex min-h-0 w-full flex-1 flex-col items-center">
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
              'mt-2 text-lg font-semibold tabular-nums',
              !live && 'text-slate-500',
              live && inTune && 'text-emerald-300',
              live && !inTune && displayCents !== null && displayCents < 0 &&
                'text-sky-300',
              live && !inTune && displayCents !== null && displayCents > 0 &&
                'text-orange-300',
            )}
          >
            {live && displayCents !== null
              ? formatCents(displayCents, inTune, targetLabel)
              : '— cents'}
          </p>

          <div className="mt-2 flex min-h-0 w-full flex-1 flex-col">
            <TunerGauge
              cents={displayCents}
              readout={
                live && rawCents !== null
                  ? inTune
                    ? 0
                    : Math.round(rawCents)
                  : null
              }
              inTune={inTune}
              active={live}
            />
          </div>
          </div>

          {instrumentMode ? (
            <div className="mt-4 w-full lg:mt-2">
              <Headstock
                strings={strings}
                config={activeInstrument}
                selectedId={activeString?.id ?? null}
                tunedIds={tunedIds}
                inTune={inTune}
                live={live}
                autoString={autoString}
                onAutoChange={(value) => {
                  setAutoString(value)
                  setAutoId(value ? (activeString?.id ?? null) : null)
                }}
                onTapPeg={(string) => {
                  playReferenceTone(midiToFreq(string.midi, a4Hz), family.id)
                  const index = strings.findIndex((item) => item.id === string.id)
                  if (index >= 0) setFocusIndex(index)
                  if (autoString) setAutoId(string.id)
                }}
              />
            </div>
          ) : (
            <div className="mt-4 w-full lg:mt-2">
              <ChromaticCalibration a4Hz={a4Hz} onChange={setA4Hz} compact />
            </div>
          )}

          <p
            className={cn(
              'mt-4 min-h-10 text-center text-sm leading-6 lg:col-span-2',
              needsGesture || status === 'denied' ? 'text-slate-500' : 'text-slate-400',
            )}
          >
            {statusMessage(status, live, instrumentMode, autoString, needsGesture)}
          </p>
        </section>
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
        <div className="text-5xl font-extrabold tracking-tight text-white/25 sm:text-6xl">
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
          'relative inline-flex items-start text-5xl font-extrabold tracking-tight sm:text-6xl',
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
        {target ? ` · ${target}` : ''}
      </p>
    </div>
  )
}

function formatCents(
  cents: number,
  inTune: boolean,
  targetLabel: string | null,
): string {
  const rounded = Math.round(cents)
  const vs = targetLabel ? ` of ${targetLabel}` : ''
  if (inTune && Math.abs(rounded) <= 1) return `0 cents · in tune${vs}`
  if (rounded > 0) return `${rounded} cents sharp${vs}`
  if (rounded < 0) return `${Math.abs(rounded)} cents flat${vs}`
  return `0 cents${vs}`
}

function statusMessage(
  status: TunerStatus,
  live: boolean,
  instrumentMode: boolean,
  autoString: boolean,
  needsGesture: boolean,
): string {
  if (status === 'denied') {
    return 'Microphone is blocked. Allow the mic for this site in your browser or phone Settings, then tap anywhere to try again.'
  }
  if (status === 'unavailable') {
    return 'Omnician could not find a microphone, or this page is not using a secure (https) connection.'
  }
  if (status === 'error') {
    return 'Something went wrong starting the tuner. Close other apps using the mic, then tap anywhere to try again.'
  }
  if (status === 'starting') return 'Asking for microphone access…'
  if (needsGesture || status === 'idle') {
    return 'Tap anywhere to start listening'
  }
  if (status === 'listening' && !live) return 'Play a note…'
  if (instrumentMode && autoString) {
    return 'Auto is listening for the nearest string in this tuning. Tap a peg to hear it, or turn Auto off to lock one string.'
  }
  return instrumentMode
    ? 'Auto is off. The red peg is locked — play that string, or tap another peg to change the target.'
    : 'Play a steady note. The trail sits in the center when you are in tune.'
}

function ordinal(value: number): string {
  if (value === 1) return 'st'
  if (value === 2) return 'nd'
  if (value === 3) return 'rd'
  return 'th'
}
