import { Check } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AppChrome } from '@/components/AppChrome'
import { ChromaticCalibration } from '@/components/tuner/ChromaticCalibration'
import { CustomPresetEditor } from '@/components/tuner/CustomPresetEditor'
import { Headstock } from '@/components/tuner/Headstock'
import { TunerGauge } from '@/components/tuner/TunerGauge'
import { TuningSheet } from '@/components/tuner/TuningSheet'
import { Button } from '@/components/ui/button'
import { useCustomTunings } from '@/hooks/useCustomTunings'
import { useInTuneHold } from '@/hooks/useInTuneHold'
import { useTuner, type TunerStatus } from '@/hooks/useTuner'
import { loadTunerPrefs, saveTunerPrefs } from '@/lib/custom-presets'
import { IN_TUNE_CENTS } from '@/lib/feel'
import { playInTuneChime } from '@/lib/in-tune-chime'
import { centsBetween, midiToFreq } from '@/lib/notes'
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
  const [tunedIds, setTunedIds] = useState<Set<string>>(() => new Set())

  const { status, reading, level, start, stop } = useTuner(a4Hz)

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
    setTunedIds(new Set())
  }, [current.id])

  const strings = current.strings
  const instrumentMode = strings.length > 0
  const safeFocus = Math.min(focusIndex, Math.max(0, strings.length - 1))
  const focusString = instrumentMode ? strings[safeFocus] ?? null : null
  const displayCents =
    reading && instrumentMode && focusString
      ? centsBetween(reading.frequency, focusString.midi, a4Hz)
      : (reading?.cents ?? null)
  const inTune =
    displayCents !== null && Math.abs(displayCents) <= IN_TUNE_CENTS
  const live = status === 'listening' && reading !== null
  const activeString = focusString
  const holdTarget = instrumentMode
    ? (activeString?.id ?? null)
    : live
      ? 'chromatic'
      : null
  const targetLabel = activeString
    ? `${activeString.label}${activeString.octave}`
    : null

  const markComplete = useCallback((id: string) => {
    playInTuneChime()
    if (id === 'chromatic') return
    setTunedIds((currentIds) => {
      const next = new Set(currentIds)
      next.add(id)
      return next
    })
    if (!autoString) return
    window.setTimeout(() => {
      setFocusIndex((index) => {
        const startAt = strings.findIndex((item) => item.id === id)
        const from = startAt >= 0 ? startAt : index
        for (let offset = 1; offset <= strings.length; offset += 1) {
          const nextIndex = (from + offset) % strings.length
          if (strings[nextIndex].id !== id) {
            return nextIndex
          }
        }
        return index
      })
    }, 850)
  }, [autoString, strings])

  const { progress, complete } = useInTuneHold(inTune, live, holdTarget, markComplete)

  useEffect(() => {
    if (!focusString || displayCents === null || complete) return
    if (!tunedIds.has(focusString.id)) return
    if (Math.abs(displayCents) > IN_TUNE_CENTS + 10) {
      const id = focusString.id
      setTunedIds((currentIds) => {
        const next = new Set(currentIds)
        next.delete(id)
        return next
      })
    }
  }, [complete, displayCents, focusString, tunedIds])

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
            'mt-4 flex min-h-0 flex-1 flex-col items-center rounded-3xl border px-4 py-4 sm:px-6 sm:py-5',
            complete
              ? 'border-emerald-400/50 bg-emerald-500/10'
              : 'border-white/10 bg-[#141A28]/80',
          )}
          aria-live="polite"
        >
          <NoteDisplay
            live={live}
            complete={complete}
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
              live && complete && 'text-emerald-300',
              live && inTune && !complete && 'text-lime-300',
              live && !inTune && displayCents !== null && displayCents < 0 &&
                'text-sky-300',
              live && !inTune && displayCents !== null && displayCents > 0 &&
                'text-orange-300',
            )}
          >
            {live && displayCents !== null
              ? formatCents(displayCents, complete, targetLabel)
              : '— cents'}
          </p>

          <div className="mt-2 flex min-h-0 w-full flex-1 flex-col">
            <TunerGauge
              cents={displayCents}
              inTune={inTune}
              active={live}
              holdProgress={progress}
              holdComplete={complete}
            />
          </div>

          <LevelMeter level={level} on={status === 'listening'} />

          {instrumentMode ? (
            <div className="mt-4 w-full">
              <Headstock
                strings={strings}
                config={activeInstrument}
                selectedId={activeString?.id ?? null}
                tunedIds={tunedIds}
                autoString={autoString}
                onAutoChange={(value) => {
                  setAutoString(value)
                  setFocusIndex(0)
                }}
                onTapPeg={(string) => {
                  playReferenceTone(midiToFreq(string.midi, a4Hz), family.id)
                  const index = strings.findIndex((item) => item.id === string.id)
                  if (index >= 0) setFocusIndex(index)
                }}
              />
            </div>
          ) : (
            <div className="mt-4 w-full">
              <ChromaticCalibration a4Hz={a4Hz} onChange={setA4Hz} compact />
            </div>
          )}

          <p className="mt-4 min-h-10 text-center text-sm leading-6 text-slate-400">
            {statusMessage(status, live, instrumentMode, autoString)}
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
  complete,
  sharpName,
  flatName,
  isNatural,
  octave,
  target,
}: {
  live: boolean
  complete: boolean
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
          complete ? 'text-emerald-300' : 'text-white',
        )}
      >
        {sharpName}
        <span className="ml-1 align-super text-2xl font-semibold text-slate-400 sm:text-3xl">
          {octave}
        </span>
        {complete ? (
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

function LevelMeter({ level, on }: { level: number; on: boolean }) {
  return (
    <div className="mt-2 flex w-full max-w-xs items-center gap-2">
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

function formatCents(
  cents: number,
  complete: boolean,
  targetLabel: string | null,
): string {
  const rounded = Math.round(cents)
  const vs = targetLabel ? ` of ${targetLabel}` : ''
  if (complete && Math.abs(rounded) <= 1) return `0 cents · in tune${vs}`
  if (Math.abs(rounded) <= 1) return `0 cents · hold…${vs}`
  if (rounded > 0) return `${rounded} cents sharp${vs}`
  return `${Math.abs(rounded)} cents flat${vs}`
}

function statusMessage(
  status: TunerStatus,
  live: boolean,
  instrumentMode: boolean,
  autoString: boolean,
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
  if (instrumentMode && autoString) {
    return 'Auto strings is on. Hold the red peg in the green for about two seconds to lock it and move on.'
  }
  return instrumentMode
    ? 'Hold the trail in the center until the bar fills and the peg turns green.'
    : 'Hold steady until the bar fills and the display glows.'
}

function ordinal(value: number): string {
  if (value === 1) return 'st'
  if (value === 2) return 'nd'
  if (value === 3) return 'rd'
  return 'th'
}
