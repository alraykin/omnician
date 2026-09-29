import { ChevronDown, Play, Square } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AppChrome } from '@/components/AppChrome'
import { AppTabBar } from '@/components/AppTabBar'
import { BarStrip } from '@/components/rhythm/BarStrip'
import { ClickAccentGrid } from '@/components/rhythm/ClickAccentGrid'
import { CompactMeter } from '@/components/rhythm/CompactMeter'
import { DrumBarStage } from '@/components/rhythm/DrumBarStage'
import { KitFaders } from '@/components/rhythm/KitFaders'
import { KitIntensityControl } from '@/components/rhythm/KitIntensity'
import { ListenTempoSheet } from '@/components/rhythm/ListenTempo'
import { RhythmTempoCard } from '@/components/rhythm/RhythmTempoCard'
import { SpeedBuilderPopup } from '@/components/rhythm/SpeedBuilderPopup'
import { SubdivIcon } from '@/components/rhythm/SubdivIcons'
import { Button } from '@/components/ui/button'
import { usePlayhead, useRhythmEngine, type PlayheadStore } from '@/hooks/useRhythmEngine'
import { clampStyleIntensity, snareRoleFromStep, type KitIntensity } from '@/lib/kit-intensity'
import { type KitGroupId, type KitMix } from '@/lib/kit-mix'
import {
  CLICK_SOUND_LABELS,
  CLICK_SOUNDS,
  DEFAULT_BPM,
  MAX_BARS,
  SUBDIVISIONS,
  subdivisionLabel,
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
import { onCaptureStarting, preparePlaybackFromGesture } from '@/lib/audio-context'
import { requestRawMic } from '@/lib/mic-capture'
import { playWheelTick } from '@/lib/rhythm-audio'
import { activateOnPointer, cn } from '@/lib/utils'
import { loadRhythmPrefs, saveRhythmPrefs } from '@/lib/rhythm-prefs'
import { type SpeedBuilder, type SpeedBuilderCue } from '@/lib/speed-builder'
import { detectTempo, synthesizeClickTrack, type TempoEstimate } from '@/lib/tempo-detect'
import { stopListenTempoPreview } from '@/lib/listen-preview'
import { getTempoListener } from '@/lib/tempo-listen'
import {
  RHYTHM_STYLES,
  barsForPreset,
  findPreset,
  matchPreset,
  type RhythmPreset,
  type RhythmStyle,
  type RhythmStyleId,
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
  const [volumeDb, setVolumeDb] = useState(prefs.volumeDb)
  const [kitIntensity, setKitIntensity] = useState<KitIntensity>(prefs.kitIntensity)
  const [playing, setPlaying] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [accentEdit, setAccentEdit] = useState(false)
  const [pickerBeat, setPickerBeat] = useState<number | null>(null)
  const [speedBuilder, setSpeedBuilder] = useState<SpeedBuilder>(prefs.speedBuilder)
  const [tempoCue, setTempoCue] = useState<SpeedBuilderCue | null>(null)
  const [listenOpen, setListenOpen] = useState(false)
  const [listenSeed, setListenSeed] = useState<TempoEstimate | null>(null)
  const [tempoNote, setTempoNote] = useState<string | null>(null)
  const tapTimes = useRef<number[]>([])

  const bars = mode === 'click' ? clickBars : drumBars
  const setBars = mode === 'click' ? setClickBars : setDrumBars
  const barIndex = mode === 'click' ? clickBarIndex : drumBarIndex
  const setBarIndex = mode === 'click' ? setClickBarIndex : setDrumBarIndex

  const current = bars[Math.min(barIndex, bars.length - 1)] ?? bars[0]
  const matched = current ? matchPreset(current) : null
  const edited = Boolean(matched === null && presetId)
  const savedPreset = presetId ? findPreset(presetId) : undefined
  const kitStyleId: RhythmStyleId = matched?.styleId ?? savedPreset?.styleId ?? 'rock'
  const beatName = matched
    ? matched.name
    : savedPreset
      ? `${savedPreset.name} · edited`
      : 'Custom beat'

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
    volumeDb,
    kitIntensity,
    kitStyle: kitStyleId,
    speedBuilder,
    onTempoCue: (cue) => {
      setTempoCue(cue)
    },
  })

  useEffect(() => {
    setKitIntensity((currentIntensity) => clampStyleIntensity(kitStyleId, currentIntensity))
  }, [kitStyleId])

  useEffect(() => {
    const resume = () => {
      void ensureKit()
    }
    window.addEventListener('pointerdown', resume)
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('pageshow', resume)
    return () => {
      window.removeEventListener('pointerdown', resume)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('pageshow', resume)
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
        volumeDb,
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
    volumeDb,
    matched?.id,
    mode,
    presetId,
    speedBuilder,
  ])

  useEffect(() => {
    if (urlMode === 'click' || urlMode === 'drums') {
      if (urlMode !== mode) {
        setAccentEdit(false)
        setPickerBeat(null)
        setMode(urlMode)
      }
      return
    }
    const params = new URLSearchParams(searchParams)
    params.set('mode', mode)
    setSearchParams(params, { replace: true })
  }, [urlMode, mode, searchParams, setSearchParams])

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
    setKitIntensity((current) => clampStyleIntensity(preset.styleId, current))
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
    setTempoNote(null)
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
    setTempoNote(null)
  }

  const openListen = () => {
    if (playing) {
      halt('listen-open')
      setPlaying(false)
    }
    const micPromise = requestRawMic()
    setListenSeed(null)
    setListenOpen(true)
    void getTempoListener().startMic(micPromise)
  }

  const applyDetectedTempo = (next: number, note: string) => {
    changeBpm(next)
    setTempoNote(note)
  }

  useEffect(() => {
    const raw = searchParams.get('listenDemo')
    if (!raw) return
    const demoBpm = Number(raw)
    if (!Number.isFinite(demoBpm) || demoBpm < 40 || demoBpm > 240) return
    const sr = 44100
    const samples = synthesizeClickTrack(demoBpm, sr, 8)
    const estimate = detectTempo(samples, sr)
    if (!estimate) return
    setListenSeed(estimate)
    setListenOpen(true)
    // Only seed from the URL once so mode switches don't reopen the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const startStop = useCallback(() => {
    if (listenOpen) {
      stopListenTempoPreview()
      setListenOpen(false)
      setListenSeed(null)
      void getTempoListener().cancel()
    }
    if (playing) {
      halt('user-stop')
      setPlaying(false)
      return
    }
    preparePlaybackFromGesture()
    void ensureKit().then((kit) => {
      if (speedBuilder.enabled && speedBuilder.announce) {
        kit?.preloadAnnounce()
        void kit?.ensureAnnounce(speedBuilder.fromPct)
      }
    })
    setPlaying(true)
  }, [ensureKit, halt, listenOpen, playing, speedBuilder.announce, speedBuilder.enabled, speedBuilder.fromPct])

  useEffect(() => {
    return () => {
      getTempoListener().release()
    }
  }, [])

  useEffect(() => {
    return onCaptureStarting(() => {
      halt('capture-starting')
      setPlaying(false)
    })
  }, [halt])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }
      event.preventDefault()
      void startStop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [startStop])

  if (!current) return null

  const liveMeter = meterLabel(current.beats, current.beatUnit)

  return (
    <AppChrome align="fill" wide compact wideTabPlacement="inline">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <SpeedBuilderPopup cue={tempoCue} />
        <ListenTempoSheet
          open={listenOpen}
          onClose={() => {
            setListenOpen(false)
            setListenSeed(null)
          }}
          onUse={applyDetectedTempo}
          speedBuilder={speedBuilder}
          currentBpm={bpm}
          seed={listenSeed}
        />
        <div
          data-rhythm-scroll
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-contain [scrollbar-width:thin] [touch-action:pan-y]"
        >
          <div
            data-rhythm-header
            className="rhythm-glass sticky top-0 z-30 flex items-center justify-between gap-3 rounded-full py-1.5 pl-4 pr-3"
          >
            <h1 className="text-lg font-bold tracking-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] sm:text-xl">
              {mode === 'click' ? 'Click' : 'Drums'}
            </h1>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {liveMeter}
            </p>
          </div>
          {tempoNote ? (
            <p className="mt-1.5 text-center text-xs leading-5 text-slate-400" data-tempo-note>
              {tempoNote}
            </p>
          ) : null}

          {mode === 'click' ? (
          <div
            data-rhythm-layout
            data-rhythm-mode="click"
            className="mt-1.5 flex flex-col gap-1.5 lg:flex-row lg:items-start lg:gap-3 xl:gap-4"
          >
            <div
              className="flex h-fit w-full shrink-0 flex-col gap-1.5 lg:w-[32.5rem] lg:max-w-[32.5rem] xl:w-[34rem] xl:max-w-[34rem]"
              data-rhythm-stack="controls"
            >
              <RhythmTempoCard
                bpm={bpm}
                liveBpm={liveBpm}
                playing={playing}
                speedBuilder={speedBuilder}
                volumeDb={volumeDb}
                onSpeedBuilder={setSpeedBuilder}
                onBpm={changeBpm}
                onTap={tapTempo}
                onListen={openListen}
                onVolume={setVolumeDb}
              />

              <section
                className="rounded-xl border border-white/10 bg-[#141A28]/80 px-2 py-1.5"
                data-bar-count={bars.length}
                data-rhythm-mode="click"
              >
                <CompactMeter
                  beats={current.beats}
                  beatUnit={current.beatUnit}
                  onChange={setMeter}
                />
              </section>

              <section>
                <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Subdivision
                </p>
                <div className="max-w-full overflow-x-hidden pb-0.5">
                  <div
                    role="group"
                    aria-label="Subdivision for all beats"
                    data-section="subdivision"
                    className="flex w-full min-w-0 flex-nowrap items-center gap-0.5 sm:gap-1"
                  >
                    {SUBDIVISIONS.map((steps) => {
                      const selected = current.beatSubdivisions.every((item) => item === steps)
                      return (
                        <button
                          key={steps}
                          type="button"
                          aria-label={subdivisionLabel(steps, current.beatUnit)}
                          title={subdivisionLabel(steps, current.beatUnit)}
                          aria-pressed={selected}
                          data-subdivision={steps}
                          data-subdivision-label={subdivisionLabel(steps, current.beatUnit)}
                          {...activateOnPointer(() => setSubdivision(steps))}
                          className={cn(
                            'flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg touch-manipulation sm:h-11',
                            selected
                              ? 'bg-[#A855F7] text-white'
                              : 'border border-white/10 bg-white/4 text-slate-100 hover:border-[#A855F7]/50',
                          )}
                        >
                          <SubdivIcon steps={steps} beatUnit={current.beatUnit} compact />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </section>

              <TransportDock
                place="inline"
                className="hidden shrink-0 lg:flex lg:flex-col"
                playing={playing}
                onToggle={() => void startStop()}
                holdUntilCycle={holdUntilCycle}
              >
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
              </TransportDock>
              <div className="hidden lg:block" data-inline-tabs>
                <AppTabBar placement="inline" />
              </div>
            </div>

            <div
              className="flex h-fit min-w-0 flex-1 flex-col gap-1.5"
              data-rhythm-stack="stage"
            >
            <section className="rounded-2xl border border-white/10 bg-[#141A28]/80 px-2.5 py-2 sm:px-4">
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

            <section className="rounded-xl border border-white/10 bg-[#141A28]/80 px-2 py-1.5">
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
              className="grid w-full grid-cols-4 gap-1"
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
          </div>
          ) : (
          <div
            data-rhythm-layout
            data-rhythm-mode="drums"
            className="mt-1.5 flex flex-col gap-1.5 lg:flex-row lg:items-start lg:gap-3 xl:gap-4"
          >
            <div
              className="flex h-fit w-full shrink-0 flex-col gap-1.5 lg:w-[32.5rem] lg:max-w-[32.5rem] xl:w-[34rem] xl:max-w-[34rem]"
              data-rhythm-stack="controls"
            >
              <RhythmTempoCard
                bpm={bpm}
                liveBpm={liveBpm}
                playing={playing}
                speedBuilder={speedBuilder}
                volumeDb={volumeDb}
                onSpeedBuilder={setSpeedBuilder}
                onBpm={changeBpm}
                onTap={tapTempo}
                onListen={openListen}
                onVolume={setVolumeDb}
                precountAlways
              />
              <section
                className="rounded-xl border border-white/10 bg-[#141A28]/80 px-2 py-1.5"
                data-bar-count={bars.length}
                data-rhythm-mode="drums"
              >
                <CompactMeter
                  beats={current.beats}
                  beatUnit={current.beatUnit}
                  onChange={setMeter}
                />
              </section>
              <section>
                <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Subdivision
                </p>
                <div className="max-w-full overflow-x-hidden pb-0.5">
                  <div
                    role="group"
                    aria-label="Subdivision"
                    data-section="subdivision"
                    className="flex w-full min-w-0 flex-nowrap items-center gap-0.5 sm:gap-1"
                  >
                    {SUBDIVISIONS.map((steps) => (
                      <button
                        key={steps}
                        type="button"
                        aria-label={subdivisionLabel(steps, current.beatUnit)}
                        title={subdivisionLabel(steps, current.beatUnit)}
                        aria-pressed={current.subdivision === steps}
                        data-subdivision={steps}
                        data-subdivision-label={subdivisionLabel(steps, current.beatUnit)}
                        {...activateOnPointer(() => setSubdivision(steps))}
                        className={cn(
                          'flex h-12 min-w-0 flex-1 items-center justify-center rounded-lg touch-manipulation sm:h-14 lg:h-10',
                          current.subdivision === steps
                            ? 'bg-[#A855F7] text-white'
                            : 'border border-white/10 bg-white/4 text-slate-100 hover:border-[#A855F7]/50',
                        )}
                      >
                        <SubdivIcon steps={steps} beatUnit={current.beatUnit} className="lg:hidden" />
                        <SubdivIcon steps={steps} beatUnit={current.beatUnit} compact className="hidden lg:block" />
                      </button>
                    ))}
                  </div>
                </div>
              </section>
              <TransportDock
                place="inline"
                className="hidden shrink-0 lg:flex lg:flex-col"
                playing={playing}
                onToggle={() => void startStop()}
                holdUntilCycle={holdUntilCycle}
              >
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
              </TransportDock>
              <div className="hidden lg:block" data-inline-tabs>
                <AppTabBar placement="inline" />
              </div>
            </div>
            <section className="flex h-fit min-h-0 min-w-0 flex-1 flex-col" data-rhythm-stack="stage">
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
              <KitIntensityControl styleId={kitStyleId} value={kitIntensity} onChange={setKitIntensity} />
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
        <TransportDock
          place="sticky"
          className="rhythm-glass z-40 shrink-0 border-t border-white/10 pt-2 pb-2 lg:hidden"
          playing={playing}
          onToggle={() => void startStop()}
          holdUntilCycle={holdUntilCycle}
        >
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
        </TransportDock>
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

function TransportDock({
  playing,
  onToggle,
  className,
  holdUntilCycle,
  place,
  children,
}: {
  playing: boolean
  onToggle: () => void
  className?: string
  holdUntilCycle: boolean
  place: 'inline' | 'sticky'
  children: ReactNode
}) {
  return (
    <div
      data-section="transport"
      data-transport-place={place}
      data-hold-until-cycle={holdUntilCycle ? 'true' : 'false'}
      className={className}
    >
      <div className="mb-1.5 text-[0.7rem] text-slate-200">{children}</div>
      <Button
        type="button"
        size="lg"
        variant={playing ? 'outline' : 'default'}
        className={cn(
          'h-14 w-full touch-manipulation text-base',
          playing && 'border-white/15 bg-[#141A28] text-white hover:bg-[#1A2033]',
        )}
        data-transport="play"
        {...activateOnPointer(onToggle)}
      >
        {playing ? <Square className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
        {playing ? 'Stop' : 'Play'}
      </Button>
    </div>
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
    if (wasPlaying.current && !playing && playhead.bar >= 0 && !playhead.precount) onBar(playhead.bar)
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
      className="min-w-0 truncate tabular-nums drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
      data-playhead-bar={playhead.bar}
      data-playhead-step={playhead.step}
      data-playhead-beat={playhead.beat}
      data-precount={playhead.precount ? 'true' : 'false'}
    >
      {bpm} BPM · {liveMeter}
      {mode === 'click' ? ` · ${CLICK_SOUND_LABELS[clickSound]}` : ''}
      {playing && playhead.precount && playhead.beat >= 0
        ? ` · count ${playhead.beat + 1}`
        : playing && bars > 1
          ? ` · bar ${playhead.bar + 1}`
          : ''}
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
