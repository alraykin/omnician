import { ChevronDown, Lock, Minus, Play, Plus, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AppChrome } from '@/components/AppChrome'
import { BpmWheel } from '@/components/rhythm/BpmWheel'
import { ClickAccentGrid } from '@/components/rhythm/ClickAccentGrid'
import { DrumGrid } from '@/components/rhythm/DrumGrid'
import { KitFaders } from '@/components/rhythm/KitFaders'
import { SnapWheel } from '@/components/rhythm/SnapWheel'
import { SubdivIcon } from '@/components/rhythm/SubdivIcons'
import { Button } from '@/components/ui/button'
import { useRhythmEngine } from '@/hooks/useRhythmEngine'
import { type KitGroupId, type KitMix } from '@/lib/kit-mix'
import {
  BEAT_UNITS,
  CLICK_SOUND_LABELS,
  CLICK_SOUNDS,
  DEFAULT_BPM,
  MAX_BARS,
  MIN_BEATS,
  MAX_BEATS,
  SUBDIVISION_LABELS,
  SUBDIVISIONS,
  UNIT_LABELS,
  clampBpm,
  cloneBar,
  cycleBeatAccent,
  cycleSubdivAccent,
  beatAccentAt,
  nestAccent,
  subdivAccentAt,
  meterLabel,
  patternToGrid,
  pulseLabel,
  setBarSubdivision,
  stepsPerBeat,
  toggleHit,
  updateBarMeter,
  type BeatUnit,
  type ClickSoundId,
  type RhythmBar,
  type RhythmMode,
  type SubdivisionId,
  type VoiceId,
} from '@/lib/rhythm'
import { playWheelTick } from '@/lib/rhythm-audio'
import { loadRhythmPrefs, saveRhythmPrefs } from '@/lib/rhythm-prefs'
import {
  RHYTHM_STYLES,
  barsForPreset,
  findPreset,
  matchPreset,
  type RhythmPreset,
  type RhythmStyle,
} from '@/lib/rhythm-presets'
import { cn } from '@/lib/utils'

const BEAT_VALUES = Array.from({ length: MAX_BEATS - MIN_BEATS + 1 }, (_, index) => index + MIN_BEATS)

