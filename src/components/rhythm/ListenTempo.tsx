import { Mic, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { type SpeedBuilder, sbBpm } from '@/lib/speed-builder'
import { type TempoEstimate } from '@/lib/tempo-detect'
import { requestRawMic } from '@/lib/mic-capture'
import { playListenTempoPreview, stopListenTempoPreview } from '@/lib/listen-preview'
import { getTempoListener, type ListenSnapshot } from '@/lib/tempo-listen'
import { activateOnPointer, cn } from '@/lib/utils'

type ListenTempoSheetProps = {
  open: boolean
  onClose: () => void
  onUse: (bpm: number, note: string) => void
  speedBuilder: SpeedBuilder
  currentBpm: number
  seed?: TempoEstimate | null
}

export function ListenTempoSheet({
  open,
  onClose,
  onUse,
  speedBuilder,
  currentBpm,
  seed = null,
}: ListenTempoSheetProps) {
  const listenerRef = useRef(getTempoListener())
  const fileRef = useRef<HTMLInputElement>(null)
  const [snap, setSnap] = useState<ListenSnapshot | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [previewBpm, setPreviewBpm] = useState<number | null>(null)
  const [heldEstimate, setHeldEstimate] = useState<TempoEstimate | null>(seed)
  const ignoreBackdropUntil = useRef(0)
  const backdropPointer = useRef(0)

  const closeSheet = () => {
    stopListenTempoPreview()
    void listenerRef.current?.cancel()
    onClose()
  }

  useEffect(() => {
    if (!open) {
      stopListenTempoPreview()
      void listenerRef.current?.cancel()
      setPicked(null)
      setPreviewBpm(null)
      setHeldEstimate(seed)
      return
    }
    const unsub = listenerRef.current?.subscribe(setSnap)
    if (seed) {
      listenerRef.current?.showEstimate(seed, 'file')
      setHeldEstimate(seed)
    }
    return () => {
      unsub?.()
    }
  }, [open, seed])

  useEffect(() => {
    if (snap?.phase === 'result' && snap.estimate) {
      setPicked(snap.estimate.bpm)
      setHeldEstimate(snap.estimate)
    }
  }, [snap])

  if (!open) return null

  const estimate = snap?.estimate ?? heldEstimate ?? seed
  const phase = snap?.phase ?? (estimate ? 'result' : seed ? 'result' : 'listening')
  const showResult = Boolean(estimate) && phase !== 'listening' && phase !== 'analyzing'
  const chosen = picked ?? estimate?.bpm ?? null

  const sbNote =
    speedBuilder.enabled && chosen
      ? `Speed Builder is on, so this becomes the 100% target (${chosen} BPM). Practice still starts at ${speedBuilder.fromPct}% (${sbBpm(chosen, speedBuilder.fromPct)} BPM).`
      : null

  const useNote =
    sbNote ??
    (chosen && chosen !== currentBpm
      ? `This sets the metronome to ${chosen} BPM on the next note.`
      : `This is already your tempo.`)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 pb-[calc(0.65rem+var(--tabbar-clearance))] sm:items-center sm:p-6 sm:pb-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="listen-tempo-title"
      data-listen-panel="open"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close listen"
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return
          backdropPointer.current = event.pointerId
        }}
        onPointerUp={(event) => {
          if (event.pointerId !== backdropPointer.current) return
          backdropPointer.current = 0
          if (event.target !== event.currentTarget) return
          if (performance.now() < ignoreBackdropUntil.current) return
          closeSheet()
        }}
        onPointerCancel={() => {
          backdropPointer.current = 0
        }}
      />
      <div
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/12 bg-[#141A28] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)] sm:p-6"
        onPointerDown={(event) => {
          event.stopPropagation()
          ignoreBackdropUntil.current = performance.now() + 800
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
              Tempo listen
            </p>
            <h2 id="listen-tempo-title" className="text-lg font-bold text-white">
              {showResult
                ? 'Detected tempo'
                : phase === 'listening'
                ? 'Listening for a beat…'
                : phase === 'analyzing'
                  ? 'Finding the tempo…'
                  : phase === 'error'
                    ? 'Could not listen'
                    : 'Listen for tempo'}
            </h2>
          </div>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full border border-white/12 text-slate-300"
            aria-label="Cancel"
            {...activateOnPointer(() => closeSheet())}
          >
            <X className="size-4" />
          </button>
        </div>

        {phase === 'listening' ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              Hold still and let a groove play for a few seconds. Click and drums are muted while this
              is open.
            </p>
            <LevelMeter level={snap?.level ?? 0} />
            <ProgressBar value={snap?.progress ?? 0} />
            <p className="text-center text-xs tabular-nums text-slate-500">
              {Math.max(0, 9 - Math.floor((snap?.elapsedMs ?? 0) / 1000))}s
            </p>
          </div>
        ) : null}

        {phase === 'analyzing' ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Reading the beat…</p>
            <ProgressBar value={Math.max(0.2, snap?.progress ?? 0.4)} />
          </div>
        ) : null}

        {phase === 'error' ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-300">{snap?.message}</p>
            {snap?.detail && new URLSearchParams(window.location.search).get('debug') === 'audio' ? (
              <p className="break-words font-mono text-[0.68rem] text-amber-200" data-listen-error-detail>
                {snap.detail}
              </p>
            ) : null}
          </div>
        ) : null}

        {showResult && estimate ? (
          <ResultBody
            estimate={estimate}
            chosen={chosen}
            previewBpm={previewBpm}
            onChoose={setPicked}
            onPreview={(bpm) => {
              ignoreBackdropUntil.current = performance.now() + 800
              if (previewBpm === bpm) {
                stopListenTempoPreview()
                setPreviewBpm(null)
                return
              }
              setPicked(bpm)
              setPreviewBpm(bpm)
              playListenTempoPreview(bpm, () => {
                setPreviewBpm((current) => (current === bpm ? null : current))
              })
            }}
            useNote={useNote}
            source={snap?.source ?? 'file'}
          />
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {showResult && chosen ? (
            <Button
              type="button"
              data-listen-use
              {...activateOnPointer(() => {
                stopListenTempoPreview()
                onUse(chosen, useNote)
                void listenerRef.current?.cancel()
                onClose()
              })}
            >
              Use this tempo
            </Button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              data-listen-again
              {...activateOnPointer(() => {
                stopListenTempoPreview()
                setPreviewBpm(null)
                setPicked(null)
                setHeldEstimate(null)
                const micPromise = requestRawMic()
                void listenerRef.current?.startMic(micPromise)
              })}
            >
              <Mic className="size-3.5" />
              {phase === 'listening' ? 'Restart' : 'Listen again'}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-listen-file
              {...activateOnPointer(() => fileRef.current?.click())}
            >
              <Upload className="size-3.5" />
              Choose file
            </Button>
          </div>
          <button
            type="button"
            className="mt-1 text-center text-xs font-semibold text-slate-500"
            {...activateOnPointer(() => closeSheet())}
          >
            Cancel
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/aac,audio/ogg,audio/webm,audio/flac,.mp3,.m4a,.wav,.aac,.ogg,.flac,.webm"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.currentTarget.value = ''
            if (file) void listenerRef.current?.analyzeFile(file)
          }}
        />
      </div>
    </div>
  )
}

