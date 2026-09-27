import { ChevronDown, Play, Square } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AppChrome } from '@/components/AppChrome'
import { BarStrip } from '@/components/rhythm/BarStrip'
import { ClickAccentGrid } from '@/components/rhythm/ClickAccentGrid'
import { CompactMeter } from '@/components/rhythm/CompactMeter'
import { DrumBarStage } from '@/components/rhythm/DrumBarStage'
import { KitFaders } from '@/components/rhythm/KitFaders'
import { KitIntensityControl } from '@/components/rhythm/KitIntensity'
import { RhythmTempoCard } from '@/components/rhythm/RhythmTempoCard'
import { SpeedBuilderPopup } from '@/components/rhythm/SpeedBuilderPopup'
import { SubdivIcon } from '@/components/rhythm/SubdivIcons'
import { Button } from '@/components/ui/button'
import { usePlayhead, useRhythmEngine, type PlayheadStore } from '@/hooks/useRhythmEngine'
import { snareRoleFromStep, type KitIntensity } from '@/lib/kit-intensity'
import { type KitGroupId, type KitMix } from '@/lib/kit-mix'
import {
  CLICK_SOUND_LABELS,
  CLICK_SOUNDS,
  DEFAULT_BPM,
  MAX_BARS,
  SUBDIVISION_LABELS,
  SUBDIVISIONS,
  clampBpm,
  beatAccentAt,
  cloneBar,
  cycleBeatAccent,
  defaultBeatAccents,
  meterLabel,
  setBarSubdivision,
  setBeatSubdivision,
  setHit,
  updateBarMeter,
  type BeatUnit,
  type ClickSoundId,
  type RhythmBar,
  type RhythmMode,
  type SubdivisionId,
  type VoiceId,
} from '@/lib/rhythm'
import { playWheelTick } from '@/lib/rhythm-audio'
import { activateOnPointer, cn } from '@/lib/utils'
import { loadRhythmPrefs, saveRhythmPrefs } from '@/lib/rhythm-prefs'
import { unlockSpeech, type SpeedBuilder, type SpeedBuilderCue } from '@/lib/speed-builder'
import {
  RHYTHM_STYLES,
  barsForPreset,
  findPreset,
  matchPreset,
  type RhythmPreset,
  type RhythmStyle,
} from '@/lib/rhythm-presets'

