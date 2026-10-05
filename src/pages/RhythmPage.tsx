import { Check, ChevronDown, FileUp, Pencil, Play, Plus, Square, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AppChrome } from '@/components/AppChrome'
import { FactoryEditorBar, FactoryHistorySheet, FactoryNameSheet } from '@/components/FactoryEditorBar'
import { ClickSoundPicker } from '@/components/rhythm/ClickSoundPicker'
import { BarStrip } from '@/components/rhythm/BarStrip'
import { type BarMenuAction } from '@/components/rhythm/BarMenu'
import { ClickAccentGrid } from '@/components/rhythm/ClickAccentGrid'
import { CompactMeter } from '@/components/rhythm/CompactMeter'
import { DrumBarStage } from '@/components/rhythm/DrumBarStage'
import { DrumRecorderSheet, type DrumRecorderDemo } from '@/components/rhythm/DrumRecorderSheet'
import { RecordFab } from '@/components/rhythm/RecordFab'
import { KitFaders } from '@/components/rhythm/KitFaders'
import { ListenTempoSheet } from '@/components/rhythm/ListenTempo'
import { RhythmTempoCard } from '@/components/rhythm/RhythmTempoCard'
import { SpeedBuilderPopup } from '@/components/rhythm/SpeedBuilderPopup'
import { SubdivIcon } from '@/components/rhythm/SubdivIcons'
import { Button } from '@/components/ui/button'
import { useFactoryEditor } from '@/hooks/useFactoryEditor'
import { usePlayhead, useRhythmEngine, type PlayheadStore } from '@/hooks/useRhythmEngine'
import { defaultIntensityForStyle, type KitIntensity } from '@/lib/kit-intensity'
import { type KitGroupId, type KitMix } from '@/lib/kit-mix'
import {
  CLICK_SOUND_LABELS,
  MAX_BARS,
  SUBDIVISIONS,
  subdivisionLabel,
  clampBpm,
  beatAccentAt,
  cloneBar,
  cycleBeatAccent,
  defaultBeatAccents,
  meterLabel,
  makeBar,
  setBarSubdivision,
  setBeatSubdivision,
  setHit,
  emptyPattern,
  setHitPos,
  toggleHitSoft,
  updateBarMeter,
  type BeatUnit,
  type ClickSoundId,
  type RhythmBar,
  type RhythmMode,
  type SubdivisionId,
  type VoiceId,
} from '@/lib/rhythm'
import { loadRecordClick } from '@/lib/drum-recorder'
import { RECORDER_ENABLED } from '@/lib/features'
import { importMidiFile, importNoteLine } from '@/lib/midi-import'
import { loadMidiMap } from '@/lib/midi-map'
import {
  DEFAULT_DRUM_INPUT,
  hitForInputSlot,
  isInputDivision,
  makeBeatBoxesExampleBar,
  normalizeDrumInput,
  type InputDivision,
} from '@/lib/beat-boxes'
import { onCaptureStarting, preparePlaybackFromGesture } from '@/lib/audio-context'
import { requestRawMic } from '@/lib/mic-capture'
import { playWheelTick } from '@/lib/rhythm-audio'
import { activateOnPointer, cn } from '@/lib/utils'
import {
  autoCompleteBars,
  needsOverwriteConfirm,
  nextFillVariant,
  replaceFillBar,
  seedBars,
} from '@/lib/auto-complete'
import { loadRhythmPrefs, saveRhythmPrefs } from '@/lib/rhythm-prefs'
import {
  barsEqual,
  createUserBeat,
  deleteUserBeat,
  findUserBeat,
  loadUserBeats,
  makeBlankBeat,
  NEW_BEAT_BPM,
  renameUserBeat,
  saveUserBeats,
  upsertUserBeat,
  type UserBeat,
} from '@/lib/user-beats'
import { type SpeedBuilder, type SpeedBuilderCue } from '@/lib/speed-builder'
import { detectTempo, synthesizeClickTrack, type TempoEstimate } from '@/lib/tempo-detect'
import { stopListenTempoPreview } from '@/lib/listen-preview'
import { getTempoListener } from '@/lib/tempo-listen'
import {
  getRhythmStyles,
  barsForPreset,
  findPreset,
  matchPreset,
  subscribeRhythmStyles,
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
  const [userBeatId, setUserBeatId] = useState<string | null>(prefs.userBeatId)
  const [draftNew, setDraftNew] = useState(false)
  const [userBeats, setUserBeats] = useState<UserBeat[]>(() => loadUserBeats())
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveAsNew, setSaveAsNew] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [kitMix, setKitMix] = useState<KitMix>(prefs.kitMix)
  const [volumeDb, setVolumeDb] = useState(prefs.volumeDb)
  const [kitIntensity, setKitIntensity] = useState<KitIntensity>(prefs.kitIntensity)
  const [playing, setPlaying] = useState(false)
  const [recorderOpen, setRecorderOpen] = useState(() => {
    if (!RECORDER_ENABLED || typeof window === 'undefined') return false
    const query = new URLSearchParams(window.location.search)
    return query.get('recorder') === '1' || Boolean(query.get('rec'))
  })
  const [recording, setRecording] = useState(false)
  const [recordCountIn, setRecordCountIn] = useState(true)
  const [recordGuideClick, setRecordGuideClick] = useState(() => loadRecordClick())
  const recorderLoopRef = useRef<(() => void) | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [accentEdit, setAccentEdit] = useState(false)
  const [pickerBeat, setPickerBeat] = useState<number | null>(null)
  const [speedBuilder, setSpeedBuilder] = useState<SpeedBuilder>(prefs.speedBuilder)
  const [tempoCue, setTempoCue] = useState<SpeedBuilderCue | null>(null)
  const [listenOpen, setListenOpen] = useState(false)
  const [listenSeed, setListenSeed] = useState<TempoEstimate | null>(null)
  const [tempoNote, setTempoNote] = useState<string | null>(null)
  const [importedName, setImportedName] = useState<string | null>(null)
  const [drumInput, setDrumInput] = useState<InputDivision>(() => normalizeDrumInput(prefs.drumInput))
  const [importNote, setImportNote] = useState<string | null>(null)
  const midiFileRef = useRef<HTMLInputElement>(null)
  const tapTimes = useRef<number[]>([])
  const [clipBar, setClipBar] = useState<RhythmBar | null>(null)
  const [drumUndo, setDrumUndo] = useState<{
    bars: RhythmBar[]
    index: number
    fillVariant: number
  } | null>(null)
  const [fillVariant, setFillVariant] = useState(0)
  const [autoConfirm, setAutoConfirm] = useState(false)
  const [, setStyleTick] = useState(0)

  useEffect(() => subscribeRhythmStyles(() => setStyleTick((value) => value + 1)), [])

  const factory = useFactoryEditor({
    mode,
    presetId,
    bpm,
    drumBars,
    setBpm,
    setDrumBars,
    setDrumBarIndex,
    setPresetId,
    setUserBeatId,
    setDraftNew,
  })

  const bars = mode === 'click' ? clickBars : drumBars
  const setBars = mode === 'click' ? setClickBars : setDrumBars
  const barIndex = mode === 'click' ? clickBarIndex : drumBarIndex
  const setBarIndex = mode === 'click' ? setClickBarIndex : setDrumBarIndex

  const current = bars[Math.min(barIndex, bars.length - 1)] ?? bars[0]
  const matched = current && !userBeatId && !draftNew ? matchPreset(current) : null
  const edited = Boolean(matched === null && presetId && !userBeatId && !draftNew)
  const savedPreset = presetId ? findPreset(presetId) : undefined
  const savedUser = userBeatId ? findUserBeat(userBeatId, userBeats) : undefined
  const userDirty = Boolean(
    savedUser && (!barsEqual(drumBars, savedUser.bars) || savedUser.bpm !== bpm),
  )
  const kitStyleId: RhythmStyleId = matched?.styleId ?? savedPreset?.styleId ?? 'rock'
  const beatName =
    factory.visible && factory.name
      ? factory.name
      : savedUser
        ? userDirty
          ? `${savedUser.name} · edited`
          : savedUser.name
        : draftNew
          ? (importedName ?? 'New beat')
          : matched
            ? matched.name
            : savedPreset
              ? `${savedPreset.name} · edited`
              : 'Custom beat'
  const needsSave = draftNew || userDirty || edited

  useEffect(() => {
    if (mode !== 'click' || pickerBeat === null) return
    if (!current || pickerBeat >= current.beats) setPickerBeat(null)
  }, [current, mode, pickerBeat])

  const { playheadStore, preview, previewClick, previewBar, previewClickBar, ensureKit, holdUntilCycle, liveBpm, halt, getTransportClock } =
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
    loopBarIndex: null,
    recordCycle: recording,
    recordClick: recording && recordGuideClick,
    forcePrecount: recording ? recordCountIn : undefined,
    onBarLoop: () => {
      recorderLoopRef.current?.()
    },
  })

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
        userBeatId,
        drumInput,
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
    userBeatId,
    drumInput,
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

  const markDrumEdit = () => {
    if (!draftNew && !userBeatId) setPresetId(matched?.id ?? presetId)
  }

  const setMeter = (beats: number, beatUnit: BeatUnit) => {
    if (!current) return
    patchBar(barIndex, updateBarMeter(current, beats, beatUnit, current.subdivision))
    if (mode === 'drums') markDrumEdit()
  }

  const setSubdivision = (subdivision: SubdivisionId) => {
    setBars((currentBars) => currentBars.map((bar) => setBarSubdivision(bar, subdivision)))
    if (mode === 'drums') markDrumEdit()
    setPickerBeat(null)
  }

  const loadPreset = (id: string) => {
    const preset = findPreset(id)
    if (!preset) return
    setDrumBars(barsForPreset(preset).map(cloneBar))
    setDrumBarIndex(0)
    if (preset.bpm != null) setBpm(preset.bpm)
    if (isInputDivision(preset.subdivision)) setDrumInput(preset.subdivision)
    if (preset.styleId !== kitStyleId) {
      setKitIntensity(defaultIntensityForStyle(preset.styleId))
    }
    setPresetId(preset.id)
    setUserBeatId(null)
    setDraftNew(false)
    setImportedName(null)
    setImportNote(null)
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

  const applyDrumBars = (next: RhythmBar[], index: number) => {
    setDrumBars(next.map(cloneBar))
    setDrumBarIndex(Math.min(Math.max(0, index), next.length - 1))
    markDrumEdit()
  }

  const snapshotDrums = () => {
    setDrumUndo({ bars: drumBars.map(cloneBar), index: drumBarIndex, fillVariant })
  }

  const runAutoComplete = () => {
    if (seedBars(drumBars).length === 0) return
    snapshotDrums()
    setFillVariant(0)
    const next = autoCompleteBars(drumBars, 0)
    applyDrumBars(next, next.length - 1)
    setAutoConfirm(false)
  }

  const requestAutoComplete = () => {
    if (seedBars(drumBars).length === 0) return
    if (needsOverwriteConfirm(drumBars)) {
      setAutoConfirm(true)
      return
    }
    runAutoComplete()
  }

  const retryFill = () => {
    if (drumBars.length < MAX_BARS || seedBars(drumBars).length === 0) return
    snapshotDrums()
    const nextVariant = nextFillVariant(fillVariant)
    setFillVariant(nextVariant)
    applyDrumBars(replaceFillBar(drumBars, nextVariant), MAX_BARS - 1)
  }

  const undoDrums = () => {
    if (!drumUndo) return
    setDrumBars(drumUndo.bars.map(cloneBar))
    setDrumBarIndex(drumUndo.index)
    setFillVariant(drumUndo.fillVariant)
    setDrumUndo(null)
  }

  const onDrumBarMenu = (index: number, action: BarMenuAction) => {
    if (action === 'copy') {
      const bar = drumBars[index]
      if (bar) setClipBar(cloneBar(bar))
      return
    }
    if (action === 'paste') {
      if (!clipBar) return
      applyDrumBars(
        drumBars.map((bar, item) => (item === index ? cloneBar(clipBar) : bar)),
        index,
      )
      return
    }
    if (action === 'duplicate') {
      if (drumBars.length >= MAX_BARS) return
      const bar = drumBars[index]
      if (!bar) return
      applyDrumBars(
        [...drumBars.slice(0, index + 1), cloneBar(bar), ...drumBars.slice(index + 1)],
        index + 1,
      )
      return
    }
    if (action === 'clear') {
      const bar = drumBars[index]
      if (!bar) return
      const cleared = cloneBar(bar)
      cleared.pattern = emptyPattern()
      applyDrumBars(
        drumBars.map((item, itemIndex) => (itemIndex === index ? cleared : item)),
        index,
      )
      return
    }
    if (action === 'delete') {
      if (drumBars.length <= 1) return
      const next = drumBars.filter((_, item) => item !== index)
      applyDrumBars(next, Math.min(index, next.length - 1))
      return
    }
    if (action === 'auto') requestAutoComplete()
    if (action === 'retry-fill') retryFill()
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

  const onToggleCell = useCallback(
    (targetBar: number, voice: VoiceId, beat: number, slot: number, on: boolean, playPreview: boolean) => {
      const target = hitForInputSlot(beat, slot, drumInput)
      if (playPreview) preview(voice, 'normal')
      let changed = false
      setDrumBars((currentBars) => {
        const bar = currentBars[targetBar]
        if (!bar) return currentBars
        if (beat < 0 || beat >= bar.beats) return currentBars
        const nextPattern = setHitPos(bar.pattern, voice, target, on)
        if (nextPattern === bar.pattern) return currentBars
        changed = true
        return currentBars.map((item, index) =>
          index === targetBar ? { ...item, pattern: nextPattern } : item,
        )
      })
      if (changed && !draftNew && !userBeatId) setPresetId(matched?.id ?? presetId)
    },
    [draftNew, drumInput, matched?.id, presetId, preview, userBeatId],
  )

  const onToggleSoft = useCallback(
    (targetBar: number, voice: VoiceId, beat: number, slot: number) => {
      const target = hitForInputSlot(beat, slot, drumInput)
      let nextSoft = false
      let changed = false
      setDrumBars((currentBars) => {
        const bar = currentBars[targetBar]
        if (!bar) return currentBars
        const current = (bar.pattern[voice] ?? []).find((hit) => hit.beat === beat && hit.num * drumInput === slot * hit.den)
        if (!current) return currentBars
        nextSoft = !current.soft
        const nextPattern = toggleHitSoft(bar.pattern, voice, target)
        if (nextPattern === bar.pattern) return currentBars
        changed = true
        return currentBars.map((item, index) =>
          index === targetBar ? { ...item, pattern: nextPattern } : item,
        )
      })
      if (changed) {
        preview(voice, nextSoft ? 'ghost' : 'normal')
        if (!draftNew && !userBeatId) setPresetId(matched?.id ?? presetId)
      }
    },
    [draftNew, drumInput, matched?.id, presetId, preview, userBeatId],
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
      if (recorderOpen) return
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
  }, [recorderOpen, startStop])

  const recorderDemo = useMemo((): DrumRecorderDemo | undefined => {
    if (!RECORDER_ENABLED || typeof window === 'undefined') return undefined
    const query = new URLSearchParams(window.location.search)
    const rec = query.get('rec')
    if (!rec && query.get('keys') !== '1' && query.get('hits') !== '1') return undefined
    const hits =
      query.get('hits') === '1'
        ? [
            { voice: 'snare' as const, step: 4 },
            { voice: 'snare' as const, step: 12 },
            { voice: 'kick' as const, step: 8 },
          ]
        : undefined
    return {
      recording: rec === '1' || rec === 'count',
      countIn: rec === 'count',
      countBeat: rec === 'count' ? 3 : undefined,
      keysOn: query.get('keys') === '1' ? true : query.get('keys') === '0' ? false : undefined,
      pass: rec ? 2 : 1,
      hits,
      barIndex: (() => {
        const raw = Number(query.get('recBar'))
        return Number.isFinite(raw) && raw >= 1 ? raw - 1 : undefined
      })(),
    }
  }, [])

  const openRecorder = useCallback(() => {
    if (!RECORDER_ENABLED) return
    if (mode !== 'drums') setMode('drums')
    if (playing) {
      halt('recorder-open')
      setPlaying(false)
    }
    setRecording(false)
    setRecorderOpen(true)
  }, [halt, mode, playing])

  const closeRecorder = useCallback(() => {
    if (recording || playing) {
      halt('recorder-done')
      setPlaying(false)
    }
    setRecording(false)
    setRecorderOpen(false)
  }, [halt, playing, recording])

  const toggleRecord = useCallback(() => {
    if (recording) {
      halt('recorder-stop')
      setPlaying(false)
      setRecording(false)
      return
    }
    preparePlaybackFromGesture()
    void ensureKit()
    setDrumBarIndex(0)
    setRecording(true)
    setPlaying(true)
  }, [ensureKit, halt, recording])

  const patchRecordBar = useCallback(
    (index: number, next: RhythmBar) => {
      setDrumBars((currentBars) =>
        currentBars.map((item, itemIndex) => (itemIndex === index ? next : item)),
      )
      if (!draftNew && !userBeatId) setPresetId(matched?.id ?? presetId)
    },
    [draftNew, matched?.id, presetId, userBeatId],
  )

  const replaceRecordBars = useCallback(
    (next: RhythmBar[]) => {
      setDrumBars(next.map(cloneBar))
      if (!draftNew && !userBeatId) setPresetId(matched?.id ?? presetId)
    },
    [draftNew, matched?.id, presetId, userBeatId],
  )

  const persistBeats = (next: UserBeat[]) => {
    setUserBeats(next)
    saveUserBeats(next)
  }

  const startNewBeat = useCallback((opts?: { keepBpm?: boolean }) => {
    if (playing) {
      halt('new-beat')
      setPlaying(false)
      setRecording(false)
    }
    if (!opts?.keepBpm) setBpm(NEW_BEAT_BPM)
    setDrumBars(makeBlankBeat())
    setDrumBarIndex(0)
    setPresetId(null)
    setUserBeatId(null)
    setDraftNew(true)
    setImportedName(null)
    setImportNote(null)
    setRecordCountIn(true)
    setSpeedBuilder((current) => ({ ...current, precount: true }))
    setPickerOpen(false)
  }, [halt, playing])

  const startNewBeatAndRecord = useCallback(() => {
    startNewBeat({ keepBpm: true })
    preparePlaybackFromGesture()
    void ensureKit()
    setDrumBarIndex(0)
    setRecording(true)
    setPlaying(true)
  }, [ensureKit, startNewBeat])

  const openSave = (asNew = false) => {
    setSaveAsNew(asNew || !savedUser)
    setSaveName(asNew ? (importedName ?? '') : (savedUser?.name ?? importedName ?? ''))
    setSaveOpen(true)
  }

  const applyMidiImport = (file: File) => {
    void file.arrayBuffer().then((buffer) => {
      try {
        const result = importMidiFile(buffer, loadMidiMap(), file.name)
        if (playing) {
          halt('midi-import')
          setPlaying(false)
          setRecording(false)
        }
        setDrumBars(result.bars.map(cloneBar))
        setDrumBarIndex(0)
        setBpm(result.bpm)
        setPresetId(null)
        setUserBeatId(null)
        setDraftNew(true)
        setImportedName(result.name)
        setImportNote(importNoteLine(result))
        setPickerOpen(false)
      } catch {
        setImportNote('Couldn’t read that MIDI file.')
      }
    })
  }

  const commitSave = () => {
    const name = saveName.trim()
    if (!name) return
    const nextBeat =
      savedUser && !saveAsNew
        ? { ...savedUser, name, bpm, bars: drumBars.map(cloneBar), updatedAt: Date.now() }
        : createUserBeat(name, bpm, drumBars)
    persistBeats(upsertUserBeat(userBeats, nextBeat))
    setUserBeatId(nextBeat.id)
    setPresetId(null)
    setDraftNew(false)
    setImportedName(null)
    setSaveOpen(false)
  }

  const loadUser = (id: string) => {
    const beat = findUserBeat(id, userBeats)
    if (!beat) return
    if (playing) {
      halt('load-user-beat')
      setPlaying(false)
    }
    setDrumBars(beat.bars.map(cloneBar))
    setDrumBarIndex(0)
    setBpm(beat.bpm)
    setUserBeatId(beat.id)
    setPresetId(null)
    setDraftNew(false)
    setImportedName(null)
    setImportNote(null)
    setPickerOpen(false)
  }

  const renameSaved = (id: string, name: string) => {
    persistBeats(renameUserBeat(userBeats, id, name))
  }

  const deleteSaved = (id: string) => {
    persistBeats(deleteUserBeat(userBeats, id))
    if (userBeatId === id) {
      setUserBeatId(null)
      setDraftNew(true)
    }
  }

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    if (query.get('myBeats') === '1') {
      let pattern = emptyPattern()
      pattern = setHit(pattern, 'kick', 0, 4, 4, true)
      pattern = setHit(pattern, 'kick', 8, 4, 4, true)
      pattern = setHit(pattern, 'snare', 4, 4, 4, true)
      pattern = setHit(pattern, 'snare', 12, 4, 4, true)
      const demo = createUserBeat('Practice groove', 120, [makeBar(4, 4, 4, pattern)], 'ub-demo-practice')
      persistBeats(upsertUserBeat(loadUserBeats(), demo))
    }
    if (query.get('newBeat') === '1') startNewBeat()
    if (query.get('save') === '1') {
      startNewBeat()
      setSaveAsNew(true)
      setSaveName('')
      setSaveOpen(true)
    }
    if (query.get('library') === '1') setPickerOpen(true)
    if (query.get('beatboxes') === '1') {
      if (playing) {
        halt('beatboxes-demo')
        setPlaying(false)
      }
      setDrumBars([makeBeatBoxesExampleBar()])
      setDrumBarIndex(0)
      setPresetId(null)
      setUserBeatId(null)
      setDraftNew(true)
      setImportedName('Beat boxes')
      setDrumInput(DEFAULT_DRUM_INPUT)
      setMode('drums')
    }
    if (query.get('ghost') === '1') {
      const preset = findPreset('rock-44')
      if (preset) {
        if (playing) {
          halt('ghost-demo')
          setPlaying(false)
        }
        setDrumBars(barsForPreset(preset).map(cloneBar))
        setDrumBarIndex(1)
        if (preset.bpm != null) setBpm(preset.bpm)
        setPresetId(preset.id)
        setUserBeatId(null)
        setDraftNew(false)
        setImportedName(null)
        setMode('drums')
        setDrumInput(4)
      }
    }
    if (query.get('seed') === 'rock1') {
      const preset = findPreset('rock-44')
      if (preset) {
        const first = barsForPreset(preset)[0]
        if (first) {
          if (playing) {
            halt('rock1-seed')
            setPlaying(false)
          }
          setDrumBars([cloneBar(first)])
          setDrumBarIndex(0)
          if (preset.bpm != null) setBpm(preset.bpm)
          setPresetId(preset.id)
          setUserBeatId(null)
          setDraftNew(false)
          setImportedName(null)
          setMode('drums')
        }
      }
    }
    // Seed demo UI from the URL once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!current) return null

  const liveMeter = meterLabel(current.beats, current.beatUnit)

  const recordControl =
    RECORDER_ENABLED && mode === 'drums' ? (
      <RecordFab
        onOpen={openRecorder}
        showTip={
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('tip') === '1'
        }
      />
    ) : null

  return (
    <AppChrome
      align="fill"
      wide
      compact
      headerTrailing={
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {liveMeter}
        </p>
      }
    >
      <div className="relative flex min-h-0 flex-1 flex-col wide:block">
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
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-contain [scrollbar-width:thin] [touch-action:pan-y] wide:overflow-x-clip wide:overflow-y-visible wide:overscroll-auto"
        >
          {tempoNote ? (
            <p className="mt-1.5 text-center text-xs leading-5 text-slate-400" data-tempo-note>
              {tempoNote}
            </p>
          ) : null}
          {importNote && mode === 'drums' ? (
            <p className="mt-1.5 text-center text-xs leading-5 text-slate-400" data-midi-import-note>
              {importNote}
            </p>
          ) : null}

          {mode === 'click' ? (
          <div
            data-rhythm-layout
            data-rhythm-mode="click"
            className="mt-1.5 flex flex-col gap-1.5 wide:flex-row wide:items-start wide:gap-3 xl:gap-4"
          >
            <div
              className="flex h-fit w-full shrink-0 flex-col gap-1.5 wide:w-[min(32.5rem,48%)] wide:max-w-[32.5rem] xl:w-[34rem] xl:max-w-[34rem]"
              data-rhythm-stack="controls"
            >
              <RhythmTempoCard
                bpm={bpm}
                liveBpm={liveBpm}
                playing={playing}
                mode={mode}
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

              <section className="rounded-xl border border-white/10 bg-[#141A28]/80 px-2 py-2">
                <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Click sound
                </p>
                <ClickSoundPicker value={clickSound} onChange={setClickSound} />
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
                className="hidden shrink-0 wide:flex wide:flex-col"
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

            </div>
          </div>
          ) : (
          <div
            data-rhythm-layout
            data-rhythm-mode="drums"
            className="mt-1.5 flex flex-col gap-1.5 wide:flex-row wide:items-start wide:gap-3 xl:gap-4"
          >
            <div
              className="flex h-fit w-full shrink-0 flex-col gap-1.5 wide:w-[min(32.5rem,48%)] wide:max-w-[32.5rem] xl:w-[34rem] xl:max-w-[34rem]"
              data-rhythm-stack="controls"
            >
              <RhythmTempoCard
                bpm={bpm}
                liveBpm={liveBpm}
                playing={playing}
                mode={mode}
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
                data-rhythm-mode="drums"
              >
                <CompactMeter
                  beats={current.beats}
                  beatUnit={current.beatUnit}
                  onChange={setMeter}
                />
              </section>
              <TransportDock
                place="inline"
                className="hidden shrink-0 wide:flex wide:flex-col"
                playing={playing}
                onToggle={() => void startStop()}
                holdUntilCycle={holdUntilCycle}
                extra={recordControl}
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
            <section className="flex h-fit min-h-0 min-w-0 flex-1 flex-col" data-rhythm-stack="stage">
              {factory.visible ? (
                <FactoryEditorBar
                  library={factory.library}
                  selectedId={presetId}
                  name={factory.name}
                  styleId={factory.styleId}
                  dirty={factory.dirty}
                  canSaveDefault={factory.canSaveDefault}
                  saving={factory.saving}
                  error={factory.error}
                  notice={factory.notice}
                  displayName={beatName}
                  onStyle={factory.onStyle}
                  onMove={factory.onMove}
                  onNew={factory.onNew}
                  onDelete={() => void factory.onDelete()}
                  onSaveDefault={() => void factory.onSaveDefault()}
                  onHistory={() => void factory.openHistory()}
                  onSignOut={() => factory.setAdmin(false)}
                  onOpenSaveNew={() => factory.setPrompt('save-new')}
                  onOpenRename={() => factory.setPrompt('rename')}
                />
              ) : null}
              <div className="relative mb-1.5 flex h-10 items-center gap-1">
                <button
                  type="button"
                  data-beat-library
                  onClick={() => setPickerOpen(true)}
                  className="flex h-10 min-w-0 flex-1 items-center justify-between rounded-xl border border-white/10 bg-[#141A28] px-2.5 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-[0.58rem] font-semibold uppercase leading-none tracking-[0.12em] text-[#C084FC]">
                      Beat library
                    </span>
                    <span className="mt-0.5 block truncate text-[0.8rem] font-semibold leading-none text-white">
                      {beatName}
                    </span>
                  </span>
                  <span className="ml-1.5 shrink-0 text-[0.7rem] font-semibold text-slate-400">Change</span>
                </button>
                {needsSave && !factory.visible ? (
                  <Button
                    type="button"
                    size="sm"
                    data-save-beat
                    onClick={() => openSave(false)}
                    className="h-10 shrink-0 px-2.5 text-xs"
                  >
                    Save
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-import-midi
                  onClick={() => midiFileRef.current?.click()}
                  className="h-10 shrink-0 gap-1 px-2 text-xs"
                >
                  <FileUp className="size-3.5" />
                  Import
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-new-beat
                  onClick={() => startNewBeat()}
                  className="h-10 shrink-0 gap-1 px-2 text-xs"
                >
                  <Plus className="size-3.5" />
                  New
                </Button>
                <input
                  ref={midiFileRef}
                  type="file"
                  accept=".mid,.midi,audio/midi,audio/x-midi,audio/mid"
                  data-midi-file
                  className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) applyMidiImport(file)
                  }}
                />
              </div>
              <div className="mb-1.5 rounded-xl border border-white/10 bg-[#141A28]/80 px-2 py-1">
                <BarStrip
                  store={playheadStore}
                  bars={drumBars}
                  barIndex={drumBarIndex}
                  playing={playing}
                  canAdd={drumBars.length < MAX_BARS}
                  onSelect={chooseDrumBar}
                  onAdd={addBar}
                  onRemove={() => removeBar(drumBarIndex)}
                  menu={{
                    canPaste: clipBar != null,
                    canDuplicate: drumBars.length < MAX_BARS,
                    canDelete: drumBars.length > 1,
                    canAutoComplete: seedBars(drumBars).length > 0,
                    canRetryFill: drumBars.length >= MAX_BARS && seedBars(drumBars).length > 0,
                    onAction: onDrumBarMenu,
                  }}
                  tools={
                    <>
                      <button
                        type="button"
                        data-auto-complete
                        disabled={seedBars(drumBars).length === 0}
                        onClick={requestAutoComplete}
                        className="h-7 rounded-md border border-white/12 px-2 text-[0.7rem] font-semibold text-slate-100 disabled:opacity-40"
                      >
                        Auto-complete
                      </button>
                      {drumBars.length >= MAX_BARS ? (
                        <button
                          type="button"
                          data-auto-retry-fill
                          disabled={seedBars(drumBars).length === 0}
                          onClick={retryFill}
                          className="h-7 rounded-md border border-white/12 px-2 text-[0.7rem] font-semibold text-slate-100 disabled:opacity-40"
                        >
                          Try another fill
                        </button>
                      ) : null}
                      {drumUndo ? (
                        <button
                          type="button"
                          data-auto-undo
                          onClick={undoDrums}
                          className="h-7 rounded-md bg-[#A855F7] px-2 text-[0.7rem] font-semibold text-white"
                        >
                          Undo
                        </button>
                      ) : null}
                    </>
                  }
                />
              </div>
              <DrumBarStage
                bars={drumBars}
                barIndex={drumBarIndex}
                playing={playing}
                playheadStore={playheadStore}
                input={drumInput}
                onInput={setDrumInput}
                onToggle={onToggleCell}
                onToggleSoft={onToggleSoft}
                onPreviewVoice={preview}
              />
              <KitFaders
                mix={kitMix}
                intensity={kitIntensity}
                onChange={setGroupMix}
                onIntensityChange={setKitIntensity}
              />
            </section>
          </div>
          )}
        </div>

        <PlayheadBarSync store={playheadStore} playing={playing} onBar={setBarIndex} />
        <TransportDock
          place="sticky"
          className="rhythm-glass z-40 shrink-0 border-t border-white/10 pt-2 pb-[max(0.7rem,env(safe-area-inset-bottom,0px))] wide:hidden"
          playing={playing}
          onToggle={() => void startStop()}
          holdUntilCycle={holdUntilCycle}
          extra={recordControl}
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

      {factory.historyOpen ? (
        <FactoryHistorySheet
          versions={factory.versions}
          onClose={() => factory.setHistoryOpen(false)}
          onRestore={(id) => void factory.onRestore(id)}
        />
      ) : null}

      {factory.prompt ? (
        <FactoryNameSheet
          mode={factory.prompt}
          name={factory.prompt === 'rename' ? factory.name : ''}
          styleId={factory.styleId}
          saving={factory.saving}
          onClose={() => factory.setPrompt(null)}
          onSubmit={(nextName, nextStyle) => {
            if (factory.prompt === 'rename') factory.onRename(nextName)
            else void factory.onSaveAsNew(nextName, nextStyle)
          }}
        />
      ) : null}

      {pickerOpen ? (
        <PresetSheet
          current={current}
          selectedId={userBeatId || draftNew ? null : (matched?.id ?? presetId)}
          selectedUserId={userBeatId}
          userBeats={userBeats}
          onClose={() => setPickerOpen(false)}
          onSelect={loadPreset}
          onLoadUser={loadUser}
          onRename={renameSaved}
          onDelete={deleteSaved}
        />
      ) : null}

      {saveOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <form
            role="dialog"
            aria-labelledby="save-beat-title"
            data-save-dialog
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0F1422] p-5"
            onSubmit={(event) => {
              event.preventDefault()
              commitSave()
            }}
          >
            <h2 id="save-beat-title" className="text-xl font-bold tracking-tight text-white">
              {saveAsNew || !savedUser ? 'Save beat' : 'Save changes'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Saved on this phone or computer only — no account needed.
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Name
              <input
                autoFocus
                value={saveName}
                maxLength={40}
                placeholder="My groove"
                onChange={(event) => setSaveName(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-[#A855F7]"
              />
            </label>
            <Button type="submit" className="mt-4 w-full" disabled={!saveName.trim()} data-save-confirm>
              {saveAsNew || !savedUser ? 'Save' : 'Update'}
            </Button>
            {savedUser && !saveAsNew ? (
              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full"
                data-save-as-new
                onClick={() => {
                  setSaveAsNew(true)
                  if (!saveName.trim()) setSaveName(savedUser.name)
                }}
              >
                Save as new
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="mt-2 w-full" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
          </form>
        </div>
      ) : null}

      {autoConfirm ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="auto-complete-title"
            data-auto-confirm
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0F1422] p-5"
          >
            <h2 id="auto-complete-title" className="text-xl font-bold tracking-tight text-white">
              Replace bars 2–8?
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Those bars already have notes. Auto-complete will overwrite them with a new 8-bar phrase
              from this groove.
            </p>
            <Button type="button" className="mt-4 w-full" data-auto-confirm-replace onClick={runAutoComplete}>
              Replace
            </Button>
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-full"
              data-auto-confirm-cancel
              onClick={() => setAutoConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {RECORDER_ENABLED && mode === 'drums' ? (
        <DrumRecorderSheet
          open={recorderOpen}
          onClose={closeRecorder}
          bars={drumBars}
          barIndex={drumBarIndex}
          bpm={bpm}
          beatName={beatName}
          recording={recording}
          playing={playing}
          playheadStore={playheadStore}
          getClock={getTransportClock}
          onChangeBar={patchRecordBar}
          onReplaceBars={replaceRecordBars}
          onBpm={changeBpm}
          onTapTempo={tapTempo}
          onToggleRecord={toggleRecord}
          onNewBeatAndRecord={startNewBeatAndRecord}
          onPreview={preview}
          onLoopRef={recorderLoopRef}
          countIn={recordCountIn}
          onCountIn={setRecordCountIn}
          clickOn={recordGuideClick}
          onClickOn={setRecordGuideClick}
          demo={recorderDemo}
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
  extra,
  children,
}: {
  playing: boolean
  onToggle: () => void
  className?: string
  holdUntilCycle: boolean
  place: 'inline' | 'sticky'
  extra?: ReactNode
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
      <div className={cn('flex items-center gap-2', extra && 'pr-0.5')}>
        <Button
          type="button"
          size="lg"
          variant={playing ? 'outline' : 'default'}
          className={cn(
            'h-14 min-w-0 flex-1 touch-manipulation text-base',
            playing && 'border-white/15 bg-[#141A28] text-white hover:bg-[#1A2033]',
          )}
          data-transport="play"
          {...activateOnPointer(onToggle)}
        >
          {playing ? <Square className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          {playing ? 'Stop' : 'Play'}
        </Button>
        {extra}
      </div>
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
  selectedUserId,
  userBeats,
  onClose,
  onSelect,
  onLoadUser,
  onRename,
  onDelete,
}: {
  current: RhythmBar
  selectedId: string | null
  selectedUserId: string | null
  userBeats: UserBeat[]
  onClose: () => void
  onSelect: (id: string) => void
  onLoadUser: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  const selected = selectedId ? findPreset(selectedId) : undefined
  const styles = getRhythmStyles()
  const local = styles.filter((style) =>
    style.grooves.some((item) => item.beats === current.beats && item.beatUnit === current.beatUnit),
  )
  const others = styles.filter(
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
        <MyBeatsSection
          beats={userBeats}
          selectedId={selectedUserId}
          onLoad={onLoadUser}
          onRename={onRename}
          onDelete={onDelete}
        />
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

function MyBeatsSection({
  beats,
  selectedId,
  onLoad,
  onRename,
  onDelete,
}: {
  beats: UserBeat[]
  selectedId: string | null
  onLoad: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <section className="mt-4" data-my-beats>
      <h3 className="px-1 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#C084FC]">
        My beats
      </h3>
      {beats.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-3 py-3 text-sm text-slate-500">
          Nothing saved yet. Tap + New, then Save.
        </p>
      ) : (
        <div className="space-y-1.5">
          {beats.map((beat) => (
            <MyBeatRow
              key={beat.id}
              beat={beat}
              selected={beat.id === selectedId}
              onLoad={onLoad}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function MyBeatRow({
  beat,
  selected,
  onLoad,
  onRename,
  onDelete,
}: {
  beat: UserBeat
  selected: boolean
  onLoad: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(beat.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const commitRename = () => {
    const next = name.trim()
    if (next) onRename(beat.id, next)
    else setName(beat.name)
    setRenaming(false)
  }

  return (
    <div
      data-user-beat={beat.id}
      className={cn(
        'rounded-2xl border px-2.5 py-2',
        selected ? 'border-[#A855F7]/50 bg-[#A855F7]/10' : 'border-white/10 bg-white/3',
      )}
    >
      {confirmDelete ? (
        <div className="flex items-center gap-2" data-delete-confirm>
          <p className="min-w-0 flex-1 text-sm font-semibold text-white">Delete “{beat.name}”?</p>
          <Button type="button" size="sm" className="h-8 px-2.5" onClick={() => onDelete(beat.id)}>
            Delete
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 px-2.5" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
        </div>
      ) : renaming ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename()
              if (event.key === 'Escape') {
                setName(beat.name)
                setRenaming(false)
              }
            }}
            className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 text-sm font-semibold text-white outline-none focus:border-[#A855F7]"
          />
          <button
            type="button"
            aria-label="Save name"
            className="flex size-8 items-center justify-center rounded-lg bg-[#A855F7] text-white"
            onClick={commitRename}
          >
            <Check className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Cancel rename"
            className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-slate-400"
            onClick={() => {
              setName(beat.name)
              setRenaming(false)
            }}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onLoad(beat.id)}
            className="min-w-0 flex-1 py-0.5 text-left"
          >
            <span className="block truncate text-sm font-semibold text-white">{beat.name}</span>
            <span className="block text-[0.7rem] text-slate-500">
              {beat.bpm} BPM · {beat.bars.length} {beat.bars.length === 1 ? 'bar' : 'bars'}
            </span>
          </button>
          <button
            type="button"
            aria-label={`Rename ${beat.name}`}
            data-rename-beat={beat.id}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/8 hover:text-white"
            onClick={() => {
              setName(beat.name)
              setRenaming(true)
            }}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${beat.name}`}
            data-delete-beat={beat.id}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/8 hover:text-rose-300"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
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
                  {item.name}
                </span>
                <span className={cn('block text-xs', item.id === selected?.id ? 'text-white/80' : 'text-slate-500')}>
                  {item.blurb}
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
