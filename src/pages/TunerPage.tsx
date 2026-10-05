import { Check } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AppChrome } from '@/components/AppChrome'
import { SettingSwitch } from '@/components/SettingsChrome'
import { A4ReferenceControl } from '@/components/tuner/A4ReferenceControl'
import { CustomPresetEditor } from '@/components/tuner/CustomPresetEditor'
import { Headstock } from '@/components/tuner/Headstock'
import { LayoutStylePill } from '@/components/tuner/InlineHeadstock'
import { InputPicker } from '@/components/tuner/InputPicker'
import { TunerDebugOverlay } from '@/components/tuner/TunerDebugOverlay'
import { TunerTarget } from '@/components/tuner/TunerTarget'
import { TuningSheet } from '@/components/tuner/TuningSheet'
import { useCustomTunings } from '@/hooks/useCustomTunings'
import { useTuner, type TunerStatus } from '@/hooks/useTuner'
import {
  loadTunerPrefs,
  parseLayoutMode,
  saveTunerPrefs,
  type TunerLayoutMode,
} from '@/lib/custom-presets'
import {
  IN_TUNE_CENTS,
  IN_TUNE_EXIT_CENTS,
  STRING_HYSTERESIS_CENTS,
  STICKY_HOLD_MS,
  formatTenths,
} from '@/lib/feel'
import { playAllTunedSting, playInTuneChime } from '@/lib/in-tune-chime'
import {
  allStringsSticky,
  indexForStringNo,
  parseFocusStringNo,
  seedTunedIds,
} from '@/lib/sticky-tune'
import { centsBetween, midiToFreq, trackString } from '@/lib/notes'
import {
  customToPreset,
  familyHasSubmenu,
  familyOf,
  findBuiltinPreset,
  findConfig,
  findFamily,
  inferInstrument,
  resolvePreset,
  type InstrumentId,
} from '@/lib/presets'
import { playReferenceTone } from '@/lib/reference-tone'
import { isTwelveString } from '@/lib/headstock'
import { armLogoDebugToggle, subscribeTunerDebug } from '@/lib/tuner-debug'
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
  const [presetId, setPresetId] = useState(() => {
    if (typeof window !== 'undefined') {
      const query = new URLSearchParams(window.location.search).get('preset')
      if (query && findBuiltinPreset(query)) return query
    }
    return prefs.presetId
  })
  const [instrumentId, setInstrumentId] = useState<InstrumentId>(() => {
    if (typeof window !== 'undefined') {
      const query = new URLSearchParams(window.location.search).get('preset')
      const found = query ? findBuiltinPreset(query) : undefined
      if (found) return found.config
    }
    return prefs.instrumentId
  })
  const [a4Hz, setA4Hz] = useState(prefs.a4Hz)
  const [autoString, setAutoString] = useState(() => {
    if (typeof window !== 'undefined') {
      const query = new URLSearchParams(window.location.search).get('auto')
      if (query === '0') return false
      if (query === '1') return true
    }
    return prefs.autoString
  })
  const [layoutMode, setLayoutMode] = useState<TunerLayoutMode>(() => {
    if (typeof window !== 'undefined') {
      const query = new URLSearchParams(window.location.search).get('layout')
      if (query === 'inline' || query === 'headstock') return query
    }
    return parseLayoutMode(prefs.layoutMode)
  })
  const demo = useMemo(() => readTunerDemo(), [])
  const [pickerOpen, setPickerOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('picker') === '1'
  })
  const [editor, setEditor] = useState<null | { id?: string }>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [autoId, setAutoId] = useState<string | null>(null)
  const [tunedIds, setTunedIds] = useState<Set<string>>(() => new Set())
  const [inTune, setInTune] = useState(false)
  const [celebrate, setCelebrate] = useState(() => demo.glow)
  const [showDebug, setShowDebug] = useState(false)
  const inTuneRef = useRef(false)
  const autoPendingRef = useRef<{ id: string; hits: number } | null>(null)
  const holdRef = useRef<{ id: string; timer: number } | null>(null)
  const celebratedRef = useRef(demo.glow)
  const initialTuningRef = useRef<string | null>(null)

  const { status, reading, needsGesture, debug } = useTuner(a4Hz)

  useEffect(() => subscribeTunerDebug(setShowDebug), [])
  useEffect(() => armLogoDebugToggle(), [])

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
      displayMode: 'target',
      layoutMode,
    })
  }, [activeInstrument, a4Hz, autoString, current.id, layoutMode])

  useEffect(() => {
    const query =
      typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
    const seeded = seedTunedIds(current.strings, query?.get('tuned') ?? null)
    const focus = indexForStringNo(
      current.strings,
      parseFocusStringNo(query?.get('string') ?? null),
    )
    setFocusIndex(focus ?? 0)
    setAutoId(null)
    if (initialTuningRef.current === null) initialTuningRef.current = current.id
    const firstTuning = current.id === initialTuningRef.current
    setTunedIds(firstTuning && seeded.size > 0 ? seeded : new Set())
    inTuneRef.current = false
    setInTune(false)
    if (holdRef.current) {
      window.clearTimeout(holdRef.current.timer)
      holdRef.current = null
    }
    if (!demo.glow) {
      celebratedRef.current = false
      setCelebrate(false)
    }
  }, [current.id, demo.glow])

  const strings = current.strings
  const instrumentMode = strings.length > 0
  const safeFocus = Math.min(focusIndex, Math.max(0, strings.length - 1))
  const lockedString = instrumentMode ? strings[safeFocus] ?? null : null
  const live = demo.cents !== null || (status === 'listening' && reading !== null)

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

  const rawCents =
    demo?.cents ??
    (instrumentMode ? (tracked?.cents ?? null) : (reading?.cents ?? null))

  useEffect(() => {
    inTuneRef.current = false
    setInTune(false)
  }, [activeString?.id])

  useEffect(() => {
    const clearHold = () => {
      if (holdRef.current) {
        window.clearTimeout(holdRef.current.timer)
        holdRef.current = null
      }
    }

    if (!live || rawCents === null) {
      if (inTuneRef.current) {
        inTuneRef.current = false
        setInTune(false)
      }
      clearHold()
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
      clearHold()
      if (crossedIn) playInTuneChime()
      return
    }
    if (!activeString) {
      clearHold()
      return
    }
    const id = activeString.id
    if (tunedIds.has(id)) {
      clearHold()
      return
    }

    const holding = next && abs <= IN_TUNE_CENTS
    if (!holding) {
      clearHold()
      return
    }
    if (holdRef.current?.id === id) return

    clearHold()
    const timer = window.setTimeout(() => {
      holdRef.current = null
      playInTuneChime()
      setTunedIds((currentIds) => {
        if (currentIds.has(id)) return currentIds
        const nextIds = new Set(currentIds)
        nextIds.add(id)
        return nextIds
      })
    }, STICKY_HOLD_MS)
    holdRef.current = { id, timer }
  }, [activeString, instrumentMode, live, rawCents, tunedIds])

  useEffect(() => {
    return () => {
      if (holdRef.current) {
        window.clearTimeout(holdRef.current.timer)
        holdRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!instrumentMode || !allStringsSticky(strings, tunedIds)) {
      if (!demo.glow) celebratedRef.current = false
      return
    }
    if (celebratedRef.current) return
    celebratedRef.current = true
    playAllTunedSting()
    setCelebrate(true)
    if (demo.glow) return
    const timer = window.setTimeout(() => setCelebrate(false), 2800)
    return () => window.clearTimeout(timer)
  }, [demo.glow, instrumentMode, strings, tunedIds])

  const displayCents = rawCents
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
        <div className="mx-auto w-max">
          <A4ReferenceControl a4Hz={a4Hz} onChange={setA4Hz} />
        </div>

        <div className="mt-2">
          <button
            type="button"
            data-tuning-change
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#141A28] px-4 py-2.5 text-left"
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

        <div
          className="mt-2 flex flex-wrap items-center justify-between gap-2"
          data-tuner-page-controls
        >
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            Auto strings
            <SettingSwitch label="Auto strings" on={autoString} onChange={setAutoString} />
          </label>
          {isTwelveString(activeInstrument, current.strings.length) ? (
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Split
            </p>
          ) : (
            <LayoutStylePill
              layoutMode={layoutMode}
              onToggle={() => setLayoutMode((mode) => (mode === 'inline' ? 'headstock' : 'inline'))}
            />
          )}
        </div>
        <InputPicker />

        <section
          className={cn(
            'relative mt-2 flex min-h-0 flex-1 flex-col items-center overflow-x-hidden rounded-3xl border px-3 py-2 sm:px-6 sm:py-4',
            celebrate
              ? 'omni-all-tuned-screen border-emerald-300/80 bg-emerald-500/16'
              : inTune && live
                ? 'border-emerald-400/50 bg-emerald-500/10'
                : 'border-white/10 bg-[#141A28]/80',
          )}
          aria-live="polite"
          data-tuner-status={status}
          data-tuner-gesture={needsGesture ? 'needed' : 'ready'}
          data-all-tuned={celebrate ? '1' : '0'}
          data-tuned-count={tunedIds.size}
        >
          {instrumentMode ? (
            <div
              className={cn(
                'relative w-full',
                celebrate && (demo.glow ? 'omni-all-tuned-hold' : 'omni-all-tuned'),
              )}
            >
              {celebrate ? (
                <div className="omni-all-tuned-veil" aria-hidden data-all-tuned-veil />
              ) : null}
              <div className="relative z-10">
                <Headstock
                  strings={strings}
                  config={activeInstrument}
                  selectedId={activeString?.id ?? null}
                  tunedIds={tunedIds}
                  inTune={inTune}
                  live={live}
                  onTapPeg={(string) => {
                    playReferenceTone(midiToFreq(string.midi, a4Hz), family.id)
                    const index = strings.findIndex((item) => item.id === string.id)
                    if (index >= 0) setFocusIndex(index)
                    if (autoString) setAutoId(string.id)
                    setTunedIds((currentIds) => {
                      if (!currentIds.has(string.id)) return currentIds
                      const nextIds = new Set(currentIds)
                      nextIds.delete(string.id)
                      return nextIds
                    })
                    if (holdRef.current?.id === string.id) {
                      window.clearTimeout(holdRef.current.timer)
                      holdRef.current = null
                    }
                  }}
                  layoutMode={layoutMode}
                />
              </div>
            </div>
          ) : (
            <p className="w-full text-center text-sm leading-6 text-slate-500">
              Listening for the nearest note. Set the reference with A4 above.
            </p>
          )}

          <div className="mt-1.5 flex w-full flex-col items-center">
            <NoteDisplay
              live={live}
              inTune={inTune}
              sharpName={
                instrumentMode && activeString
                  ? activeString.label
                  : (reading?.sharpName ?? (demo.cents !== null ? demo.sharpName : undefined))
              }
              flatName={
                instrumentMode && activeString
                  ? activeString.label
                  : (reading?.flatName ?? (demo.cents !== null ? demo.flatName : undefined))
              }
              isNatural={
                instrumentMode && activeString
                  ? !/[♯#♭b]/.test(activeString.label)
                  : (reading?.isNatural ?? (demo.cents !== null ? demo.isNatural : undefined))
              }
              octave={
                instrumentMode && activeString
                  ? activeString.octave
                  : (reading?.octave ?? (demo.cents !== null ? demo.octave : undefined))
              }
              target={
                instrumentMode && activeString
                  ? `${activeString.label}${activeString.octave} · ${activeString.stringNo}${ordinal(activeString.stringNo)}`
                  : null
              }
            />

            <p
              className={cn(
                'mt-0.5 text-sm font-semibold tabular-nums sm:text-base',
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

            <div className="mt-1.5 w-full max-w-md">
              <TunerTarget
                cents={displayCents}
                inTune={inTune}
                active={live}
              />
            </div>
          </div>

          <p
            className={cn(
              'mt-2 text-center text-xs leading-5 sm:min-h-8 sm:text-sm sm:leading-6',
              needsGesture || status === 'denied' ? 'text-slate-500' : 'text-slate-400',
            )}
          >
            {statusMessage(status, live, instrumentMode, autoString, needsGesture)}
          </p>
          <div className="w-full">
            {showDebug ? <TunerDebugOverlay debug={debug} /> : null}
          </div>
        </section>
      </div>

      <TuningSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        current={current}
        instrumentId={activeInstrument}
        customs={customPresets}
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
        <div className="text-[2.15rem] font-extrabold leading-none tracking-tight text-white/25 sm:text-5xl">
          —
        </div>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Waiting for a note</p>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div
        className={cn(
          'relative inline-flex items-start text-[2.15rem] font-extrabold leading-none tracking-tight sm:text-5xl',
          inTune ? 'text-emerald-300' : 'text-white',
        )}
      >
        {sharpName}
        <span className="ml-1 align-super text-lg font-semibold text-slate-400 sm:text-2xl">
          {octave}
        </span>
        {inTune ? (
          <span className="omni-in-tune-pop absolute -right-8 top-1 flex size-7 items-center justify-center rounded-full bg-emerald-400 text-[#06281c] sm:-right-9">
            <Check className="size-4 stroke-[3]" />
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">
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
  const shown = formatTenths(cents)
  const vs = targetLabel ? ` of ${targetLabel}` : ''
  const lock = inTune ? ' · in tune' : ''
  const tenths = Math.round(cents * 10) / 10
  if (tenths > 0) return `${shown} cents sharp${lock}${vs}`
  if (tenths < 0) return `${shown} cents flat${lock}${vs}`
  return `${shown} cents${lock}${vs}`
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
    return 'Auto is listening for the nearest string in this tuning. Tap a peg to hear it. Turn Auto off in Settings to lock one string.'
  }
  return instrumentMode
    ? 'Auto is off in Settings. The red peg is locked — play that string, or tap another peg to change the target.'
    : 'Play a steady note. The needle follows true cents; green lock is ±1.0 ¢ and never hides the number.'
}

function ordinal(value: number): string {
  if (value === 1) return 'st'
  if (value === 2) return 'nd'
  if (value === 3) return 'rd'
  return 'th'
}

function readTunerDemo(): {
  cents: number | null
  sharpName: string
  flatName: string
  isNatural: boolean
  octave: number
  glow: boolean
} {
  if (typeof window === 'undefined') {
    return {
      cents: null,
      sharpName: 'A',
      flatName: 'A',
      isNatural: true,
      octave: 4,
      glow: false,
    }
  }
  const query = new URLSearchParams(window.location.search)
  const glow = query.get('glow') === '1'
  const raw = query.get('cents')
  if (raw == null || raw === '') {
    return {
      cents: null,
      sharpName: 'A',
      flatName: 'A',
      isNatural: true,
      octave: 4,
      glow,
    }
  }
  const cents = Number(raw)
  if (!Number.isFinite(cents)) {
    return {
      cents: null,
      sharpName: 'A',
      flatName: 'A',
      isNatural: true,
      octave: 4,
      glow,
    }
  }
  const sharpName = (query.get('note') || 'A').slice(0, 2)
  const octaveRaw = Number(query.get('oct') || 4)
  return {
    cents,
    sharpName,
    flatName: sharpName,
    isNatural: !/[♯#♭b]/.test(sharpName),
    octave: Number.isFinite(octaveRaw) ? octaveRaw : 4,
    glow,
  }
}