export function RhythmPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const prefs = useMemo(() => loadRhythmPrefs(), [])
  const urlMode = searchParams.get('mode')
  const [bpm, setBpm] = useState(prefs.bpm)
  const [mode, setMode] = useState<RhythmMode>(
    urlMode === 'drums' || urlMode === 'click' ? urlMode : prefs.mode,
  )
  const [clickSound, setClickSound] = useState<ClickSoundId>(prefs.clickSound)
  const [clickBars, setClickBars] = useState<RhythmBar[]>(prefs.clickBars)
  const [drumBars, setDrumBars] = useState<RhythmBar[]>(prefs.drumBars)
  const [clickBarIndex, setClickBarIndex] = useState(prefs.clickBarIndex)
  const [drumBarIndex, setDrumBarIndex] = useState(prefs.drumBarIndex)
  const [presetId, setPresetId] = useState<string | null>(prefs.presetId)
  const [kitMix, setKitMix] = useState<KitMix>(prefs.kitMix)
  const [kitIntensity, setKitIntensity] = useState<KitIntensity>(prefs.kitIntensity)
  const [playing, setPlaying] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [accentEdit, setAccentEdit] = useState(false)
  const [pickerBeat, setPickerBeat] = useState<number | null>(null)
  const [speedBuilder, setSpeedBuilder] = useState<SpeedBuilder>(prefs.speedBuilder)
  const [tempoCue, setTempoCue] = useState<SpeedBuilderCue | null>(null)
  const tapTimes = useRef<number[]>([])

  const bars = mode === 'click' ? clickBars : drumBars
  const setBars = mode === 'click' ? setClickBars : setDrumBars
  const barIndex = mode === 'click' ? clickBarIndex : drumBarIndex
  const setBarIndex = mode === 'click' ? setClickBarIndex : setDrumBarIndex

  const current = bars[Math.min(barIndex, bars.length - 1)] ?? bars[0]

  useEffect(() => {
    if (mode !== 'click' || pickerBeat === null) return
    if (!current || pickerBeat >= current.beats) setPickerBeat(null)
  }, [current, mode, pickerBeat])

  const { playheadStore, preview, previewClick, previewBar, previewClickBar, ensureKit, holdUntilCycle, liveBpm, halt } =
    useRhythmEngine({
    playing,
    bpm,
    mode,
    bars,
    clickSound,
    kitMix,
    kitIntensity,
    speedBuilder,
    onTempoCue: (cue) => {
      setTempoCue(cue)
    },
  })

  const matched = current ? matchPreset(current) : null
  const edited = Boolean(matched === null && presetId)
  const savedPreset = presetId ? findPreset(presetId) : undefined
  const beatName = matched
    ? matched.name
    : savedPreset
      ? `${savedPreset.name} · edited`
      : 'Custom beat'

  useEffect(() => {
    const resume = () => {
      void ensureKit()
    }
    window.addEventListener('pointerdown', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      window.removeEventListener('pointerdown', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [ensureKit])

  useEffect(() => {
    if (!speedBuilder.announce) return
    void ensureKit().then((kit) => kit?.preloadAnnounce())
  }, [ensureKit, speedBuilder.announce])

  useEffect(() => {
    const id = window.setTimeout(() => {
      saveRhythmPrefs({
        bpm,
        mode,
        clickSound,
        clickBars,
        drumBars,
        clickBarIndex,
        drumBarIndex,
        presetId: matched?.id ?? presetId,
        kitMix,
        kitIntensity,
        speedBuilder,
      })
    }, 220)
    return () => window.clearTimeout(id)
  }, [
    clickBarIndex,
    clickBars,
    clickSound,
    drumBarIndex,
    drumBars,
    bpm,
    kitIntensity,
    kitMix,
    matched?.id,
    mode,
    presetId,
    speedBuilder,
  ])

  const chooseMode = (next: RhythmMode) => {
    if (next === mode) return
    setAccentEdit(false)
    setPickerBeat(null)
    setMode(next)
    const params = new URLSearchParams(searchParams)
    params.set('mode', next)
    setSearchParams(params, { replace: true })
  }

  const setGroupMix = (group: KitGroupId, db: number) => {
    setKitMix((currentMix) => ({ ...currentMix, [group]: db }))
  }

  const patchBar = (index: number, next: RhythmBar) => {
    setBars((currentBars) => currentBars.map((bar, item) => (item === index ? next : bar)))
  }

  const setMeter = (beats: number, beatUnit: BeatUnit) => {
    if (!current) return
    patchBar(barIndex, updateBarMeter(current, beats, beatUnit, current.subdivision))
    setPresetId(null)
  }

  const setSubdivision = (subdivision: SubdivisionId) => {
    setBars((currentBars) => currentBars.map((bar) => setBarSubdivision(bar, subdivision)))
    setPresetId(null)
    setPickerBeat(null)
  }

  const loadPreset = (id: string) => {
    const preset = findPreset(id)
    if (!preset) return
    setDrumBars(barsForPreset(preset).map(cloneBar))
    setDrumBarIndex(0)
    if (id === 'rock-44') setBpm(DEFAULT_BPM)
    setPresetId(preset.id)
    setPickerOpen(false)
  }

  const addBar = () => {
    if (bars.length >= MAX_BARS || !current) return
    const next = cloneBar(current)
    next.beatAccents = defaultBeatAccents(next.beats, next.beatUnit)
    setBars((currentBars) => [...currentBars, next])
    setBarIndex(bars.length)
  }

  const removeBar = (index: number) => {
    if (bars.length <= 1) return
    const next = bars.filter((_, item) => item !== index)
    setBars(next)
    setBarIndex(Math.min(index, next.length - 1))
  }

  const changeBpm = (next: number, tick = false) => {
    const clamped = clampBpm(next)
    if (clamped === bpm) return
    if (tick) playWheelTick()
    setBpm(clamped)
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

  const onPaintCell = useCallback(
    (targetBar: number, voice: VoiceId, step: number, on: boolean, playPreview: boolean) => {
      if (playPreview) {
        const bar = drumBars[targetBar]
        const role =
          voice === 'snare' && bar ? snareRoleFromStep(step, bar.subdivision) : 'backbeat'
        preview(voice, role)
      }
      let changed = false
      setDrumBars((currentBars) => {
        const bar = currentBars[targetBar]
        if (!bar) return currentBars
        const nextPattern = setHit(bar.pattern, voice, step, bar.beats, bar.subdivision, on)
        if (nextPattern === bar.pattern) return currentBars
        changed = true
        return currentBars.map((item, index) =>
          index === targetBar ? { ...item, pattern: nextPattern } : item,
        )
      })
      if (changed) setPresetId(matched?.id ?? presetId)
    },
    [drumBars, matched?.id, presetId, preview],
  )

  const chooseDrumBar = (index: number) => {
    setDrumBarIndex(index)
    const bar = drumBars[index]
    if (bar && !playing) void previewBar(bar)
  }

  const chooseClickBar = (index: number) => {
    setClickBarIndex(index)
    const bar = clickBars[index]
    if (bar && !playing) void previewClickBar(bar)
  }

  const startStop = async () => {
    if (playing) {
      halt()
      setPlaying(false)
      return
    }
    unlockSpeech()
    const kit = await ensureKit()
    if (speedBuilder.enabled && speedBuilder.announce) {
      kit?.preloadAnnounce()
      await kit?.ensureAnnounce(speedBuilder.fromPct)
    }
    setPlaying(true)
  }

  if (!current) return null

  const liveMeter = meterLabel(current.beats, current.beatUnit)

  return (
    <AppChrome align="fill" wide compact>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <SpeedBuilderPopup cue={tempoCue} />
        <div
          data-rhythm-scroll
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-contain pb-[calc(7.25rem+env(safe-area-inset-bottom,0px))] [scrollbar-width:thin] [touch-action:pan-y]"
        >
          <div
            data-rhythm-header
            className="rhythm-glass sticky top-0 z-30 flex items-center justify-between gap-3 rounded-full py-1 pl-3 pr-1"
          >
            <h1 className="text-lg font-bold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] sm:text-xl">
              Rhythm
            </h1>
            <div
              role="radiogroup"
              aria-label="Rhythm mode"
              className="relative z-30 flex w-[12.25rem] shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#141A28] p-0.5"
              data-section="mode"
            >
              {(['click', 'drums'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={mode === item}
                  aria-pressed={mode === item}
                  data-mode={item}
                  {...activateOnPointer(() => chooseMode(item))}
                  className={cn(
                    'relative z-30 h-11 min-h-11 flex-1 touch-manipulation rounded-full text-sm font-semibold capitalize transition',
                    mode === item ? 'bg-[#A855F7] text-white' : 'text-slate-300 hover:text-white',
                  )}
                >
                  {item === 'click' ? 'Click' : 'Drums'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'click' ? (
          <div
            data-rhythm-layout
            data-rhythm-mode="click"
            className="mt-1.5 flex flex-col gap-1.5 lg:grid lg:grid-cols-[minmax(17.5rem,20rem)_minmax(0,1fr)] lg:items-start lg:gap-4"
          >
            <div className="lg:col-start-1 lg:row-start-1">
              <RhythmTempoCard
                bpm={bpm}
                liveBpm={liveBpm}
                playing={playing}
                speedBuilder={speedBuilder}
                onSpeedBuilder={setSpeedBuilder}
                onBpm={changeBpm}
                onTap={tapTempo}
              />
            </div>

            <section
              className="rounded-xl border border-white/10 bg-[#141A28]/80 px-2 py-1.5 lg:col-start-1 lg:row-start-2"
              data-bar-count={bars.length}
              data-rhythm-mode="click"
            >
              <CompactMeter
                beats={current.beats}
                beatUnit={current.beatUnit}
                onChange={setMeter}
              />
            </section>

            <section className="lg:col-start-2 lg:row-start-1">
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Subdivision
              </p>
              <div className="max-w-full overflow-x-hidden pb-0.5">
                <div
                  role="group"
                  aria-label="Subdivision for all beats"
                  data-section="subdivision"
                  className="flex w-full min-w-0 items-center justify-between gap-1"
                >
                  {SUBDIVISIONS.map((steps) => {
                    const selected = current.beatSubdivisions.every((item) => item === steps)
                    return (
                      <button
                        key={steps}
                        type="button"
                        aria-label={SUBDIVISION_LABELS[steps]}
                        title={SUBDIVISION_LABELS[steps]}
                        aria-pressed={selected}
                        data-subdivision={steps}
                        {...activateOnPointer(() => setSubdivision(steps))}
                        className={cn(
                          'flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg touch-manipulation sm:h-11',
                          selected
                            ? 'bg-[#A855F7] text-white'
                            : 'border border-white/10 bg-white/4 text-slate-100 hover:border-[#A855F7]/50',
                        )}
                      >
                        <SubdivIcon steps={steps} compact />
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#141A28]/80 px-2.5 py-2 sm:px-4 lg:col-start-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <ClickLiveHeader store={playheadStore} playing={playing} barIndex={barIndex} />
                <button
                  type="button"
                  data-accent-mode={accentEdit ? 'on' : 'off'}
                  aria-pressed={accentEdit}
                  {...activateOnPointer(() => {
                    setAccentEdit((on) => !on)
                    setPickerBeat(null)
                  })}
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em]',
                    accentEdit ? 'bg-[#A855F7] text-white' : 'border border-white/12 text-slate-400',
                  )}
                >
                  Accents
                </button>
              </div>
              {accentEdit ? (
                <p className="mb-1.5 text-[0.65rem] text-slate-500">
                  Tap a beat to cycle off → soft → strong.
                </p>
              ) : null}
              <ClickAccentGrid
                bar={current}
                playheadStore={playheadStore}
                barIndex={barIndex}
                playing={playing}
                accentEdit={accentEdit}
                pickerBeat={pickerBeat}
                onPickerBeat={setPickerBeat}
                onPreviewBeat={(beat) => {
                  previewClick(clickSound, beatAccentAt(current.beatAccents, beat), true)
                }}
                onCycleAccent={(beat) => {
                  const next = cycleBeatAccent(current.beatAccents, beat, current.beats)
                  previewClick(clickSound, beatAccentAt(next, beat), true)
                  patchBar(barIndex, { ...current, beatAccents: next })
                }}
                onSetBeatSubdiv={(beat, subdivision) => {
                  patchBar(barIndex, setBeatSubdivision(current, beat, subdivision))
                  setPickerBeat(null)
                }}
              />
            </section>

            <section className="rounded-xl border border-white/10 bg-[#141A28]/80 px-2 py-1.5 lg:col-start-2">
              <BarStrip
                store={playheadStore}
                bars={clickBars}
                barIndex={clickBarIndex}
                playing={playing}
                canAdd={clickBars.length < MAX_BARS}
                onSelect={chooseClickBar}
                onAdd={addBar}
                onRemove={() => removeBar(clickBarIndex)}
              />
            </section>

            <div
              data-section="click-sound"
              className="grid w-full grid-cols-4 gap-1 lg:col-start-2"
            >
              {CLICK_SOUNDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  data-click-sound={id}
                  aria-pressed={clickSound === id}
                  {...activateOnPointer(() => {
                    previewClick(id)
                    setClickSound(id)
                  })}
                  className={cn(
                    'h-8 min-w-0 touch-manipulation rounded-lg px-1 text-[0.7rem] font-semibold sm:text-sm',
                    clickSound === id
                      ? 'bg-[#A855F7] text-white'
                      : 'border border-white/10 bg-white/4 text-slate-200',
                  )}
                >
                  {CLICK_SOUND_LABELS[id]}
                </button>
              ))}
            </div>
          </div>
          ) : (
          <div
            data-rhythm-layout
            data-rhythm-mode="drums"
            className="mt-1.5 grid grid-cols-1 gap-1.5 lg:grid-cols-[minmax(17.5rem,20rem)_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr] lg:gap-4"
          >
            <div className="lg:col-start-1 lg:row-start-1">
              <RhythmTempoCard
                bpm={bpm}
                liveBpm={liveBpm}
                playing={playing}
                speedBuilder={speedBuilder}
                onSpeedBuilder={setSpeedBuilder}
                onBpm={changeBpm}
                onTap={tapTempo}
              />
            </div>
            <section
              className="rounded-xl border border-white/10 bg-[#141A28]/80 px-2 py-1.5 lg:col-start-1 lg:row-start-2"
              data-bar-count={bars.length}
              data-rhythm-mode="drums"
            >
              <CompactMeter
                beats={current.beats}
                beatUnit={current.beatUnit}
                onChange={setMeter}
              />
            </section>
            <section className="lg:col-start-1 lg:row-start-3">
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Subdivision
              </p>
              <div className="max-w-full overflow-x-hidden pb-0.5">
                <div
                  role="group"
                  aria-label="Subdivision"
                  data-section="subdivision"
                  className="flex w-full min-w-0 justify-between gap-1 lg:flex-wrap lg:justify-start"
                >
                  {SUBDIVISIONS.map((steps) => (
                    <button
                      key={steps}
                      type="button"
                      aria-label={SUBDIVISION_LABELS[steps]}
                      title={SUBDIVISION_LABELS[steps]}
                      aria-pressed={current.subdivision === steps}
                      data-subdivision={steps}
                      {...activateOnPointer(() => setSubdivision(steps))}
                      className={cn(
                        'flex h-12 min-w-0 flex-1 items-center justify-center rounded-lg touch-manipulation sm:h-14 lg:h-11 lg:max-w-[2.8rem] lg:flex-none',
                        current.subdivision === steps
                          ? 'bg-[#A855F7] text-white'
                          : 'border border-white/10 bg-white/4 text-slate-100 hover:border-[#A855F7]/50',
                      )}
                    >
                      <SubdivIcon steps={steps} />
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <section className="flex min-h-0 flex-col lg:col-start-2 lg:row-span-3 lg:row-start-1">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="mb-2 flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#141A28] px-3 py-2 text-left"
              >
                <span>
                  <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
                    Beat library
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-white">
                    {edited && matched === null ? beatName : matched?.name ?? beatName}
                  </span>
                </span>
                <span className="text-xs font-semibold text-slate-400">Change</span>
              </button>
              <div className="mb-2 rounded-xl border border-white/10 bg-[#141A28]/80 px-2 py-1.5">
                <BarStrip
                  store={playheadStore}
                  bars={drumBars}
                  barIndex={drumBarIndex}
                  playing={playing}
                  canAdd={drumBars.length < MAX_BARS}
                  onSelect={chooseDrumBar}
                  onAdd={addBar}
                  onRemove={() => removeBar(drumBarIndex)}
                />
              </div>
              <DrumBarStage
                bars={drumBars}
                barIndex={drumBarIndex}
                playing={playing}
                playheadStore={playheadStore}
                onPaint={onPaintCell}
                onPreviewVoice={preview}
              />
              <KitIntensityControl value={kitIntensity} onChange={setKitIntensity} />
              <KitFaders mix={kitMix} onChange={setGroupMix} />
              <p className="mt-1.5 text-center text-[0.65rem] leading-4 text-slate-500">
                Drums:{' '}
                <a
                  className="underline decoration-white/20 underline-offset-2 hover:text-slate-300"
                  href="https://drumgizmo.org/wiki/doku.php?id=kits:crocellkit"
                  target="_blank"
                  rel="noreferrer"
                >
                  CrocellKit
                </a>{' '}
                by Lars Muldjord &amp; Henry Järvinen,{' '}
                <a
                  className="underline decoration-white/20 underline-offset-2 hover:text-slate-300"
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0
                </a>{' '}
                (edited).
              </p>
            </section>
          </div>
          )}
        </div>

        <PlayheadBarSync store={playheadStore} playing={playing} onBar={setBarIndex} />
        <div
          data-section="transport"
          data-hold-until-cycle={holdUntilCycle ? 'true' : 'false'}
          className="rhythm-glass absolute inset-x-0 bottom-0 z-40 border-t border-white/10 pt-2 pb-[max(0.55rem,env(safe-area-inset-bottom))]"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[0.7rem] text-slate-200">
            <TransportReadout
              store={playheadStore}
              playing={playing}
              bars={bars.length}
              bpm={speedBuilder.enabled && playing ? liveBpm : bpm}
              liveMeter={liveMeter}
              mode={mode}
              clickSound={clickSound}
              holdUntilCycle={holdUntilCycle}
            />
          </div>
          <Button
            type="button"
            size="lg"
            variant={playing ? 'outline' : 'default'}
            className={cn(
              'h-14 w-full touch-manipulation text-base lg:mx-auto lg:max-w-md',
              playing && 'border-white/15 bg-[#141A28] text-white hover:bg-[#1A2033]',
            )}
            data-transport="play"
            {...activateOnPointer(() => void startStop())}
          >
            {playing ? <Square className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
            {playing ? 'Stop' : 'Play'}
          </Button>
        </div>
      </div>

      {pickerOpen ? (
        <PresetSheet
          current={current}
          selectedId={matched?.id ?? presetId}
          onClose={() => setPickerOpen(false)}
          onSelect={loadPreset}
        />
      ) : null}
    </AppChrome>
  )
}

function PlayheadBarSync({
  store,
  playing,
  onBar,
}: {
  store: PlayheadStore
  playing: boolean
  onBar: (bar: number) => void
}) {
  const playhead = usePlayhead(store)
  const wasPlaying = useRef(false)
  useEffect(() => {
    if (wasPlaying.current && !playing && playhead.bar >= 0) onBar(playhead.bar)
    wasPlaying.current = playing
  }, [onBar, playhead.bar, playing])
  return null
}

function ClickLiveHeader({
  store,
  playing,
  barIndex,
}: {
  store: PlayheadStore
  playing: boolean
  barIndex: number
}) {
  const playhead = usePlayhead(store)
  const live = playing && playhead.bar === barIndex
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full border-[3px] sm:size-12',
          live && playhead.beat >= 0
            ? playhead.accent === 2
              ? 'omni-beat-pulse border-[#A855F7] bg-[#A855F7]/25'
              : playhead.accent === 1
                ? 'omni-beat-pulse border-[#C4B5FD] bg-[#C4B5FD]/20'
                : playhead.subdivision
                  ? 'border-white/20 bg-white/5'
                  : 'border-[#C084FC]/70 bg-[#A855F7]/10'
            : 'border-white/12 bg-[#0B0F1A]',
        )}
        aria-live="polite"
        data-pulse-level={playhead.accent}
      >
        <span className="text-lg font-bold tabular-nums text-white sm:text-xl">
          {!live || playhead.beat < 0
            ? '—'
            : playhead.subdivision
              ? `${playhead.beat + 1}·${playhead.step + 1}`
              : playhead.beat + 1}
        </span>
      </div>
      <p className="min-w-0 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Beats
      </p>
    </div>
  )
}

function TransportReadout({
  store,
  playing,
  bars,
  bpm,
  liveMeter,
  mode,
  clickSound,
  holdUntilCycle,
}: {
  store: PlayheadStore
  playing: boolean
  bars: number
  bpm: number
  liveMeter: string
  mode: RhythmMode
  clickSound: ClickSoundId
  holdUntilCycle: boolean
}) {
  const playhead = usePlayhead(store)
  return (
    <p
      className="min-w-0 truncate tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
      data-playhead-bar={playhead.bar}
      data-playhead-step={playhead.step}
      data-playhead-beat={playhead.beat}
    >
      {bpm} BPM · {liveMeter}
      {mode === 'click' ? ` · ${CLICK_SOUND_LABELS[clickSound]}` : ''}
      {playing && bars > 1 ? ` · bar ${playhead.bar + 1}` : ''}
      {holdUntilCycle ? ' · next cycle' : ''}
    </p>
  )
}

function PresetSheet({
  current,
  selectedId,
  onClose,
  onSelect,
}: {
  current: RhythmBar
  selectedId: string | null
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const selected = selectedId ? findPreset(selectedId) : undefined
  const local = RHYTHM_STYLES.filter((style) =>
    style.grooves.some((item) => item.beats === current.beats && item.beatUnit === current.beatUnit),
  )
  const others = RHYTHM_STYLES.filter(
    (style) => !style.grooves.some((item) => item.beats === current.beats && item.beatUnit === current.beatUnit),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="rhythm-presets-title"
        className="max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0F1422] p-5 md:max-w-2xl lg:max-w-4xl"
      >
        <h2 id="rhythm-presets-title" className="text-xl font-bold tracking-tight text-white">
          Beat library
        </h2>
        <PresetGroup
          title={`For ${meterLabel(current.beats, current.beatUnit)}`}
          styles={local}
          selected={selected}
          onSelect={onSelect}
        />
        {others.length > 0 ? (
          <PresetGroup title="Other meters" styles={others} selected={selected} onSelect={onSelect} />
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
  styles,
  selected,
  onSelect,
}: {
  title: string
  styles: RhythmStyle[]
  selected: RhythmPreset | undefined
  onSelect: (id: string) => void
}) {
  if (styles.length === 0) return null
  return (
    <section className="mt-4">
      <h3 className="px-1 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {styles.map((style) => (
          <StyleMenu
            key={style.id}
            style={style}
            selected={selected}
            defaultOpen={selected?.styleId === style.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}

function StyleMenu({
  style,
  selected,
  defaultOpen,
  onSelect,
}: {
  style: RhythmStyle
  selected: RhythmPreset | undefined
  defaultOpen: boolean
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const active = selected?.styleId === style.id
  const activeGroove = active ? selected : undefined

  return (
    <div
      data-style-menu={style.id}
      data-open={open ? 'true' : 'false'}
      className={cn(
        'overflow-hidden rounded-2xl border',
        active ? 'border-[#A855F7]/50 bg-[#A855F7]/10' : 'border-white/10 bg-white/3',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        data-style-toggle={style.id}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-white">{style.name}</span>
          <span className="block text-xs text-slate-400">
            {activeGroove ? `${activeGroove.name} · ${activeGroove.blurb}` : `${style.grooves.length} grooves`}
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 text-slate-400 transition', open && 'rotate-180 text-white')}
        />
      </button>
      {open ? (
        <div className="space-y-1 border-t border-white/8 px-2 pb-2 pt-1.5">
          {style.grooves.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              data-preset={item.id}
              className={cn(
                'flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left',
                item.id === selected?.id
                  ? 'bg-[#A855F7] text-white'
                  : 'bg-white/4 text-slate-200 hover:bg-white/8',
              )}
            >
              <span>
                <span className="block text-sm font-semibold">
                  {item.groove} · {item.blurb}
                </span>
              </span>
              <span className={cn('text-xs font-semibold', item.id === selected?.id ? 'text-white/80' : 'text-slate-500')}>
                {meterLabel(item.beats, item.beatUnit)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
