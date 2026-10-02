import { RotateCcw, Trash2, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { createPortal } from 'react-dom'

import { DrumPadIcon } from '@/components/rhythm/DrumPadIcon'
import { Button } from '@/components/ui/button'
import {
  usePlayhead,
  type PlayheadStore,
  type TransportClock,
} from '@/hooks/useRhythmEngine'
import { preparePlaybackFromGesture } from '@/lib/audio-context'
import {
  DRUM_PAD_SLOTS,
  QUANTIZE_CHIPS,
  offsetInBar,
  placeQuantizedHit,
  requantizePassTo,
  saveRecordClick,
  usedVoicesInPatterns,
  voiceForRecorderKey,
  type PassHit,
  type QuantizeId,
  type RecordMode,
} from '@/lib/drum-recorder'
import {
  cloneBar,
  emptyPattern,
  meterLabel,
  patternToGrid,
  stepsInBar,
  VOICE_LABELS,
  type RhythmBar,
  type SubdivisionId,
  type VoiceId,
} from '@/lib/rhythm'
import { cn } from '@/lib/utils'

export type DrumRecorderDemo = {
  recording?: boolean
  countIn?: boolean
  countBeat?: number
  keysOn?: boolean
  pass?: number
  mode?: RecordMode
  hits?: ReadonlyArray<{ voice: VoiceId; step: number }>
  barIndex?: number
}

type DrumRecorderSheetProps = {
  open: boolean
  onClose: () => void
  bars: readonly RhythmBar[]
  barIndex: number
  bpm: number
  beatName: string
  recording: boolean
  playing: boolean
  playheadStore: PlayheadStore
  getClock: () => TransportClock
  onChangeBar: (index: number, next: RhythmBar) => void
  onReplaceBars: (bars: RhythmBar[]) => void
  onToggleRecord: () => void
  onPreview: (voice: VoiceId) => void
  onLoopRef: MutableRefObject<(() => void) | null>
  countIn: boolean
  onCountIn: (value: boolean) => void
  clickOn: boolean
  onClickOn: (value: boolean) => void
  demo?: DrumRecorderDemo
}

/** Pointer-first tap. Survives iOS ghost-click suppression and ignores the leftover click. */
let lastPressAt = 0

function press(handler: () => void) {
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      lastPressAt = performance.now()
      handler()
    },
    onClick: (event: ReactMouseEvent<HTMLElement>) => {
      if (event.detail !== 0 || performance.now() - lastPressAt < 500) {
        event.preventDefault()
        return
      }
      handler()
    },
  }
}

