import { Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AppChrome } from '@/components/AppChrome'
import { DrumGrid } from '@/components/rhythm/DrumGrid'
import { Button } from '@/components/ui/button'
import { useRhythmEngine } from '@/hooks/useRhythmEngine'
import {
  DEFAULT_BPM,
  METER_IDS,
  METERS,
  clampBpm,
  clonePattern,
  defaultAccents,
  toggleAccent,
  toggleHit,
  type MeterId,
  type RhythmMode,
  type VoiceId,
} from '@/lib/rhythm'
import { loadRhythmPrefs, saveRhythmPrefs } from '@/lib/rhythm-prefs'
import {
  RHYTHM_PRESETS,
  defaultPreset,
  findPreset,
  matchPreset,
  presetsForMeter,
} from '@/lib/rhythm-presets'
import { cn } from '@/lib/utils'

export function RhythmPage() {
  const [searchParams] = useSearchParams()
  const prefs = useMemo(() => loadRhythmPrefs(), [])
  const urlMode = searchParams.get('mode')
  const [bpm, setBpm] = useState(prefs.bpm)
  const [meterId, setMeterId] = useState<MeterId>(prefs.meterId)
  const [mode, setMode] = useState<RhythmMode>(
    urlMode === 'drums' || urlMode === 'click' ? urlMode : prefs.mode,
  )
  const [accents, setAccents] = useState(prefs.accents)
  const [pattern, setPattern] = useState(prefs.pattern)
  const [presetId, setPresetId] = useState<string | null>(prefs.presetId)
  const [playing, setPlaying] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const tapTimes = useRef<number[]>([])

  const meter = METERS[meterId]
  const { playhead, preview, ensureKit } = useRhythmEngine({
    playing,
    bpm,
    meter,
    mode,
    accents,
    pattern,
  })

  const matched = matchPreset(meterId, pattern)
  const preset = (presetId ? findPreset(presetId) : null) ?? matched
  const edited = Boolean(preset && !matched)
  const beatName = preset
    ? edited
      ? `${preset.name} · edited`
      : preset.name
    : 'Custom beat'

  useEffect(() => {
    saveRhythmPrefs({
      bpm,
      meterId,
      mode,
      accents,
      pattern,
      presetId: matched?.id ?? presetId,
    })
  }, [accents, bpm, meterId, mode, matched?.id, pattern, presetId])

  const applyMeter = (
    nextId: MeterId,
    nextPattern?: ReturnType<typeof clonePattern>,
    nextPreset?: string | null,
  ) => {
    if (nextId === meterId && !nextPattern) return
    setMeterId(nextId)
    setAccents(defaultAccents(nextId))
    if (nextPattern) {
      setPattern(clonePattern(nextPattern))
      setPresetId(nextPreset ?? null)
      return
    }
    const fallback = defaultPreset(nextId)
    setPattern(clonePattern(fallback.pattern))
    setPresetId(fallback.id)
  }

  const loadPreset = (id: string) => {
    const next = findPreset(id)
    if (!next) return
    applyMeter(next.meterId, next.pattern, next.id)
    setPickerOpen(false)
  }

  const changeMode = (next: RhythmMode) => {
    setMode(next)
  }

  const nudgeBpm = (delta: number) => {
    setBpm((current) => clampBpm(current + delta))
  }

  const tapTempo = () => {
    const now = performance.now()
    const recent = tapTimes.current.filter((time) => now - time < 2000)
    recent.push(now)
    tapTimes.current = recent.slice(-6)
    if (recent.length < 2) return
    const gaps: number[] = []
    for (let i = 1; i < recent.length; i += 1) {
      gaps.push(recent[i] - recent[i - 1])
    }
    const avg = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
    setBpm(clampBpm(60000 / avg))
  }

  const onToggleCell = (voice: VoiceId, step: number) => {
    const next = toggleHit(pattern, voice, step)
    setPattern(next)
    if (!pattern[voice][step] && next[voice][step]) {
      void preview(voice)
    }
  }

  const startStop = async () => {
    if (playing) {
      setPlaying(false)
      return
    }
    await ensureKit()
    setPlaying(true)
  }

  return (
    <AppChrome align="fill" wide>
      <div className="flex min-h-0 flex-1 flex-col">
        <h1 className="text-center text-xl font-bold tracking-tight text-white sm:text-2xl">
          Rhythm
        </h1>
        <p className="mt-1 text-center text-sm text-slate-400">
          Click or drums — same tempo, same meter.
        </p>

        <div className="mx-auto mt-4 grid w-full max-w-sm grid-cols-2 rounded-2xl border border-white/10 bg-[#141A28] p-1">
          {(['click', 'drums'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => changeMode(item)}
              className={cn(
                'h-11 rounded-xl text-sm font-semibold capitalize transition',
                mode === item
                  ? 'bg-[#A855F7] text-white'
                  : 'text-slate-300 hover:text-white',
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <section className="mt-4 rounded-3xl border border-white/10 bg-[#141A28]/80 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Slower by 5"
              onClick={() => nudgeBpm(-5)}
            >
              <Minus className="size-4" />
            </Button>
            <div className="text-center">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                BPM
              </p>
              <p className="text-5xl font-bold tabular-nums tracking-tight text-white sm:text-6xl">
                {bpm}
              </p>
              <p className="text-xs text-slate-500">{meter.pulseLabel}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Faster by 5"
              onClick={() => nudgeBpm(5)}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <input
            type="range"
            min={30}
            max={300}
            value={bpm}
            onChange={(event) => setBpm(clampBpm(Number(event.target.value)))}
            className="omni-slider mt-4 w-full"
            aria-label="Tempo"
          />

          <div className="mt-3 flex items-center justify-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => nudgeBpm(-1)}>
              −1
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={tapTempo}>
              Tap tempo
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => nudgeBpm(1)}>
              +1
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setBpm(DEFAULT_BPM)}
            className="mx-auto mt-2 block text-xs font-semibold text-slate-500 hover:text-slate-300"
          >
            Reset to 100
          </button>
        </section>

        <section className="mt-4">
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Time signature
          </p>
          <div className="flex flex-wrap gap-1.5">
            {METER_IDS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={meterId === id}
                onClick={() => applyMeter(id)}
                className={cn(
                  'h-9 min-w-12 rounded-xl px-2.5 text-sm font-semibold',
                  meterId === id
                    ? 'bg-[#A855F7] text-white'
                    : 'border border-white/10 bg-white/4 text-slate-200 hover:border-[#A855F7]/50',
                )}
              >
                {id}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            More meters coming — odd counts and mixed bars later.
          </p>
        </section>

        <section className="mt-4">
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Accents · tap a beat
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: meter.beats }, (_, beat) => {
              const on = accents.includes(beat)
              const live = playhead.beat === beat
              return (
                <button
                  key={beat}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAccents(toggleAccent(accents, beat, meter.beats))}
                  className={cn(
                    'relative flex size-11 items-center justify-center rounded-full border text-sm font-bold transition sm:size-12',
                    on
                      ? 'border-[#A855F7] bg-[#A855F7] text-white'
                      : 'border-white/15 bg-[#141A28] text-slate-300',
                    live && 'omni-beat-pulse',
                  )}
                >
                  {beat + 1}
                </button>
              )
            })}
          </div>
        </section>

        {mode === 'click' ? (
          <section className="mt-5 flex flex-1 flex-col items-center justify-center py-4">
            <div
              className={cn(
                'flex size-40 items-center justify-center rounded-full border-4 sm:size-48',
                playhead.beat >= 0
                  ? playhead.accent
                    ? 'omni-beat-pulse border-[#A855F7] bg-[#A855F7]/25'
                    : 'border-[#C084FC]/70 bg-[#A855F7]/10'
                  : 'border-white/12 bg-[#141A28]',
              )}
              aria-live="polite"
            >
              <span className="text-5xl font-bold tabular-nums text-white sm:text-6xl">
                {playhead.beat >= 0 ? playhead.beat + 1 : '—'}
              </span>
            </div>
            <p className="mt-4 max-w-sm text-center text-sm leading-6 text-slate-400">
              Beat 1 is accented unless you tap a different beat. High click on
              accents, low click on the rest.
            </p>
          </section>
        ) : (
          <section className="mt-4 flex-1">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mb-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#141A28] px-4 py-3 text-left"
            >
              <span>
                <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
                  Beat library
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-white">
                  {beatName}
                </span>
                <span className="block text-xs text-slate-500">
                  {preset?.blurb ?? 'Your own hits on this meter'}
                </span>
              </span>
              <span className="text-xs font-semibold text-slate-400">Change</span>
            </button>
            <DrumGrid
              meter={meter}
              pattern={pattern}
              currentStep={playhead.step}
              onToggle={onToggleCell}
              onPreview={(voice) => void preview(voice)}
            />
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">
              Tap a cell to add or remove a hit. Lane names preview the sound.
            </p>
          </section>
        )}

        <div className="mt-5">
          <Button
            type="button"
            size="lg"
            variant={playing ? 'outline' : 'default'}
            className="h-14 w-full text-base"
            onClick={() => void startStop()}
          >
            {playing ? 'Stop' : 'Play'}
          </Button>
        </div>
      </div>

      {pickerOpen ? (
        <PresetSheet
          meterId={meterId}
          selectedId={matched?.id ?? presetId}
          onClose={() => setPickerOpen(false)}
          onSelect={loadPreset}
        />
      ) : null}
    </AppChrome>
  )
}

