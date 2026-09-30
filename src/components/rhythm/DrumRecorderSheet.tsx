import { RotateCcw, Trash2, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { DrumPadIcon } from '@/components/rhythm/DrumPadIcon'
import { Button } from '@/components/ui/button'
import {
  usePlayhead,
  type PlayheadStore,
  type TransportClock,
} from '@/hooks/useRhythmEngine'
import { preparePlaybackFromGesture } from '@/lib/audio-context'
import {
  DRUM_PADS,
  QUANTIZE_CHIPS,
  offsetInBar,
  placeQuantizedHit,
  requantizePassTo,
  usedVoices,
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
}

type DrumRecorderSheetProps = {
  open: boolean
  onClose: () => void
  bar: RhythmBar
  barIndex: number
  barsCount: number
  bpm: number
  beatName: string
  recording: boolean
  playing: boolean
  playheadStore: PlayheadStore
  getClock: () => TransportClock
  onChangeBar: (next: RhythmBar) => void
  onToggleRecord: () => void
  onPreview: (voice: VoiceId) => void
  onLoopRef: MutableRefObject<(() => void) | null>
  countIn: boolean
  onCountIn: (value: boolean) => void
  demo?: DrumRecorderDemo
}

export function DrumRecorderSheet({
  open,
  onClose,
  bar,
  barIndex,
  barsCount,
  bpm,
  beatName,
  recording,
  playing,
  playheadStore,
  getClock,
  onChangeBar,
  onToggleRecord,
  onPreview,
  onLoopRef,
  countIn,
  onCountIn,
  demo,
}: DrumRecorderSheetProps) {
  const playhead = usePlayhead(playheadStore)
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
  const held = useRef(new Set<VoiceId>())
  const thisPass = useRef<PassHit[]>([])
  const touched = useRef(new Set<VoiceId>())
  const undoStack = useRef<RhythmBar[]>([])
  const passStart = useRef(cloneBar(bar))
  const barRef = useRef(bar)
  barRef.current = bar

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
      if (hit.subdivision !== bar.subdivision) continue
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
  }, [bar, demoPassSteps, liveRecording, pass, lit])

  const glow = useCallback((voice: VoiceId) => {
    const token = Date.now()
    setLit((current) => ({ ...current, [voice]: token }))
    window.setTimeout(() => {
      setLit((current) => (current[voice] === token ? { ...current, [voice]: 0 } : current))
    }, 160)
  }, [])

  const strike = useCallback(
    (voice: VoiceId) => {
      preparePlaybackFromGesture()
      onPreview(voice)
      glow(voice)
      if (!recording || getClock().precount) return

      const clock = getClock()
      const current = barRef.current
      if (!(clock.barDur > 0)) return
      const offset = offsetInBar(clock.captureTime, clock.barStart, clock.barDur)
      const raws = thisPass.current.map((hit) => hit.offsetSec).concat(offset)
      const placed = placeQuantizedHit(
        current,
        offset,
        clock.barDur,
        quantize,
        voice,
        mode,
        touched.current,
        raws,
      )
      touched.current = placed.voicesTouched
      thisPass.current = [...thisPass.current, placed.hit]
      barRef.current = placed.bar
      onChangeBar(placed.bar)
      if (placed.offerTriplets) setPrompt({ subdivision: placed.tripletSubdivision })
    },
    [getClock, glow, mode, onChangeBar, onPreview, quantize, recording],
  )

  const beginPass = useCallback(() => {
    passStart.current = cloneBar(barRef.current)
    thisPass.current = []
    touched.current = new Set()
  }, [])

  useEffect(() => {
    if (!recording) return
    beginPass()
  }, [beginPass, recording])

  const onLoop = useCallback(() => {
    if (!recording) return
    undoStack.current = [...undoStack.current, cloneBar(passStart.current)]
    setPass((n) => n + 1)
    beginPass()
  }, [beginPass, recording])

  useEffect(() => {
    onLoopRef.current = onLoop
    return () => {
      if (onLoopRef.current === onLoop) onLoopRef.current = null
    }
  }, [onLoop, onLoopRef])

  const undoPass = useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) {
      onChangeBar(cloneBar(passStart.current))
      thisPass.current = []
      touched.current = new Set()
      return
    }
    setPass((n) => Math.max(1, n - 1))
    thisPass.current = []
    touched.current = new Set()
    passStart.current = cloneBar(prev)
    onChangeBar(cloneBar(prev))
  }, [onChangeBar])

  const clearBar = () => {
    undoStack.current = [...undoStack.current, cloneBar(barRef.current)]
    const next = cloneBar(barRef.current)
    next.pattern = emptyPattern()
    thisPass.current = []
    touched.current = new Set()
    onChangeBar(next)
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

  if (!open) return null

  const extraVoices = new Set<VoiceId>([...thisPassSteps.keys(), ...touched.current])
  const rows = usedVoices(bar.pattern, extraVoices)
  const steps = stepsInBar(bar)
  const grid = patternToGrid(bar.pattern, bar.beats, bar.subdivision)
  const meter = meterLabel(bar.beats, bar.beatUnit)
  const looping = playing && !playhead.precount

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 wide:items-center wide:p-4"
      data-drum-recorder
      data-recording={liveRecording ? '1' : '0'}
    >
      <div
        role="dialog"
        aria-labelledby="drum-recorder-title"
        className="flex max-h-[min(92svh,52rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.6rem] border border-white/10 bg-[#0F1422] pb-[max(0.6rem,env(safe-area-inset-bottom,0px))] wide:max-h-[min(90svh,46rem)] wide:max-w-[68rem] wide:rounded-3xl wide:pb-0"
      >
        <header className="flex items-start justify-between gap-3 px-4 pb-2 pt-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="drum-recorder-title" className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Record beat
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {beatName} · Bar {barIndex + 1}
              {barsCount > 1 ? ` of ${barsCount}` : ''} · {bpm} BPM · {meter}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="hidden items-center gap-2 text-xs font-semibold text-slate-300 wide:flex">
              Keys on
              <button
                type="button"
                role="switch"
                aria-checked={keysOn}
                data-keys-on={keysOn ? '1' : '0'}
                onClick={() => setKeysOn((on) => !on)}
                className={cn(
                  'inline-flex h-7 w-12 items-center rounded-full p-0.5',
                  keysOn ? 'justify-end bg-[#A855F7]' : 'justify-start bg-white/15',
                )}
              >
                <span className="block size-6 rounded-full bg-white" />
              </button>
            </label>
            <Button type="button" size="sm" className="h-9 rounded-full px-4" onClick={onClose}>
              Done
            </Button>
            <button
              type="button"
              aria-label="Close recorder"
              className="hidden size-9 items-center justify-center rounded-full border border-white/12 text-slate-300 wide:flex"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5 wide:grid wide:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] wide:gap-5">
          <div className="flex flex-col gap-3">
            <TransportCard
              recording={liveRecording}
              pass={pass}
              mode={mode}
              barIndex={barIndex}
              beat={looping ? playhead.beat : -1}
              step={playhead.step}
              steps={steps}
              precount={countOverlay}
              onToggleRecord={onToggleRecord}
              onUndo={undoPass}
              onClear={() => setClearAsk(true)}
            />

            <MiniLoopGrid
              barIndex={barIndex}
              beats={bar.beats}
              rows={rows}
              steps={steps}
              grid={grid}
              thisPass={thisPassSteps}
              playheadStep={
                demo?.hits && demo.hits.length > 0
                  ? demo.hits[0].step
                  : playing && !playhead.precount
                    ? playhead.step
                    : -1
              }
            />

            <div className="flex items-center gap-2">
              <ModeSwitch mode={mode} onChange={setMode} />
              <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-300">
                Count-in
                <button
                  type="button"
                  role="switch"
                  aria-checked={countIn}
                  data-count-in={countIn ? '1' : '0'}
                  onClick={() => onCountIn(!countIn)}
                  className={cn(
                    'inline-flex h-7 w-12 items-center rounded-full p-0.5',
                    countIn ? 'justify-end bg-[#A855F7]' : 'justify-start bg-white/15',
                  )}
                >
                  <span className="block size-6 rounded-full bg-white" />
                </button>
              </label>
            </div>

            <div>
              <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Quantize
              </p>
              <div className="flex flex-wrap gap-1.5" data-quantize={quantize}>
                {QUANTIZE_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    data-quantize-chip={chip.id}
                    onClick={() => setQuantize(chip.id)}
                    className={cn(
                      'h-8 rounded-full px-3 text-xs font-semibold',
                      quantize === chip.id
                        ? 'bg-[#A855F7] text-white'
                        : 'border border-white/12 bg-white/4 text-slate-300',
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
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
                    onClick={() => {
                      const rebuilt = requantizePassTo(
                        passStart.current,
                        thisPass.current,
                        getClock().barDur || 2,
                        prompt.subdivision,
                        mode,
                      )
                      thisPass.current = rebuilt.hits
                      barRef.current = rebuilt.bar
                      onChangeBar(rebuilt.bar)
                      setPrompt(null)
                    }}
                  >
                    Switch
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setPrompt(null)}>
                    Keep current
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="hidden flex-col gap-1.5 text-[0.7rem] text-slate-500 wide:flex">
              <p>Count-in (1 bar)</p>
              <div className="flex flex-wrap gap-1.5">
                <KeyHint keys="Enter" label="Rec / Stop" />
                <KeyHint keys="Tab" label="Overdub / Replace" />
                <KeyHint keys="⌘/Ctrl Z" label="Undo pass" />
                <KeyHint keys="Esc" label="Done" />
              </div>
            </div>
          </div>

          <div className="relative mt-3 wide:mt-0">
            <PadGrid keysOn={keysOn} lit={lit} onStrike={strike} />
            {countOverlay ? (
              <div
                data-count-in-overlay
                className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-[#070A12]/80 backdrop-blur-[2px]"
              >
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Count-in
                </p>
                <p className="text-[6.5rem] font-extrabold leading-none tabular-nums text-white">
                  {Math.max(1, countBeat)}
                </p>
                <p className="mt-1 text-sm text-slate-400">Recording starts on the 1</p>
              </div>
            ) : null}
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
              <Button type="button" className="flex-1" onClick={clearBar}>
                Clear
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => setClearAsk(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TransportCard({
  recording,
  pass,
  mode,
  barIndex,
  beat,
  step,
  steps,
  precount,
  onToggleRecord,
  onUndo,
  onClear,
}: {
  recording: boolean
  pass: number
  mode: RecordMode
  barIndex: number
  beat: number
  step: number
  steps: number
  precount: boolean
  onToggleRecord: () => void
  onUndo: () => void
  onClear: () => void
}) {
  const progress = precount || beat < 0 || steps < 1 ? 0 : Math.min(1, (step + 0.5) / steps)
  return (
    <div
      data-recorder-transport
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141A28] px-3 py-3"
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
          'relative flex size-16 shrink-0 items-center justify-center rounded-full bg-[#FF2D55] text-white shadow-[0_0_24px_rgba(255,45,85,0.45)]',
          recording && 'omni-rec-pulse',
        )}
      >
        {recording ? (
          <span className="size-5 rounded-sm bg-white" />
        ) : (
          <span className="size-5 rounded-full bg-white" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FF2D55]/15 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#FF4D6D]">
            <span className="size-1.5 rounded-full bg-[#FF4D6D]" />
            Rec
          </span>
          <span className="text-sm font-semibold text-white">
            Pass {pass} · {mode === 'overdub' ? 'Overdub' : 'Replace'}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          Bar {barIndex + 1} of 1 · Beat {beat >= 0 ? beat + 1 : '—'}
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
          onClick={onUndo}
          className="flex size-9 items-center justify-center rounded-full border border-white/12 text-slate-300"
        >
          <RotateCcw className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Clear bar"
          onClick={onClear}
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
  beats,
  rows,
  steps,
  grid,
  thisPass,
  playheadStep,
}: {
  barIndex: number
  beats: number
  rows: VoiceId[]
  steps: number
  grid: Record<VoiceId, boolean[]>
  thisPass: Map<VoiceId, Set<number>>
  playheadStep: number
}) {
  const shown = rows.length > 0 ? rows : (['kick', 'snare'] as VoiceId[])
  const beatCount = Math.max(1, beats)
  return (
    <div data-mini-loop className="rounded-2xl border border-white/10 bg-[#141A28]/80 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Loop · Bar {barIndex + 1}
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
      <div className="flex gap-2">
        <div className="flex w-[4.6rem] shrink-0 flex-col justify-around py-0.5">
          {shown.map((voice) => (
            <p key={voice} className="truncate text-[0.62rem] font-semibold leading-4 text-slate-400">
              {VOICE_LABELS[voice]}
            </p>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div
            className="mb-1 grid text-center text-[0.58rem] font-semibold text-slate-500"
            style={{ gridTemplateColumns: `repeat(${beatCount}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: beatCount }, (_, beat) => (
              <span key={beat}>{beat + 1}</span>
            ))}
          </div>
          <div
            className="grid gap-y-1"
            style={{ gridTemplateRows: `repeat(${shown.length}, minmax(0, 1fr))` }}
          >
            {shown.map((voice) => (
              <div
                key={voice}
                className="grid h-4"
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
                        'mx-[1px] rounded-[2px]',
                        passHit ? 'bg-[#FF4D6D]' : earlier ? 'bg-[#A855F7]' : 'bg-white/8',
                      )}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          {playheadStep >= 0 ? (
            <span
              data-mini-playhead
              className="pointer-events-none absolute top-5 bottom-0 w-px bg-white/80"
              style={{ left: `${((playheadStep + 0.5) / Math.max(1, steps)) * 100}%` }}
            />
          ) : null}
        </div>
      </div>
    </div>
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
      className="grid min-w-[11rem] grid-cols-2 rounded-full bg-white/6 p-1 ring-1 ring-white/10"
    >
      {(['overdub', 'replace'] as const).map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          data-record-mode={id}
          onClick={() => onChange(id)}
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
  return (
    <div data-pad-grid className="grid grid-cols-4 gap-2">
      {DRUM_PADS.map((pad) => (
        <DrumPad
          key={pad.voice}
          voice={pad.voice}
          label={pad.label}
          wide={pad.wide}
          keyCap={pad.key}
          keysOn={keysOn}
          active={Boolean(lit[pad.voice])}
          onStrike={onStrike}
        />
      ))}
    </div>
  )
}

function DrumPad({
  voice,
  label,
  wide,
  keyCap,
  keysOn,
  active,
  onStrike,
}: {
  voice: VoiceId
  label: string
  wide?: boolean
  keyCap: string | readonly string[]
  keysOn: boolean
  active: boolean
  onStrike: (voice: VoiceId) => void
}) {
  const caps = Array.isArray(keyCap) ? keyCap : [keyCap]
  const hit = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    onStrike(voice)
  }
  return (
    <button
      type="button"
      data-drum-pad={voice}
      data-pad-active={active ? '1' : '0'}
      onPointerDown={hit}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        'relative flex min-h-[4.25rem] touch-manipulation select-none flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#141A28] text-[#E9D5FF] sm:min-h-[5.4rem]',
        wide && 'col-span-2 min-h-[4.85rem] sm:min-h-[6rem]',
        active && 'omni-pad-hit border-[#A855F7] bg-[#A855F7]/20 text-white',
      )}
    >
      {active ? <span className="omni-pad-ripple" /> : null}
      {keysOn ? (
        <span className="absolute left-1.5 top-1.5 hidden gap-0.5 wide:flex">
          {caps.map((cap) => (
            <span
              key={cap}
              className="rounded bg-white/10 px-1 py-px text-[0.58rem] font-bold uppercase tracking-wide text-slate-300"
            >
              {cap}
            </span>
          ))}
        </span>
      ) : null}
      <DrumPadIcon voice={voice} />
      <span className="mt-1 text-[0.7rem] font-semibold text-slate-200">{label}</span>
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