function ResultBody({
  estimate,
  chosen,
  previewBpm,
  onPreview,
  useNote,
  source,
}: {
  estimate: TempoEstimate
  chosen: number | null
  previewBpm: number | null
  onChoose: (bpm: number) => void
  onPreview: (bpm: number) => void
  useNote: string
  source: 'mic' | 'file' | null
}) {
  const showExact =
    Math.abs(estimate.bpmExact - estimate.bpm) >= 0.15
      ? estimate.bpmExact.toFixed(1)
      : null

  return (
    <div data-listen-result="ready">
      <div className="text-center">
        <p className="text-5xl font-extrabold tabular-nums tracking-tight text-white">
          {estimate.bpm}
          <span className="ml-1 text-lg font-semibold text-slate-500">BPM</span>
        </p>
        {showExact ? (
          <p className="mt-1 text-sm tabular-nums text-slate-400">{showExact} if you want the tenth</p>
        ) : null}
        <p className="mt-2 text-sm text-slate-400">{estimate.hint}</p>
        <p className="mt-1 text-[0.65rem] uppercase tracking-[0.14em] text-slate-600">
          {source === 'file' ? 'From file' : 'From microphone'} · {Math.round(estimate.confidence * 100)}%
          confidence
        </p>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Tap to hear · Use this tempo to apply
        </p>
        <div className="flex justify-center gap-2">
          <AltChip
            label="½×"
            bpm={estimate.half}
            active={chosen === estimate.half}
            playing={previewBpm === estimate.half}
            onPick={() => onPreview(estimate.half)}
          />
          <AltChip
            label="1×"
            bpm={estimate.bpm}
            active={chosen === estimate.bpm}
            playing={previewBpm === estimate.bpm}
            onPick={() => onPreview(estimate.bpm)}
          />
          <AltChip
            label="2×"
            bpm={estimate.double}
            active={chosen === estimate.double}
            playing={previewBpm === estimate.double}
            onPick={() => onPreview(estimate.double)}
          />
        </div>
      </div>
      <p className="mt-4 text-center text-sm leading-5 text-slate-400">{useNote}</p>
    </div>
  )
}

function AltChip({
  label,
  bpm,
  active,
  playing,
  onPick,
}: {
  label: string
  bpm: number
  active: boolean
  playing: boolean
  onPick: () => void
}) {
  const tap = activateOnPointer(onPick)
  return (
    <button
      type="button"
      data-listen-alt={label}
      data-listen-preview={playing ? 'on' : 'off'}
      onPointerDown={(event) => {
        event.stopPropagation()
        tap.onPointerDown?.(event)
      }}
      onClick={(event) => {
        event.stopPropagation()
        tap.onClick?.(event)
      }}
      className={cn(
        'min-w-[4.8rem] rounded-2xl border px-3 py-2 text-center touch-manipulation',
        playing
          ? 'border-[#A855F7] bg-[#A855F7]/28 text-white ring-1 ring-[#A855F7]/70'
          : active
            ? 'border-[#A855F7] bg-[#A855F7]/20 text-white'
            : 'border-white/12 bg-white/4 text-slate-200',
      )}
    >
      <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {playing ? 'Playing' : label}
      </span>
      <span className="block text-sm font-bold tabular-nums">{bpm}</span>
    </button>
  )
}

function LevelMeter({ level }: { level: number }) {
  const pct = Math.max(4, Math.min(100, Math.round(level * 100)))
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-white/8"
      data-listen-level={pct}
      aria-hidden
    >
      <div
        className="h-full rounded-full bg-[#A855F7] transition-[width] duration-75"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/8" data-listen-progress={pct}>
      <div className="h-full rounded-full bg-[#C084FC]" style={{ width: `${pct}%` }} />
    </div>
  )
}