export function DrumRecorderSheet({
  open,
  onClose,
  bars,
  barIndex,
  bpm,
  beatName,
  recording,
  playing,
  playheadStore,
  getClock,
  onChangeBar,
  onReplaceBars,
  onToggleRecord,
  onPreview,
  onLoopRef,
  countIn,
  onCountIn,
  clickOn,
  onClickOn,
  demo,
}: DrumRecorderSheetProps) {
  const playhead = usePlayhead(playheadStore)
  const barsCount = bars.length
  const shownBarIndex = Math.min(
    barsCount - 1,
    Math.max(0, demo?.barIndex ?? (recording && playing ? playhead.bar : barIndex)),
  )
  const bar = bars[shownBarIndex] ?? bars[0]
  const [mode, setMode] = useState<RecordMode>(demo?.mode ?? 'overdub')
  const [quantize, setQuantize] = useState<QuantizeId>('smart')
  const [keysOn, setKeysOn] = useState(() => demo?.keysOn ?? true)
  const [pass, setPass] = useState(demo?.pass ?? 1)
  const [lit, setLit] = useState<Partial<Record<VoiceId, number>>>(() => {
    const next: Partial<Record<VoiceId, number>> = {}
    for (const hit of demo?.hits ?? []) next[hit.voice] = 1
    return next
  })
  const [prompt, setPrompt] = useState<null | { subdivision: SubdivisionId }>(null)
  const [clearAsk, setClearAsk] = useState(false)
  const [freshAt, setFreshAt] = useState<Partial<Record<VoiceId, number>>>({})
  const knownLanes = useRef<Set<VoiceId>>(new Set())
  const held = useRef(new Set<VoiceId>())
  const thisPass = useRef<PassHit[]>([])
  const touched = useRef(new Map<number, Set<VoiceId>>())
  const undoStack = useRef<RhythmBar[][]>([])
  const passStart = useRef<RhythmBar[]>(bars.map(cloneBar))
  const overlayRef = useRef<HTMLDivElement>(null)
  const barsRef = useRef(bars)
  barsRef.current = bars
  const barRef = useRef(bar)
  barRef.current = bar
  const shownRef = useRef(shownBarIndex)
  shownRef.current = shownBarIndex

  const liveRecording = recording || Boolean(demo?.recording)
  const countOverlay = Boolean(demo?.countIn) || (recording && playhead.precount)
  const countBeat = demo?.countBeat ?? (playhead.precount ? playhead.beat + 1 : 0)

  const demoPassSteps = useMemo(() => {
    const map = new Map<VoiceId, Set<number>>()
    for (const hit of demo?.hits ?? []) {
      const set = map.get(hit.voice) ?? new Set<number>()
      set.add(hit.step)
      map.set(hit.voice, set)
    }
    return map
  }, [demo?.hits])

  const thisPassSteps = useMemo(() => {
    const map = new Map<VoiceId, Set<number>>()
    for (const hit of thisPass.current) {
      if ((hit.barIndex ?? shownBarIndex) !== shownBarIndex) continue
      if (!bar || hit.subdivision !== bar.subdivision) continue
      const set = map.get(hit.voice) ?? new Set<number>()
      set.add(hit.step)
      map.set(hit.voice, set)
    }
    for (const [voice, steps] of demoPassSteps) {
      const set = map.get(voice) ?? new Set<number>()
      for (const step of steps) set.add(step)
      map.set(voice, set)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bar, demoPassSteps, liveRecording, pass, lit, shownBarIndex])

  const glow = useCallback((voice: VoiceId) => {
    const token = Date.now()
    setLit((current) => ({ ...current, [voice]: token }))
    window.setTimeout(() => {
      setLit((current) => (current[voice] === token ? { ...current, [voice]: 0 } : current))
    }, 160)
  }, [])

  const revealLane = useCallback((voice: VoiceId) => {
    if (knownLanes.current.has(voice)) return
    knownLanes.current.add(voice)
    const token = Date.now()
    setFreshAt((current) => ({ ...current, [voice]: token }))
    window.setTimeout(() => {
      setFreshAt((current) => (current[voice] === token ? { ...current, [voice]: 0 } : current))
    }, 2400)
  }, [])

  const strike = useCallback(
    (voice: VoiceId) => {
      preparePlaybackFromGesture()
      onPreview(voice)
      glow(voice)
      revealLane(voice)
      if (!recording || getClock().precount) return

      const clock = getClock()
      const targetIndex = clock.barIndex
      const current = barsRef.current[targetIndex]
      if (!current || !(clock.barDur > 0)) return
      const offset = offsetInBar(clock.captureTime, clock.barStart, clock.barDur)
      const raws = thisPass.current
        .filter((hit) => (hit.barIndex ?? targetIndex) === targetIndex)
        .map((hit) => hit.offsetSec)
        .concat(offset)
      const voices = touched.current.get(targetIndex) ?? new Set<VoiceId>()
      const placed = placeQuantizedHit(
        current,
        offset,
        clock.barDur,
        quantize,
        voice,
        mode,
        voices,
        raws,
      )
      touched.current.set(targetIndex, placed.voicesTouched)
      thisPass.current = [...thisPass.current, { ...placed.hit, barIndex: targetIndex }]
      barRef.current = placed.bar
      onChangeBar(targetIndex, placed.bar)
      if (placed.offerTriplets) setPrompt({ subdivision: placed.tripletSubdivision })
    },
    [getClock, glow, mode, onChangeBar, onPreview, quantize, recording, revealLane],
  )

  const beginPass = useCallback(() => {
    passStart.current = barsRef.current.map(cloneBar)
    thisPass.current = []
    touched.current = new Map()
  }, [])

  useEffect(() => {
    if (!open) return
    knownLanes.current = new Set(usedVoicesInPatterns(barsRef.current.map((item) => item.pattern)))
    setFreshAt({})
  }, [open])

  useEffect(() => {
    if (!recording) return
    beginPass()
  }, [beginPass, recording])

  const onLoop = useCallback(() => {
    if (!recording) return
    undoStack.current = [...undoStack.current, passStart.current.map(cloneBar)]
    setPass((n) => n + 1)
    beginPass()
  }, [beginPass, recording])

  useEffect(() => {
    onLoopRef.current = onLoop
    return () => {
      if (onLoopRef.current === onLoop) onLoopRef.current = null
    }
  }, [onLoop, onLoopRef])

  useEffect(() => {
    if (!open) return
    const frame = document.querySelector<HTMLElement>('[data-app-frame]')
    const html = document.documentElement
    const body = document.body
    const prev = {
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      framePointer: frame?.style.pointerEvents ?? '',
    }
    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    if (frame) {
      frame.setAttribute('inert', '')
      frame.setAttribute('aria-hidden', 'true')
      frame.style.pointerEvents = 'none'
    }
    return () => {
      body.style.overflow = prev.bodyOverflow
      html.style.overflow = prev.htmlOverflow
      html.style.overscrollBehavior = prev.htmlOverscroll
      if (frame) {
        frame.removeAttribute('inert')
        frame.removeAttribute('aria-hidden')
        frame.style.pointerEvents = prev.framePointer
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const blockOutside = (event: Event) => {
      const root = overlayRef.current
      const node = event.target
      if (root && node instanceof Node && root.contains(node)) return
      event.preventDefault()
      event.stopPropagation()
    }
    const opts: AddEventListenerOptions = { capture: true, passive: false }
    document.addEventListener('pointerdown', blockOutside, opts)
    document.addEventListener('touchstart', blockOutside, opts)
    document.addEventListener('click', blockOutside, opts)
    return () => {
      document.removeEventListener('pointerdown', blockOutside, opts)
      document.removeEventListener('touchstart', blockOutside, opts)
      document.removeEventListener('click', blockOutside, opts)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const root = overlayRef.current
    if (!root) return
    const blockGhost = (event: TouchEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-drum-pad]')) {
        event.preventDefault()
        return
      }
      if (target === root) event.preventDefault()
    }
    root.addEventListener('touchstart', blockGhost, { passive: false })
    return () => root.removeEventListener('touchstart', blockGhost)
  }, [open])

  const undoPass = useCallback(() => {
    const prev = undoStack.current.pop()
    const snapshot = prev ?? passStart.current
    setPass((n) => (prev ? Math.max(1, n - 1) : n))
    thisPass.current = []
    touched.current = new Map()
    passStart.current = snapshot.map(cloneBar)
    onReplaceBars(snapshot.map(cloneBar))
  }, [onReplaceBars])

  const clearBar = () => {
    if (!bar) return
    undoStack.current = [...undoStack.current, barsRef.current.map(cloneBar)]
    const next = cloneBar(bar)
    next.pattern = emptyPattern()
    thisPass.current = thisPass.current.filter((hit) => (hit.barIndex ?? shownBarIndex) !== shownBarIndex)
    touched.current.delete(shownBarIndex)
    onChangeBar(shownBarIndex, next)
    setClearAsk(false)
  }

  useEffect(() => {
    if (!open) return
    const down = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        onToggleRecord()
        return
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        setMode((current) => (current === 'overdub' ? 'replace' : 'overdub'))
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undoPass()
        return
      }
      const voice = voiceForRecorderKey(event)
      if (!voice) return
      if (held.current.has(voice)) return
      event.preventDefault()
      held.current.add(voice)
      strike(voice)
    }
    const up = (event: KeyboardEvent) => {
      const voice = voiceForRecorderKey(
        Object.assign(event, { repeat: false }) as KeyboardEvent,
      )
      if (voice) held.current.delete(voice)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      held.current.clear()
    }
  }, [onClose, onToggleRecord, open, strike, undoPass])

  if (!open || !bar) return null

  const extraVoices = new Set<VoiceId>([
    ...thisPass.current.map((hit) => hit.voice),
    ...thisPassSteps.keys(),
    ...(touched.current.get(shownBarIndex) ?? []),
    ...(Object.entries(freshAt)
      .filter(([, token]) => token)
      .map(([voice]) => voice) as VoiceId[]),
  ])
  const rows = usedVoicesInPatterns(
    bars.map((item) => item.pattern),
    extraVoices,
  )
  const steps = stepsInBar(bar)
  const grid = patternToGrid(bar.pattern, bar.beats, bar.subdivision)
  const meter = meterLabel(bar.beats, bar.beatUnit)
  const looping = playing && !playhead.precount
  const countBeatNumber = Math.max(1, countBeat)

  const captureBackdrop = (event: ReactPointerEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    event.stopPropagation()
  }

  const sheet = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[90] flex items-stretch justify-center bg-black/70 p-0 rec-wide:items-center rec-wide:p-4"
      data-drum-recorder
      data-drum-recorder-backdrop
      data-recording={liveRecording ? '1' : '0'}
      data-bars-count={barsCount}
      onPointerDown={captureBackdrop}
      onTouchStart={captureBackdrop}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drum-recorder-title"
        className="flex h-[100svh] max-h-[100svh] w-full max-w-lg flex-col overflow-hidden rounded-none border-0 bg-[#0F1422] pb-[max(0.4rem,env(safe-area-inset-bottom,0px))] rec-wide:h-auto rec-wide:max-h-[min(90svh,52rem)] rec-wide:rounded-3xl rec-wide:border rec-wide:border-white/10 rec-wide:pb-0"
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="drum-recorder-title" className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Record beat
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {beatName} · Bar {shownBarIndex + 1} of {barsCount} · {bpm} BPM · {meter}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="hidden items-center gap-2 text-xs font-semibold text-slate-300 rec-wide:flex">
              Keys on
              <button
                type="button"
                role="switch"
                aria-checked={keysOn}
                data-keys-on={keysOn ? '1' : '0'}
                {...press(() => setKeysOn((on) => !on))}
                className={cn(
                  'inline-flex h-7 w-12 items-center rounded-full p-0.5',
                  keysOn ? 'justify-end bg-[#A855F7]' : 'justify-start bg-white/15',
                )}
              >
                <span className="block size-6 rounded-full bg-white" />
              </button>
            </label>
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-full px-4"
              data-recorder-done
              {...press(onClose)}
            >
              Done
            </Button>
            <button
              type="button"
              aria-label="Close recorder"
              className="hidden size-9 items-center justify-center rounded-full border border-white/12 text-slate-300 rec-wide:flex"
              {...press(onClose)}
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div data-rec-body className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-2 sm:px-5 sm:pb-3">
          <div data-rec-controls className="flex shrink-0 flex-col gap-2">
            <TransportCard
              recording={liveRecording}
              pass={pass}
              mode={mode}
              barIndex={shownBarIndex}
              barsCount={barsCount}
              beat={
                demo?.hits && demo.hits.length > 0
                  ? Math.floor(demo.hits[0].step / Math.max(1, steps / Math.max(1, bar.beats)))
                  : looping
                    ? playhead.beat
                    : -1
              }
              step={playhead.step}
              steps={steps}
              beats={bar.beats}
              precount={countOverlay}
              countBeat={countBeatNumber}
              onToggleRecord={onToggleRecord}
              onUndo={undoPass}
              onClear={() => setClearAsk(true)}
            />

            <div className="flex flex-wrap items-center gap-2">
              <ModeSwitch mode={mode} onChange={setMode} />
              <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5">
                <RecChip
                  label="Click"
                  testId="record-click"
                  on={clickOn}
                  onChange={(next) => {
                    onClickOn(next)
                    saveRecordClick(next)
                  }}
                  icon={<ClickGlyph />}
                />
                <RecChip
                  label="Count-in"
                  testId="count-in"
                  on={countIn}
                  onChange={onCountIn}
                  icon={<CountGlyph />}
                />
              </div>
            </div>

            <div className="flex flex-nowrap items-center gap-1 overflow-x-auto" data-quantize={quantize}>
              <p className="mr-0.5 shrink-0 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Quantize
              </p>
              {QUANTIZE_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  data-quantize-chip={chip.id}
                  {...press(() => setQuantize(chip.id))}
                  className={cn(
                    'h-7 shrink-0 rounded-full px-2 text-[0.7rem] font-semibold',
                    quantize === chip.id
                      ? 'bg-[#A855F7] text-white'
                      : 'border border-white/12 bg-white/4 text-slate-300',
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {prompt ? (
              <div
                data-triplet-prompt
                className="rounded-2xl border border-[#A855F7]/40 bg-[#A855F7]/10 px-3 py-2 text-sm text-slate-200"
              >
                This pass fits triplets better. Switch this bar to a triplet grid?
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    {...press(() => {
                      const rebuilt = requantizePassTo(
                        passStart.current[shownBarIndex] ?? bar,
                        thisPass.current.filter((hit) => (hit.barIndex ?? shownBarIndex) === shownBarIndex),
                        getClock().barDur || 2,
                        prompt.subdivision,
                        mode,
                      )
                      thisPass.current = [
                        ...thisPass.current.filter((hit) => (hit.barIndex ?? shownBarIndex) !== shownBarIndex),
                        ...rebuilt.hits.map((hit) => ({ ...hit, barIndex: shownBarIndex })),
                      ]
                      barRef.current = rebuilt.bar
                      onChangeBar(shownBarIndex, rebuilt.bar)
                      setPrompt(null)
                    })}
                  >
                    Switch
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    {...press(() => setPrompt(null))}
                  >
                    Keep current
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <MiniLoopGrid
            barIndex={shownBarIndex}
            barsCount={barsCount}
            beats={bar.beats}
            rows={rows}
            steps={steps}
            grid={grid}
            thisPass={thisPassSteps}
            freshAt={freshAt}
            playheadStep={
              demo?.hits && demo.hits.length > 0
                ? demo.hits[0].step
                : playing && !playhead.precount
                  ? playhead.step
                  : -1
            }
          />

          <div data-pad-wrap className="shrink-0">
            <PadGrid keysOn={keysOn} lit={lit} onStrike={strike} />
          </div>

          <div className="hidden shrink-0 flex-wrap gap-1.5 text-[0.7rem] text-slate-500 rec-wide:flex">
            <KeyHint keys="Enter" label="Rec / Stop" />
            <KeyHint keys="Tab" label="Overdub / Replace" />
            <KeyHint keys="Cmd/Ctrl Z" label="Undo pass" />
            <KeyHint keys="Esc" label="Done" />
          </div>
        </div>
      </div>

      {clearAsk ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141A28] p-4">
            <p className="text-base font-semibold text-white">Clear this bar?</p>
            <p className="mt-1 text-sm text-slate-400">
              Every hit in the current bar will be removed. You can undo the last pass afterward.
            </p>
            <div className="mt-4 flex gap-2">
              <Button type="button" className="flex-1" {...press(clearBar)}>
                Clear
              </Button>
              <Button type="button" variant="outline" className="flex-1" {...press(() => setClearAsk(false))}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )

  return createPortal(sheet, document.body)
}

function TransportCard({
  recording,
  pass,
  mode,
  barIndex,
  barsCount,
  beat,
  step,
  steps,
  beats,
  precount,
  countBeat,
  onToggleRecord,
  onUndo,
  onClear,
}: {
  recording: boolean
  pass: number
  mode: RecordMode
  barIndex: number
  barsCount: number
  beat: number
  step: number
  steps: number
  beats: number
  precount: boolean
  countBeat: number
  onToggleRecord: () => void
  onUndo: () => void
  onClear: () => void
}) {
  const progress = precount || beat < 0 || steps < 1 ? 0 : Math.min(1, (step + 0.5) / steps)
  const shownCount = Math.max(1, countBeat)
  return (
    <div
      data-recorder-transport
      data-count-in-active={precount ? '1' : '0'}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141A28] px-3 py-2"
    >
      <button
        type="button"
        data-recorder-rec
        aria-label={recording ? 'Stop recording' : 'Start recording'}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          preparePlaybackFromGesture()
          onToggleRecord()
        }}
        className={cn(
          'relative flex size-12 shrink-0 items-center justify-center rounded-full bg-[#FF2D55] text-white shadow-[0_0_24px_rgba(255,45,85,0.45)] sm:size-14',
          recording && 'omni-rec-pulse',
        )}
      >
        {recording ? (
          <span className="size-4 rounded-sm bg-white" />
        ) : (
          <span className="size-4 rounded-full bg-white" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-count-in-pill={precount ? String(shownCount) : undefined}
            className="inline-flex items-center gap-1 rounded-full bg-[#FF2D55]/15 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#FF4D6D]"
          >
            <span className={cn('size-1.5 rounded-full bg-[#FF4D6D]', precount && 'omni-count-dot')} />
            {precount ? `Count-in ${shownCount}` : 'Rec'}
          </span>
          {precount ? (
            <span data-count-beats className="inline-flex items-center gap-1" aria-hidden>
              {Array.from({ length: Math.max(1, beats) }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    'size-1.5 rounded-full',
                    index === shownCount - 1
                      ? 'bg-white omni-count-dot'
                      : index < shownCount - 1
                        ? 'bg-[#FF4D6D]'
                        : 'bg-white/20',
                  )}
                />
              ))}
            </span>
          ) : null}
          <span className="text-sm font-semibold text-white">
            Pass {pass} · {mode === 'overdub' ? 'Overdub' : 'Replace'}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400" data-rec-bar={`${barIndex + 1}/${barsCount}`}>
          Bar {barIndex + 1} of {barsCount} · Beat {precount ? shownCount : beat >= 0 ? beat + 1 : '—'}
          {recording && !precount ? ' · looping' : precount ? ' · count-in' : ''}
        </p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#FF4D6D]"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          type="button"
          aria-label="Undo pass"
          {...press(onUndo)}
          className="flex size-9 items-center justify-center rounded-full border border-white/12 text-slate-300"
        >
          <RotateCcw className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Clear bar"
          {...press(onClear)}
          className="flex size-9 items-center justify-center rounded-full border border-white/12 text-slate-300"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}

function MiniLoopGrid({
  barIndex,
  barsCount,
  beats,
  rows,
  steps,
  grid,
  thisPass,
  freshAt,
  playheadStep,
}: {
  barIndex: number
  barsCount: number
  beats: number
  rows: VoiceId[]
  steps: number
  grid: Record<VoiceId, boolean[]>
  thisPass: Map<VoiceId, Set<number>>
  freshAt: Partial<Record<VoiceId, number>>
  playheadStep: number
}) {
  const beatCount = Math.max(1, beats)
  return (
    <div
      data-rec-lanes
      data-mini-loop
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141A28]/80 px-3 py-2"
    >
      <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Loop · Bar {barIndex + 1} of {barsCount}
        </p>
        <p className="flex items-center gap-2 text-[0.6rem] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-[1px] bg-[#FF4D6D]" /> this pass
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-[1px] bg-[#A855F7]" /> earlier
          </span>
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className="mb-1 ml-[4.7rem] grid shrink-0 text-center text-[0.58rem] font-semibold text-slate-500"
          style={{ gridTemplateColumns: `repeat(${beatCount}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: beatCount }, (_, beat) => (
            <span key={beat}>{beat + 1}</span>
          ))}
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col gap-px overflow-hidden">
          {rows.map((voice) => {
            const isNew = Boolean(freshAt[voice])
            return (
              <div
                key={voice}
                data-lane={voice}
                data-lane-new={isNew ? '1' : '0'}
                className="flex min-h-[10px] max-h-7 min-w-0 flex-[1_1_22px] items-center gap-2"
              >
                <p className="flex w-[4.6rem] shrink-0 items-center gap-1 truncate text-[0.62rem] font-semibold text-slate-400">
                  <span className="truncate">{VOICE_LABELS[voice]}</span>
                  {isNew ? (
                    <span className="rounded bg-[#A855F7] px-1 py-px text-[0.52rem] font-bold uppercase tracking-wide text-white">
                      New
                    </span>
                  ) : null}
                </p>
                <div
                  className="grid h-full min-h-[10px] min-w-0 flex-1"
                  style={{ gridTemplateColumns: `repeat(${Math.max(1, steps)}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: Math.max(1, steps) }, (_, step) => {
                    const passHit = thisPass.get(voice)?.has(step)
                    const earlier = Boolean(grid[voice]?.[step]) && !passHit
                    return (
                      <span
                        key={step}
                        data-mini-cell={`${voice}:${step}`}
                        className={cn(
                          'mx-[1px] h-full min-h-[10px] rounded-[2px]',
                          passHit ? 'bg-[#FF4D6D]' : earlier ? 'bg-[#A855F7]' : 'bg-white/8',
                        )}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
          {playheadStep >= 0 ? (
            <span
              data-mini-playhead
              className="pointer-events-none absolute bottom-0 top-0 w-px bg-white/80"
              style={{ left: `calc(4.7rem + ((${playheadStep + 0.5} / ${Math.max(1, steps)}) * (100% - 4.7rem)))` }}
            />
          ) : null}
        </div>
      </div>
      <p className="mt-1.5 shrink-0 truncate text-center text-[0.62rem] text-slate-600">
        + a lane appears the first time you hit a new drum
      </p>
    </div>
  )
}

function RecChip({
  label,
  testId,
  on,
  onChange,
  icon,
}: {
  label: string
  testId: string
  on: boolean
  onChange: (value: boolean) => void
  icon: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-count-in={testId === 'count-in' ? (on ? '1' : '0') : undefined}
      data-record-click={testId === 'record-click' ? (on ? '1' : '0') : undefined}
      {...press(() => onChange(!on))}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold',
        on ? 'border-[#A855F7] bg-[#A855F7]/18 text-white' : 'border-white/12 bg-white/4 text-slate-400',
      )}
    >
      {icon}
      {label}
      <span className={cn('size-1.5 rounded-full', on ? 'bg-[#A855F7]' : 'bg-white/25')} />
    </button>
  )
}

function ClickGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="4.5" y="2.5" width="7" height="11" rx="1.4" />
      <path d="M8 5.5v3.2l2 1.2" />
    </svg>
  )
}

function CountGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="2.5" y="4" width="3.2" height="8" rx="0.8" />
      <rect x="6.4" y="4" width="3.2" height="8" rx="0.8" />
      <rect x="10.3" y="4" width="3.2" height="8" rx="0.8" />
    </svg>
  )
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: RecordMode
  onChange: (mode: RecordMode) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Record mode"
      className="grid min-w-[9.5rem] grid-cols-2 rounded-full bg-white/6 p-1 ring-1 ring-white/10"
    >
      {(['overdub', 'replace'] as const).map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          data-record-mode={id}
          {...press(() => onChange(id))}
          className={cn(
            'h-8 rounded-full px-3 text-xs font-semibold',
            mode === id ? 'bg-[#A855F7] text-white' : 'text-slate-400',
          )}
        >
          {id === 'overdub' ? 'Overdub' : 'Replace'}
        </button>
      ))}
    </div>
  )
}