function PresetSheet({
  meterId,
  selectedId,
  onClose,
  onSelect,
}: {
  meterId: MeterId
  selectedId: string | null
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const local = presetsForMeter(meterId)
  const others = RHYTHM_PRESETS.filter((item) => item.meterId !== meterId)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="rhythm-presets-title"
        className="max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0F1422] p-5"
      >
        <h2
          id="rhythm-presets-title"
          className="text-xl font-bold tracking-tight text-white"
        >
          Beat library
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Picking a beat sets the meter if it uses a different one. You can edit
          the grid after.
        </p>

        <PresetGroup title={`For ${meterId}`} items={local} selectedId={selectedId} onSelect={onSelect} />
        {others.length > 0 ? (
          <PresetGroup
            title="Other meters"
            items={others}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ) : null}

        <Button type="button" variant="outline" className="mt-4 w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}

function PresetGroup({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string
  items: { id: string; name: string; blurb: string; meterId: MeterId }[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <section className="mt-4">
      <h3 className="px-1 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h3>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              'flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left',
              item.id === selectedId
                ? 'bg-[#A855F7]/18 ring-1 ring-[#A855F7]/50'
                : 'hover:bg-white/5',
            )}
          >
            <span>
              <span className="block text-sm font-semibold text-white">{item.name}</span>
              <span className="block text-xs text-slate-400">{item.blurb}</span>
            </span>
            <span className="text-xs font-semibold text-slate-500">{item.meterId}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