export function RhythmPage() {
  const [searchParams] = useSearchParams()
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
  const [playing, setPlaying] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const tapTimes = useRef<number[]>([])

  const bars = mode === 'click' ? clickBars : drumBars
  const setBars = mode === 'click' ? setClickBars : setDrumBars
  const barIndex = mode === 'click' ? clickBarIndex : drumBarIndex
  const setBarIndex = mode === 'click' ? setClickBarIndex : setDrumBarIndex

  const current = bars[Math.min(barIndex, bars.length - 1)] ?? bars[0]
  const { playhead, preview, previewClick, ensureKit, holdUntilCycle } = useRhythmEngine({
    playing,
    bpm,
    mode,
    bars,
    clickSound,
    kitMix,
  })

  useEffect(() => {
    if (playing) setBarIndex(playhead.bar)
  }, [playhead.bar, playing, setBarIndex])

  const matched = current ? matchPreset(current) : null
  const edited = Boolean(matched === null && presetId)
  const savedPreset = presetId ? findPreset(presetId) : undefined
  const beatName = matched
    ? matched.name
    : savedPreset
      ? `${savedPreset.name} · edited`
      : 'Custom beat'

  useEffect(() => {
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
    })
  }, [
    clickBarIndex,
    clickBars,
    clickSound,
    drumBarIndex,
    drumBars,
    bpm,
    kitMix,
    matched?.id,
    mode,
    presetId,
  ])

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
    setBars((currentBars) => [...currentBars, cloneBar(current)])
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

  const onToggleCell = (voice: VoiceId, step: number) => {
    if (!current) return
    const nextPattern = toggleHit(
      current.pattern,
      voice,
      step,
      current.beats,
      current.subdivision,
    )
    patchBar(barIndex, { ...current, pattern: nextPattern })
    setPresetId(matched?.id ?? presetId)
    if (!current.pattern[voice][step] && nextPattern[voice][step]) {
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

  if (!current) return null

  const liveMeter = meterLabel(current.beats, current.beatUnit)

  return (
    <AppChrome align="fill" wide compact>
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          data-rhythm-scroll
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 [scrollbar-width:thin]"
        >
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Rhythm</h1>
            <div
              className="flex w-[11.5rem] shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#141A28] p-0.5"
              data-section="mode"
            >
              {(['click', 'drums'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={mode === item}
                  data-mode={item}
                  onClick={() => setMode(item)}
                  className={cn(
                    'h-9 flex-1 rounded-full text-sm font-semibold capitalize transition',
                    mode === item ? 'bg-[#A855F7] text-white' : 'text-slate-300 hover:text-white',
                  )}
                >
                  {item === 'click' ? 'Click' : 'Drums'}
                </button>
              ))}
            </div>
          </div>

          <section className="mt-2 rounded-2xl border border-white/10 bg-[#141A28]/80 px-2 py-2 sm:px-4">
            <div className="flex flex-col items-center">
              <BpmWheel value={bpm} onChange={(next) => changeBpm(next, true)} />
              <p className="relative z-20 mt-1 text-[0.65rem] text-slate-500">{pulseLabel(current.beatUnit)}</p>
              <div className="relative z-20 mt-1.5 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Slower by 5"
                  onClick={() => changeBpm(bpm - 5, true)}
                >
                  <Minus className="size-3.5" />
                  5
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={tapTempo}>
                  Tap
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Faster by 5"
                  onClick={() => changeBpm(bpm + 5, true)}
                >
                  <Plus className="size-3.5" />
                  5
                </Button>
              </div>
            </div>
          </section>

          <section
            className="mt-2.5 rounded-2xl border border-white/10 bg-[#141A28]/80 px-2.5 py-2.5 sm:px-4"
            data-bar-count={bars.length}
            data-rhythm-mode={mode}
          >
            <div className="mb-1.5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Bars · meter
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {bars.map((bar, index) => {
                const live = playing && playhead.bar === index
                return (
                  <button
                    key={`bar-${index}`}
                    type="button"
                    data-bar-pill={index}
                    onClick={() => setBarIndex(index)}
                    className={cn(
                      'h-8 min-w-8 rounded-lg px-2 text-sm font-semibold',
                      index === barIndex
                        ? 'bg-[#A855F7] text-white'
                        : 'border border-white/10 bg-white/4 text-slate-200',
                      live && 'omni-beat-pulse',
                    )}
                  >
                    {index + 1}
                    <span className="mx-1 text-[0.65rem] font-medium opacity-40">·</span>
                    <span className="text-[0.65rem] font-medium opacity-70">
                      {meterLabel(bar.beats, bar.beatUnit)}
                    </span>
                  </button>
                )
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={addBar}
                disabled={bars.length >= MAX_BARS}
              >
                <Plus className="size-3.5" />
                Bar
              </Button>
              {bars.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => removeBar(barIndex)}
                  aria-label="Remove this bar"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 sm:gap-4">
              <SnapWheel
                compact
                label="Beats"
                values={BEAT_VALUES}
                value={current.beats}
                onChange={(beats) => setMeter(beats, current.beatUnit)}
              />
              <p className="pt-4 text-2xl font-bold text-slate-500">/</p>
              <SnapWheel
                compact
                label="Beat unit"
                wide
                values={BEAT_UNITS}
                value={current.beatUnit}
                format={(unit) => `${unit} · ${UNIT_LABELS[unit]}`}
                onChange={(unit) => setMeter(current.beats, unit)}
              />
            </div>
          </section>

          <section className="mt-2.5">
            <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Subdivision
            </p>
            <div className="-mx-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
              <div
                role="group"
                aria-label="Subdivision"
                data-section="subdivision"
                className="flex w-max min-w-full justify-between gap-1 px-1"
              >
                {SUBDIVISIONS.map((steps) => (
                  <button
                    key={steps}
                    type="button"
                    aria-label={SUBDIVISION_LABELS[steps]}
                    title={SUBDIVISION_LABELS[steps]}
                    aria-pressed={current.subdivision === steps}
                    data-subdivision={steps}
                    onClick={() => setSubdivision(steps)}
                    className={cn(
                      'flex h-12 w-[2.85rem] shrink-0 items-center justify-center rounded-lg sm:h-14 sm:w-[3.2rem]',
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

          {mode === 'click' ? (
            <section className="mt-2.5 rounded-2xl border border-white/10 bg-[#141A28]/80 px-2.5 py-2.5 sm:px-4">
              <div className="mb-2 flex items-center gap-2.5">
                <div
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] sm:size-12',
                    playhead.beat >= 0
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
                    {playhead.beat < 0
                      ? '—'
                      : playhead.subdivision
                        ? `${playhead.beat + 1}·${(playhead.step % Math.max(1, stepsPerBeat(current.subdivision))) + 1}`
                        : playhead.beat + 1}
                  </span>
                </div>
                <p className="min-w-0 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Accents
                </p>
              </div>
              <ClickAccentGrid
                beats={current.beats}
                subdivision={current.subdivision}
                beatAccents={current.beatAccents}
                subdivAccents={current.subdivAccents}
                liveBeat={playhead.beat}
                liveStep={playhead.step}
                live={playing && playhead.bar === barIndex}
                onCycleBeat={(beat) => {
                  const next = cycleBeatAccent(current.beatAccents, beat, current.beats)
                  patchBar(barIndex, { ...current, beatAccents: next })
                  void previewClick(
                    clickSound,
                    nestAccent(beatAccentAt(next, beat), 0),
                    true,
                  )
                }}
                onCycleSubdiv={(slot) => {
                  const steps = stepsPerBeat(current.subdivision)
                  const next = cycleSubdivAccent(current.subdivAccents, slot, steps)
                  patchBar(barIndex, { ...current, subdivAccents: next })
                  void previewClick(
                    clickSound,
                    nestAccent(0, subdivAccentAt(next, slot, steps)),
                    false,
                  )
                }}
              />
              <div
                data-section="click-sound"
                className="mt-2.5 grid w-full grid-cols-4 gap-1"
              >
                {CLICK_SOUNDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    data-click-sound={id}
                    aria-pressed={clickSound === id}
                    onClick={() => {
                      setClickSound(id)
                      void previewClick(id)
                    }}
                    className={cn(
                      'h-8 min-w-0 rounded-lg px-1 text-[0.7rem] font-semibold sm:text-sm',
                      clickSound === id
                        ? 'bg-[#A855F7] text-white'
                        : 'border border-white/10 bg-white/4 text-slate-200',
                    )}
                  >
                    {CLICK_SOUND_LABELS[id]}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="mt-2.5">
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
              <DrumGrid
                beats={current.beats}
                subdivisionSteps={stepsPerBeat(current.subdivision)}
                pattern={patternToGrid(current.pattern, current.beats, current.subdivision)}
                currentStep={playhead.step}
                live={playing && playhead.bar === barIndex}
                onToggle={onToggleCell}
                onPreview={(voice) => void preview(voice)}
              />
              <KitFaders mix={kitMix} onChange={setGroupMix} />
              <p className="mt-1.5 text-center text-[0.65rem] leading-4 text-slate-600">
                Pearl Master Studio by enoe (CC BY 3.0)
              </p>
            </section>
          )}
        </div>

        <div
          data-section="transport"
          data-playhead-bar={playhead.bar}
          data-playhead-step={playhead.step}
          data-hold-until-cycle={holdUntilCycle ? 'true' : 'false'}
          className="relative z-40 shrink-0 border-t border-white/10 bg-[#0B0F1A]/95 pt-2 pb-[max(0.55rem,env(safe-area-inset-bottom))]"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[0.7rem] text-slate-400">
            <p className="min-w-0 truncate tabular-nums">
              {bpm} BPM · {liveMeter}
              {mode === 'click' ? ` · ${CLICK_SOUND_LABELS[clickSound]}` : ''}
              {playing && bars.length > 1 ? ` · bar ${playhead.bar + 1}` : ''}
              {holdUntilCycle ? ' · next cycle' : ''}
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
              <Lock className="size-3" />
              Speed Builder
            </span>
          </div>
          <Button
            type="button"
            size="lg"
            variant={playing ? 'outline' : 'default'}
            className="h-14 w-full text-base"
            data-transport="play"
            onClick={() => void startStop()}
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
        className="max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0F1422] p-5"
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
      <div className="space-y-2">
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