function PadGrid({
  keysOn,
  lit,
  onStrike,
}: {
  keysOn: boolean
  lit: Partial<Record<VoiceId, number>>
  onStrike: (voice: VoiceId) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const block = (event: TouchEvent) => {
      event.preventDefault()
    }
    root.addEventListener('touchstart', block, { passive: false })
    return () => root.removeEventListener('touchstart', block)
  }, [])
  return (
    <div ref={rootRef} data-pad-grid>
      {DRUM_PAD_SLOTS.map((slot, index) =>
        slot ? (
          <DrumPad
            key={slot.voice}
            voice={slot.voice}
            label={slot.label}
            keyCap={slot.key}
            keysOn={keysOn}
            active={Boolean(lit[slot.voice])}
            onStrike={onStrike}
          />
        ) : (
          <div key={`spare-${index}`} data-pad-spare className="rec-pad-spare" />
        ),
      )}
    </div>
  )
}

function DrumPad({
  voice,
  label,
  keyCap,
  keysOn,
  active,
  onStrike,
}: {
  voice: VoiceId
  label: string
  keyCap: string | readonly string[]
  keysOn: boolean
  active: boolean
  onStrike: (voice: VoiceId) => void
}) {
  const caps = Array.isArray(keyCap) ? keyCap : [keyCap]
  const lastAt = useRef(0)
  const strikeOnce = () => {
    const now = performance.now()
    if (now - lastAt.current < 40) return
    lastAt.current = now
    onStrike(voice)
  }
  const hit = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    strikeOnce()
  }
  return (
    <button
      type="button"
      data-drum-pad={voice}
      data-pad-active={active ? '1' : '0'}
      onPointerDown={hit}
      onTouchStart={(event) => {
        event.preventDefault()
        event.stopPropagation()
        strikeOnce()
      }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        'relative flex select-none flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#141A28] text-[#E9D5FF] [touch-action:none]',
        active && 'omni-pad-hit border-[#A855F7] bg-[#A855F7]/20 text-white',
      )}
    >
      {active ? <span className="omni-pad-ripple" /> : null}
      {keysOn ? (
        <span className="absolute left-1 top-1 hidden gap-0.5 rec-wide:flex">
          {caps.map((cap) => (
            <span
              key={cap}
              className="rounded bg-white/10 px-1 py-px text-[0.5rem] font-bold uppercase tracking-wide text-slate-300"
            >
              {cap}
            </span>
          ))}
        </span>
      ) : null}
      <DrumPadIcon voice={voice} className="size-6" />
      <span className="mt-0.5 text-[0.62rem] font-semibold leading-none text-slate-200">{label}</span>
    </button>
  )
}

function KeyHint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5">
      <kbd className="font-semibold text-slate-300">{keys}</kbd>
      <span>{label}</span>
    </span>
  )
}
