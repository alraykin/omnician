import { Check, ChevronDown, FileUp, GripVertical, Pencil, Play, Plus, Redo2, Square, Trash2, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'

import { AppChrome } from '@/components/AppChrome'
import { ClickLaptop } from '@/components/fold/ClickLaptop'
import { ClickTent } from '@/components/fold/ClickTent'
import { DrumsLaptop } from '@/components/fold/DrumsLaptop'
import { OverlayHost, SheetBackdrop, SheetHeader } from '@/components/SheetClose'
import { FactoryEditorBar, FactoryHistorySheet, FactoryNameSheet } from '@/components/FactoryEditorBar'
import { ClickPresetChip, ClickPresetsSheet } from '@/components/rhythm/ClickPresets'
import { ClickSoundPicker } from '@/components/rhythm/ClickSoundPicker'
import { BarStrip } from '@/components/rhythm/BarStrip'
import { type BarMenuAction } from '@/components/rhythm/BarMenu'
import { ClickAccentGrid } from '@/components/rhythm/ClickAccentGrid'
import { CompactMeter } from '@/components/rhythm/CompactMeter'
import { DrumBarStage } from '@/components/rhythm/DrumBarStage'
import { DrumEditorOverlay } from '@/components/rhythm/DrumEditorOverlay'
import { DrumRecorderSheet, type DrumRecorderDemo } from '@/components/rhythm/DrumRecorderSheet'
import { RecordFab } from '@/components/rhythm/RecordFab'
import { KitFaders } from '@/components/rhythm/KitFaders'
import { RhythmTempoCard } from '@/components/rhythm/RhythmTempoCard'
import { SpeedBuilderPopup } from '@/components/rhythm/SpeedBuilderPopup'
import { SubdivIcon } from '@/components/rhythm/SubdivIcons'
import { Button } from '@/components/ui/button'
import { useFactoryEditor } from '@/hooks/useFactoryEditor'
import { useCoverPortraitRail, useDuoOuterDisplay } from '@/hooks/useDuoLayout'
import { useToolFoldLayout } from '@/hooks/useFoldMode'
import { useCompactViewport, usePortraitViewport, useViewportSize } from '@/hooks/usePhoneViewport'
import { usePlayhead, useRhythmEngine, type PlayheadStore, type TransportClock } from '@/hooks/useRhythmEngine'
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
  isHitSoft,
  moveHitAcrossBars,
  moveHitPos,
  sameHit,
  setHitPos,
  placeOrToggleSoft,
  updateBarMeter,
  type BeatUnit,
  type ClickSoundId,
  type RhythmBar,
  type RhythmMode,
  type SubdivisionId,
  type VoiceId,
} from '@/lib/rhythm'
import { loadRecordClick } from '@/lib/drum-recorder'
import { AUTO_COMPLETE_ENABLED, RECORDER_ENABLED } from '@/lib/features'
import { setPhoneDrumsSurface } from '@/lib/phone-viewport'
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
import {
  bindNowPlayingTransport,
  clearNowPlaying,
  formatNowPlayingSubtitle,
  publishNowPlaying,
} from '@/lib/now-playing'
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
  createClickPreset,
  deleteClickPreset,
  findClickPreset,
  loadClickPresetStore,
  nextClickPresetName,
  renameClickPreset,
  saveClickPresetStore,
  upsertClickPreset,
  type ClickPresetStore,
} from '@/lib/click-presets'
import {
  captureDrumSnapshot,
  emptyDrumHistory,
  pushDrumHistory,
  redoDrumHistory,
  undoDrumHistory,
} from '@/lib/drum-history'
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
import { overlayListColumns } from '@/lib/overlay-bounds'
import { modeFromPath, toolPath } from '@/lib/tool-routes'
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
  const location = useLocation()
  const navigate = useNavigate()
  const prefs = useMemo(() => loadRhythmPrefs(), [])
  const mode: RhythmMode = modeFromPath(location.pathname) ?? prefs.mode
  const [bpm, setBpm] = useState(prefs.bpm)
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
  const [importedName, setImportedName] = useState<string | null>(null)
  const [drumInput, setDrumInput] = useState<InputDivision>(() => normalizeDrumInput(prefs.drumInput))
  const [importNote, setImportNote] = useState<string | null>(null)
  const midiFileRef = useRef<HTMLInputElement>(null)
  const tapTimes = useRef<number[]>([])
  const [clipBar, setClipBar] = useState<RhythmBar | null>(null)
  const [fillVariant, setFillVariant] = useState(0)
  const [clickPresetStore, setClickPresetStore] = useState<ClickPresetStore>(() => loadClickPresetStore())
  const [clickPresetsOpen, setClickPresetsOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('clickPresets') === '1'
  })
  const historyRef = useRef(emptyDrumHistory())
  const [historyUi, setHistoryUi] = useState({ undo: 0, redo: 0 })
  const [autoConfirm, setAutoConfirm] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const compact = useCompactViewport()
  const portrait = usePortraitViewport()
  const coverRail = useCoverPortraitRail()
  const drumsFold = useToolFoldLayout('drums')
  const clickFold = useToolFoldLayout('click')
  const [, setStyleTick] = useState(0)

  useEffect(() => subscribeRhythmStyles(() => setStyleTick((value) => value + 1)), [])

  const drumHistoryResetRef = useRef(() => {})
  const factory = useFactoryEditor({
    mode,
    presetId,
    bpm,
    drumBars,
    setBpm,
    setDrumBars: (next) => {
      drumHistoryResetRef.current()
      setDrumBars(next)
    },
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
  const loadedClickPreset = findClickPreset(clickPresetStore, clickPresetStore.loadedId)
  const clickSnap = {
    bpm,
    clickSound,
    bars: clickBars,
    speedBuilder,
  }

  const drumSessionRef = useRef({
    bars: drumBars,
    index: drumBarIndex,
    fillVariant,
    drumInput,
  })
  drumSessionRef.current = { bars: drumBars, index: drumBarIndex, fillVariant, drumInput }

  const snapshotNow = () =>
    captureDrumSnapshot(
      drumSessionRef.current.bars,
      drumSessionRef.current.index,
      drumSessionRef.current.fillVariant,
      drumSessionRef.current.drumInput,
    )

  const rememberDrums = () => {
    historyRef.current = pushDrumHistory(historyRef.current, snapshotNow())
    setHistoryUi({ undo: historyRef.current.past.length, redo: historyRef.current.future.length })
  }

  const resetDrumHistory = () => {
    historyRef.current = emptyDrumHistory()
    setHistoryUi({ undo: 0, redo: 0 })
  }
  drumHistoryResetRef.current = resetDrumHistory

  const applyDrumSnapshot = (snapshot: ReturnType<typeof captureDrumSnapshot>) => {
    setDrumBars(snapshot.bars.map(cloneBar))
    setDrumBarIndex(snapshot.barIndex)
    setFillVariant(snapshot.fillVariant)
    setDrumInput(snapshot.drumInput)
  }

  const undoDrums = () => {
    const result = undoDrumHistory(historyRef.current, snapshotNow())
    if (!result) return
    historyRef.current = result.history
    setHistoryUi({ undo: result.history.past.length, redo: result.history.future.length })
    applyDrumSnapshot(result.snapshot)
  }

  const redoDrums = () => {
    const result = redoDrumHistory(historyRef.current, snapshotNow())
    if (!result) return
    historyRef.current = result.history
    setHistoryUi({ undo: result.history.past.length, redo: result.history.future.length })
    applyDrumSnapshot(result.snapshot)
  }

  const persistClickPresets = (next: ClickPresetStore) => {
    setClickPresetStore(next)
    saveClickPresetStore(next)
  }

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
    matched?.id,
    mode,
    presetId,
    speedBuilder,
    userBeatId,
    drumInput,
  ])

  useEffect(() => {
    if (mode !== 'drums' && editorOpen) setEditorOpen(false)
  }, [editorOpen, mode])

  useEffect(() => {
    setPhoneDrumsSurface(mode === 'drums')
    return () => setPhoneDrumsSurface(false)
  }, [mode])

  useEffect(() => {
    if (mode !== 'drums' || !compact) return
    if (drumsFold === 'laptop') {
      setEditorOpen(false)
      return
    }
    if (!portrait) setEditorOpen(true)
  }, [drumsFold, mode, compact, portrait])

  const goMode = useCallback(
    (next: RhythmMode) => {
      if (next === mode) return
      navigate({ pathname: toolPath(next), search: location.search }, { replace: true })
    },
    [location.search, mode, navigate],
  )

  const modeRef = useRef(mode)
  useEffect(() => {
    if (modeRef.current === mode) return
    modeRef.current = mode
    setAccentEdit(false)
    setPickerBeat(null)
  }, [mode])

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
    if (current.beats === beats && current.beatUnit === beatUnit) return
    if (mode === 'drums') rememberDrums()
    patchBar(barIndex, updateBarMeter(current, beats, beatUnit, current.subdivision))
    if (mode === 'drums') markDrumEdit()
  }

  const setSubdivision = (subdivision: SubdivisionId) => {
    if (mode === 'drums') rememberDrums()
    setBars((currentBars) => currentBars.map((bar) => setBarSubdivision(bar, subdivision)))
    if (mode === 'drums') markDrumEdit()
    setPickerBeat(null)
  }

  const changeDrumInput = (next: InputDivision) => {
    if (next === drumInput) return
    rememberDrums()
    setDrumInput(next)
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
    resetDrumHistory()
  }

  const addBar = () => {
    if (bars.length >= MAX_BARS || !current) return
    if (mode === 'drums') rememberDrums()
    const next = cloneBar(current)
    next.beatAccents = defaultBeatAccents(next.beats, next.beatUnit)
    setBars((currentBars) => [...currentBars, next])
    setBarIndex(bars.length)
  }

  const removeBar = (index: number) => {
    if (bars.length <= 1) return
    if (mode === 'drums') rememberDrums()
    const next = bars.filter((_, item) => item !== index)
    setBars(next)
    setBarIndex(Math.min(index, next.length - 1))
  }

  const applyDrumBars = (next: RhythmBar[], index: number) => {
    rememberDrums()
    setDrumBars(next.map(cloneBar))
    setDrumBarIndex(Math.min(Math.max(0, index), next.length - 1))
    markDrumEdit()
  }

  const runAutoComplete = () => {
    if (seedBars(drumBars).length === 0) return
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
    const nextVariant = nextFillVariant(fillVariant)
    setFillVariant(nextVariant)
    applyDrumBars(replaceFillBar(drumBars, nextVariant), MAX_BARS - 1)
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

  const onToggleCell = useCallback(
    (targetBar: number, voice: VoiceId, beat: number, slot: number, on: boolean, playPreview: boolean) => {
      const target = hitForInputSlot(beat, slot, drumInput)
      const barsNow = drumSessionRef.current.bars
      const bar = barsNow[targetBar]
      if (!bar || beat < 0 || beat >= bar.beats) return
      const nextPattern = setHitPos(bar.pattern, voice, target, on)
      if (nextPattern === bar.pattern) return
      rememberDrums()
      if (playPreview) preview(voice, 'normal')
      setDrumBars(
        barsNow.map((item, index) => (index === targetBar ? { ...item, pattern: nextPattern } : item)),
      )
      if (!draftNew && !userBeatId) setPresetId(matched?.id ?? presetId)
    },
    [draftNew, drumInput, matched?.id, presetId, preview, userBeatId],
  )

  const onMoveHit = useCallback(
    (
      targetBar: number,
      fromVoice: VoiceId,
      fromBeat: number,
      fromSlot: number,
      toVoice: VoiceId,
      toBeat: number,
      toSlot: number,
      toBarIndex = targetBar,
    ) => {
      const from = hitForInputSlot(fromBeat, fromSlot, drumInput)
      const to = hitForInputSlot(toBeat, toSlot, drumInput)
      const barsNow = drumSessionRef.current.bars
      const destBar = barsNow[toBarIndex] ?? barsNow[targetBar]
      if (!destBar || toBeat < 0 || toBeat >= destBar.beats) return
      let destSoft = false
      let nextBars: RhythmBar[] | null = null
      if (toBarIndex === targetBar) {
        const bar = barsNow[targetBar]
        if (!bar) return
        const nextPattern = moveHitPos(bar.pattern, fromVoice, from, toVoice, to)
        if (nextPattern === bar.pattern) return
        destSoft = (nextPattern[toVoice] ?? []).some((hit) => sameHit(hit, to) && isHitSoft(hit))
        nextBars = barsNow.map((item, index) =>
          index === targetBar ? { ...item, pattern: nextPattern } : item,
        )
      } else {
        const next = moveHitAcrossBars(barsNow, targetBar, fromVoice, from, toBarIndex, toVoice, to)
        if (next === barsNow) return
        destSoft = (next[toBarIndex]?.pattern[toVoice] ?? []).some((hit) => sameHit(hit, to) && isHitSoft(hit))
        nextBars = next
      }
      rememberDrums()
      setDrumBars(nextBars)
      preview(toVoice, destSoft ? 'ghost' : 'normal')
      if (!draftNew && !userBeatId) setPresetId(matched?.id ?? presetId)
    },
    [draftNew, drumInput, matched?.id, presetId, preview, userBeatId],
  )

  const onToggleSoft = useCallback(
    (targetBar: number, voice: VoiceId, beat: number, slot: number) => {
      const target = hitForInputSlot(beat, slot, drumInput)
      const barsNow = drumSessionRef.current.bars
      const bar = barsNow[targetBar]
      if (!bar || beat < 0 || beat >= bar.beats) return
      const nextPattern = placeOrToggleSoft(bar.pattern, voice, target)
      if (nextPattern === bar.pattern) return
      const placed = (nextPattern[voice] ?? []).find((hit) => sameHit(hit, target))
      rememberDrums()
      setDrumBars(
        barsNow.map((item, index) => (index === targetBar ? { ...item, pattern: nextPattern } : item)),
      )
      preview(voice, placed && isHitSoft(placed) ? 'ghost' : 'normal')
      if (!draftNew && !userBeatId) setPresetId(matched?.id ?? presetId)
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

  const playingRef = useRef(playing)
  playingRef.current = playing
  const nowPlayingSubtitle = formatNowPlayingSubtitle({
    mode,
    bpm: liveBpm || bpm,
    meter: current ? meterLabel(current.beats, current.beatUnit) : '4/4',
    beatName,
  })
  const claimNowPlaying = useCallback(() => {
    publishNowPlaying({ title: 'Omnician', subtitle: nowPlayingSubtitle, playing: true })
  }, [nowPlayingSubtitle])
  const startStop = useCallback(() => {
    if (playingRef.current) {
      halt('user-stop')
      setPlaying(false)
      return
    }
    claimNowPlaying()
    preparePlaybackFromGesture()
    void ensureKit().then((kit) => {
      if (speedBuilder.enabled && speedBuilder.announce) {
        kit?.preloadAnnounce()
        void kit?.ensureAnnounce(speedBuilder.fromPct)
      }
    })
    setPlaying(true)
  }, [claimNowPlaying, ensureKit, halt, speedBuilder.announce, speedBuilder.enabled, speedBuilder.fromPct])
  const startStopRef = useRef(startStop)
  startStopRef.current = startStop

  useEffect(() => {
    return bindNowPlayingTransport({
      playing: () => playingRef.current,
      toggle: () => startStopRef.current(),
    })
  }, [])

  useEffect(() => {
    if (!playing) {
      clearNowPlaying()
      return
    }
    publishNowPlaying({
      title: 'Omnician',
      subtitle: formatNowPlayingSubtitle({
        mode,
        bpm: liveBpm || bpm,
        meter: current ? meterLabel(current.beats, current.beatUnit) : '4/4',
        beatName,
      }),
      playing: true,
    })
  }, [beatName, bpm, current, liveBpm, mode, playing])

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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (mode !== 'drums') return
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }
      event.preventDefault()
      if (event.shiftKey) redoDrums()
      else undoDrums()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

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
    if (mode !== 'drums') goMode('drums')
    if (playing) {
      halt('recorder-open')
      setPlaying(false)
    }
    setRecording(false)
    setRecorderOpen(true)
  }, [goMode, halt, mode, playing])

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
    claimNowPlaying()
    preparePlaybackFromGesture()
    void ensureKit()
    setDrumBarIndex(0)
    setRecording(true)
    setPlaying(true)
  }, [claimNowPlaying, ensureKit, halt, recording])

  const patchRecordBar = useCallback(
    (index: number, next: RhythmBar) => {
      rememberDrums()
      setDrumBars((currentBars) =>
        currentBars.map((item, itemIndex) => (itemIndex === index ? next : item)),
      )
      if (!draftNew && !userBeatId) setPresetId(matched?.id ?? presetId)
    },
    [draftNew, matched?.id, presetId, userBeatId],
  )

  const replaceRecordBars = useCallback(
    (next: RhythmBar[]) => {
      rememberDrums()
      setDrumBars(next.map(cloneBar))
      if (!draftNew && !userBeatId) setPresetId(matched?.id ?? presetId)
    },
    [draftNew, matched?.id, presetId, userBeatId],
  )

  const persistBeats = (next: UserBeat[]) => {
    setUserBeats(next)
    saveUserBeats(next)
  }

  const saveCurrentClickPreset = () => {
    const preset = createClickPreset(nextClickPresetName(clickPresetStore.presets), clickSnap)
    persistClickPresets(upsertClickPreset(clickPresetStore, preset))
  }

  const loadClickPresetById = (id: string) => {
    const preset = findClickPreset(clickPresetStore, id)
    if (!preset) return
    setBpm(preset.bpm)
    setClickSound(preset.clickSound)
    setClickBars(preset.bars.map(cloneBar))
    setClickBarIndex(0)
    setSpeedBuilder({ ...preset.speedBuilder })
    persistClickPresets({ ...clickPresetStore, loadedId: id })
  }

  const renameClickPresetById = (id: string, name: string) => {
    persistClickPresets(renameClickPreset(clickPresetStore, id, name))
  }

  const deleteClickPresetById = (id: string) => {
    persistClickPresets(deleteClickPreset(clickPresetStore, id))
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
    resetDrumHistory()
  }, [halt, playing])

  const startNewBeatAndRecord = useCallback(() => {
    startNewBeat({ keepBpm: true })
    claimNowPlaying()
    preparePlaybackFromGesture()
    void ensureKit()
    setDrumBarIndex(0)
    setRecording(true)
    setPlaying(true)
  }, [claimNowPlaying, ensureKit, startNewBeat])

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
        resetDrumHistory()
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
    resetDrumHistory()
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
    if (query.get('editor') === '1' || query.get('editorLibrary') === '1' || query.get('editorTempo') === '1') {
      goMode('drums')
      setEditorOpen(true)
    }
    if (query.get('clickPresets') === '1') {
      goMode('click')
      setClickPresetsOpen(true)
    }
    if (query.get('editorLibrary') === '1') setPickerOpen(true)
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
      goMode('drums')
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
        goMode('drums')
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
          goMode('drums')
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
      fluid
      compact
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <SpeedBuilderPopup cue={tempoCue} />
        <ClickPresetsSheet
          open={clickPresetsOpen}
          snap={clickSnap}
          presets={clickPresetStore.presets}
          loadedId={clickPresetStore.loadedId}
          onClose={() => setClickPresetsOpen(false)}
          onSaveCurrent={saveCurrentClickPreset}
          onLoad={loadClickPresetById}
          onRename={renameClickPresetById}
          onDelete={deleteClickPresetById}
        />
        <div
          data-rhythm-scroll
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-contain [scrollbar-width:thin] [touch-action:pan-y]"
        >
          {importNote && mode === 'drums' ? (
            <p className="mt-1.5 text-center text-xs leading-5 text-slate-400" data-midi-import-note>
              {importNote}
            </p>
          ) : null}

          {mode === 'click' ? (
          <div data-rhythm-mode="click" className="mt-1.5 flex flex-col gap-1.5">
          <ClickPresetChip
            name={loadedClickPreset?.name ?? 'Click presets'}
            onOpen={() => setClickPresetsOpen(true)}
          />
          <div
            data-rhythm-layout
            data-rhythm-mode="click"
            className="flex flex-col gap-1.5 wide:flex-row wide:items-start wide:gap-3 xl:gap-4"
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
                onSpeedBuilder={setSpeedBuilder}
                onBpm={changeBpm}
                onTap={tapTempo}
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
              className="flex h-fit min-w-0 w-full flex-1 flex-col gap-1.5"
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
          </div>
          ) : (
          <div
            data-rhythm-layout
            data-rhythm-mode="drums"
            className="mt-1.5 flex min-h-0 flex-col gap-1.5 wide:flex-row wide:items-stretch wide:gap-3 xl:gap-4 compact:!flex-col"
          >
            <div
              className="flex h-fit w-full shrink-0 flex-col gap-1.5 wide:w-[min(32.5rem,48%)] wide:max-w-[32.5rem] xl:w-[34rem] xl:max-w-[34rem] compact:!w-full compact:!max-w-none"
              data-rhythm-stack="controls"
            >
              <RhythmTempoCard
                bpm={bpm}
                liveBpm={liveBpm}
                playing={playing}
                mode={mode}
                speedBuilder={speedBuilder}
                onSpeedBuilder={setSpeedBuilder}
                onBpm={changeBpm}
                onTap={tapTempo}
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
                className="hidden shrink-0 wide:flex wide:flex-col compact:!hidden"
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
            <section className="flex h-fit min-h-0 min-w-0 w-full flex-1 flex-col" data-rhythm-stack="stage">
              {factory.visible ? (
                <FactoryEditorBar
                  library={factory.library}
                  selectedId={presetId}
                  name={factory.name}
                  styleId={factory.styleId}
                  dirty={factory.dirty}
                  canSaveDefault={factory.canSaveDefault}
                  canUndo={factory.canUndo}
                  saving={factory.saving}
                  error={factory.error}
                  notice={factory.notice}
                  displayName={beatName}
                  onStyle={factory.onStyle}
                  onNew={factory.onNew}
                  onDelete={() => void factory.onDelete()}
                  onSaveDefault={() => void factory.onSaveDefault()}
                  onUndo={() => void factory.onUndo()}
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
              <div className="mb-1.5 rounded-xl border border-white/10 bg-[#141A28]/80 px-2 py-1 compact:hidden">
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
                    AUTO_COMPLETE_ENABLED ? (
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
                      </>
                    ) : undefined
                  }
                />
              </div>
              <div className="mb-1.5 flex items-center gap-1 compact:hidden" data-drum-history>
                <button
                  type="button"
                  data-drum-undo
                  aria-label="Undo"
                  disabled={historyUi.undo <= 0}
                  onClick={undoDrums}
                  className="flex h-8 items-center gap-1 rounded-full border border-white/12 px-2.5 text-[0.72rem] font-semibold text-slate-100 disabled:opacity-30"
                >
                  <Undo2 className="size-3.5" />
                  Undo
                </button>
                <button
                  type="button"
                  data-drum-redo
                  aria-label="Redo"
                  disabled={historyUi.redo <= 0}
                  onClick={redoDrums}
                  className="flex h-8 items-center gap-1 rounded-full border border-white/12 px-2.5 text-[0.72rem] font-semibold text-slate-100 disabled:opacity-30"
                >
                  <Redo2 className="size-3.5" />
                  Redo
                </button>
              </div>
              <div className="compact:hidden">
                <DrumBarStage
                  bars={drumBars}
                  barIndex={drumBarIndex}
                  playing={playing}
                  getClock={getTransportClock}
                  input={drumInput}
                  onInput={changeDrumInput}
                  onToggle={onToggleCell}
                  onToggleSoft={onToggleSoft}
                  onMoveHit={onMoveHit}
                  onPreviewVoice={preview}
                />
                <KitFaders
                  mix={kitMix}
                  intensity={kitIntensity}
                  onChange={setGroupMix}
                  onIntensityChange={setKitIntensity}
                />
              </div>
              <div
                className={cn(
                  'hidden items-center justify-center compact:flex',
                  drumsFold === 'laptop' && '!hidden',
                )}
                data-phone-drums
              >
                <p
                  data-turn-to-edit
                  className="flex items-center gap-1.5 py-1 text-[0.75rem] font-medium leading-none text-slate-400"
                >
                  <TurnDeviceIcon />
                  Turn device to edit beat
                </p>
              </div>
            </section>
          </div>
          )}
        </div>

        <PlayheadBarSync getClock={getTransportClock} playing={playing} onBar={setBarIndex} />
        <TransportDock
          place="sticky"
          className={cn(
            'rhythm-glass z-40 shrink-0 border-t border-white/10 wide:hidden compact:!block',
            coverRail
              ? 'pt-1 pb-[max(0.28rem,env(safe-area-inset-bottom,0px))]'
              : 'pt-2 pb-[max(0.7rem,env(safe-area-inset-bottom,0px))]',
          )}
          playing={playing}
          onToggle={() => void startStop()}
          holdUntilCycle={holdUntilCycle}
          extra={recordControl}
          slim={coverRail}
          hideReadout={coverRail}
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

      {drumsFold === 'laptop' && mode === 'drums' && current ? (
        <DrumsLaptop
          beatName={beatName}
          bpm={bpm}
          liveBpm={speedBuilder.enabled && playing ? liveBpm : bpm}
          playing={playing}
          bars={drumBars}
          barIndex={drumBarIndex}
          input={drumInput}
          playheadStore={playheadStore}
          getClock={getTransportClock}
          kitMix={kitMix}
          kitIntensity={kitIntensity}
          canAdd={drumBars.length < MAX_BARS}
          onTogglePlay={() => void startStop()}
          onInput={changeDrumInput}
          onMeter={setMeter}
          onSelectBar={chooseDrumBar}
          onAddBar={addBar}
          onRemoveBar={() => removeBar(drumBarIndex)}
          onToggle={onToggleCell}
          onToggleSoft={onToggleSoft}
          onMoveHit={onMoveHit}
          onPreview={preview}
          onMix={setGroupMix}
          onIntensity={setKitIntensity}
          onOpenLibrary={() => setPickerOpen(true)}
          onBpm={changeBpm}
          onTapTempo={tapTempo}
          canUndo={historyUi.undo > 0}
          canRedo={historyUi.redo > 0}
          onUndo={undoDrums}
          onRedo={redoDrums}
        />
      ) : null}

      {clickFold === 'laptop' && mode === 'click' && current ? (
        <ClickLaptop
          bpm={bpm}
          liveBpm={speedBuilder.enabled && playing ? liveBpm : bpm}
          playing={playing}
          bar={current}
          barIndex={barIndex}
          clickSound={clickSound}
          presetName={loadedClickPreset?.name ?? 'Click presets'}
          playheadStore={playheadStore}
          getClock={getTransportClock}
          onTogglePlay={() => void startStop()}
          onMeter={setMeter}
          onBpm={changeBpm}
          onTap={tapTempo}
          onSound={setClickSound}
          onSubdivision={setSubdivision}
          onCycleAccent={(beat) => {
            const next = cycleBeatAccent(current.beatAccents, beat, current.beats)
            previewClick(clickSound, beatAccentAt(next, beat), true)
            patchBar(barIndex, { ...current, beatAccents: next })
          }}
          onOpenPresets={() => setClickPresetsOpen(true)}
        />
      ) : null}

      {clickFold === 'tent' && mode === 'click' && !portrait && current ? (
        <ClickTent
          bpm={bpm}
          liveBpm={speedBuilder.enabled && playing ? liveBpm : bpm}
          playing={playing}
          bar={current}
          playheadStore={playheadStore}
          getClock={getTransportClock}
          onTogglePlay={() => void startStop()}
          onBpm={changeBpm}
        />
      ) : null}

      {editorOpen && mode === 'drums' && drumsFold !== 'laptop' ? (
        <DrumEditorOverlay
          beatName={beatName}
          bpm={bpm}
          liveBpm={speedBuilder.enabled && playing ? liveBpm : bpm}
          playing={playing}
          bars={drumBars}
          barIndex={drumBarIndex}
          input={drumInput}
          playheadStore={playheadStore}
          getClock={getTransportClock}
          kitMix={kitMix}
          kitIntensity={kitIntensity}
          canAdd={drumBars.length < MAX_BARS}
          barMenu={{
            canPaste: clipBar != null,
            canDuplicate: drumBars.length < MAX_BARS,
            canDelete: drumBars.length > 1,
            canAutoComplete: seedBars(drumBars).length > 0,
            canRetryFill: drumBars.length >= MAX_BARS && seedBars(drumBars).length > 0,
            onAction: onDrumBarMenu,
          }}
          onClose={() => setEditorOpen(false)}
          onTogglePlay={() => void startStop()}
          onInput={changeDrumInput}
          onMeter={setMeter}
          onSelectBar={chooseDrumBar}
          onAddBar={addBar}
          onRemoveBar={() => removeBar(drumBarIndex)}
          onToggle={onToggleCell}
          onToggleSoft={onToggleSoft}
          onMoveHit={onMoveHit}
          onPreview={preview}
          onMix={setGroupMix}
          onIntensity={setKitIntensity}
          onOpenLibrary={() => setPickerOpen(true)}
          onCloseLibrary={() => setPickerOpen(false)}
          onBpm={changeBpm}
          onTapTempo={tapTempo}
          canUndo={historyUi.undo > 0}
          canRedo={historyUi.redo > 0}
          onUndo={undoDrums}
          onRedo={redoDrums}
        />
      ) : null}

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
          factoryReorder={factory.visible}
          factorySaving={factory.saving}
          factoryNotice={factory.notice}
          factoryError={factory.error}
          compact={editorOpen}
          onReorder={factory.visible ? factory.onReorder : undefined}
          onClose={() => setPickerOpen(false)}
          onSelect={loadPreset}
          onLoadUser={loadUser}
          onRename={renameSaved}
          onDelete={deleteSaved}
        />
      ) : null}

      {saveOpen ? (
        <OverlayHost className="z-[60] items-end bg-black/70 sm:items-center" data-save-overlay>
          <form
            role="dialog"
            aria-labelledby="save-beat-title"
            data-save-dialog
            className="relative z-10 w-full max-w-sm overflow-y-auto rounded-3xl border border-white/10 bg-[#0F1422] p-5"
            onSubmit={(event) => {
              event.preventDefault()
              commitSave()
            }}
          >
            <SheetHeader
              titleId="save-beat-title"
              title={saveAsNew || !savedUser ? 'Save beat' : 'Save changes'}
              description={
                <p className="mt-1 text-sm text-slate-400">
                  Saved on this phone or computer only — no account needed.
                </p>
              }
              onClose={() => setSaveOpen(false)}
              closeLabel="Close save dialog"
            />
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
        </OverlayHost>
      ) : null}

      {AUTO_COMPLETE_ENABLED && autoConfirm ? (
        <OverlayHost className="z-[60] items-end bg-black/70 sm:items-center" data-auto-confirm-overlay>
          <div
            role="dialog"
            aria-labelledby="auto-complete-title"
            data-auto-confirm
            className="relative z-10 w-full max-w-sm overflow-y-auto rounded-3xl border border-white/10 bg-[#0F1422] p-5"
          >
            <SheetHeader
              titleId="auto-complete-title"
              title="Replace bars 2–8?"
              description={
                <p className="mt-1 text-sm text-slate-400">
                  Those bars already have notes. Auto-complete will overwrite them with a new 8-bar phrase
                  from this groove.
                </p>
              }
              onClose={() => setAutoConfirm(false)}
              closeLabel="Close auto-complete"
            />
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
        </OverlayHost>
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

function TurnDeviceIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-[#C084FC]" aria-hidden>
      <rect x="5" y="1.5" width="6" height="10" rx="1.3" fill="none" stroke="currentColor" strokeWidth="1.35" />
      <path d="M3.2 12.2c.6 1.4 2.2 2.2 4 2.1" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8.4 13.3l-1.3 1.5.2-1.9" fill="currentColor" />
    </svg>
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
  slim = false,
  hideReadout = false,
}: {
  playing: boolean
  onToggle: () => void
  className?: string
  holdUntilCycle: boolean
  place: 'inline' | 'sticky'
  extra?: ReactNode
  children: ReactNode
  slim?: boolean
  hideReadout?: boolean
}) {
  return (
    <div
      data-section="transport"
      data-transport-place={place}
      data-transport-slim={slim ? '1' : undefined}
      data-hold-until-cycle={holdUntilCycle ? 'true' : 'false'}
      className={className}
    >
      {hideReadout ? null : <div className="mb-1.5 text-[0.7rem] text-slate-200">{children}</div>}
      <div className={cn('flex items-center gap-2', extra && 'pr-0.5')}>
        <Button
          type="button"
          size="lg"
          variant={playing ? 'outline' : 'default'}
          className={cn(
            'min-w-0 flex-1 touch-manipulation',
            slim ? 'h-10 text-sm' : 'h-14 text-base',
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
  getClock,
  playing,
  onBar,
}: {
  getClock: () => TransportClock
  playing: boolean
  onBar: (bar: number) => void
}) {
  const onBarRef = useRef(onBar)
  onBarRef.current = onBar
  const wasPlaying = useRef(false)
  useEffect(() => {
    if (!playing) {
      if (wasPlaying.current) {
        const clock = getClock()
        if (!clock.precount && clock.barIndex >= 0) onBarRef.current(clock.barIndex)
      }
      wasPlaying.current = false
      return
    }
    wasPlaying.current = true
    let raf = 0
    let last = -1
    const tick = () => {
      const clock = getClock()
      if (clock.playing && !clock.precount && clock.barIndex !== last) {
        last = clock.barIndex
        onBarRef.current(clock.barIndex)
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [getClock, playing])
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
  const live = playing && !playhead.precount && playhead.bar === barIndex
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
          {playing && playhead.precount && playhead.beat >= 0
            ? playhead.beat + 1
            : !live || playhead.beat < 0
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
  factoryReorder = false,
  factorySaving = false,
  factoryNotice = null,
  factoryError = null,
  compact = false,
  onReorder,
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
  factoryReorder?: boolean
  factorySaving?: boolean
  factoryNotice?: string | null
  factoryError?: string | null
  compact?: boolean
  onReorder?: (styleId: RhythmStyleId, beatId: string, toIndex: number) => void
  onClose: () => void
  onSelect: (id: string) => void
  onLoadUser: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  const selected = selectedId ? findPreset(selectedId) : undefined
  const styles = useSyncExternalStore(subscribeRhythmStyles, getRhythmStyles, getRhythmStyles)
  const local = styles.filter((style) =>
    style.grooves.some((item) => item.beats === current.beats && item.beatUnit === current.beatUnit),
  )
  const others = styles.filter(
    (style) => !style.grooves.some((item) => item.beats === current.beats && item.beatUnit === current.beatUnit),
  )

  const outer = useDuoOuterDisplay()
  const viewport = useViewportSize()
  const columns = overlayListColumns({ width: viewport.width, outer })
  const listLayout = columns === 1

  if (typeof document === 'undefined') return null

  return createPortal(
    <OverlayHost
      data-beat-library-sheet
      data-library-layout={listLayout ? 'list' : compact ? 'landscape' : 'sheet'}
      data-library-columns={String(columns)}
      className={cn(
        'z-[90] bg-black/70',
        compact ? 'items-center' : 'items-end sm:items-center',
      )}
    >
      <SheetBackdrop label="Close beat library" onClose={onClose} />
      <div
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="rhythm-presets-title"
        data-factory-reorder={factoryReorder ? '1' : '0'}
        className={cn(
          'relative z-10 flex w-full min-h-0 max-h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0F1422]',
          compact
            ? 'max-w-[min(56rem,100%)] rounded-2xl p-3'
            : 'max-w-lg p-5 md:max-w-2xl lg:max-w-4xl',
        )}
      >
        <SheetHeader
          titleId="rhythm-presets-title"
          title="Beat library"
          titleClassName={compact ? 'text-lg' : 'text-xl'}
          onClose={onClose}
          closeLabel="Close beat library"
          description={
            factoryReorder ? (
              <p className="mt-1 text-sm leading-5 text-pretty text-slate-400">
                Drag a groove within its style to change the menu order. That order is saved as default for everyone.
              </p>
            ) : null
          }
        />
        {factorySaving ? (
          <p data-factory-picker-notice className="mt-2 shrink-0 text-sm font-semibold text-[#E9D5FF]">
            Saving order…
          </p>
        ) : factoryNotice ? (
          <p data-factory-picker-notice className="mt-2 shrink-0 text-sm font-semibold text-emerald-300">
            {factoryNotice}
          </p>
        ) : factoryError ? (
          <p data-factory-picker-notice className="mt-2 shrink-0 text-sm text-red-300">
            {factoryError}
          </p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <MyBeatsSection
            beats={userBeats}
            selectedId={selectedUserId}
            compact={compact}
            onLoad={onLoadUser}
            onRename={onRename}
            onDelete={onDelete}
          />
          <PresetGroup
            title={`For ${meterLabel(current.beats, current.beatUnit)}`}
            styles={local}
            selected={selected}
            factoryReorder={factoryReorder}
            compact={compact}
            listLayout={listLayout}
            onReorder={onReorder}
            onSelect={onSelect}
          />
          {others.length > 0 ? (
            <PresetGroup
              title="Other meters"
              styles={others}
              selected={selected}
              factoryReorder={factoryReorder}
              compact={compact}
              listLayout={listLayout}
              onReorder={onReorder}
              onSelect={onSelect}
            />
          ) : null}
        </div>
      </div>
    </OverlayHost>,
    document.body,
  )
}

function MyBeatsSection({
  beats,
  selectedId,
  compact = false,
  onLoad,
  onRename,
  onDelete,
}: {
  beats: UserBeat[]
  selectedId: string | null
  compact?: boolean
  onLoad: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <section className={compact ? 'mt-2' : 'mt-4'} data-my-beats>
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
  factoryReorder = false,
  compact = false,
  listLayout = true,
  onReorder,
  onSelect,
}: {
  title: string
  styles: RhythmStyle[]
  selected: RhythmPreset | undefined
  factoryReorder?: boolean
  compact?: boolean
  listLayout?: boolean
  onReorder?: (styleId: RhythmStyleId, beatId: string, toIndex: number) => void
  onSelect: (id: string) => void
}) {
  if (styles.length === 0) return null
  return (
    <section className={compact ? 'mt-2' : 'mt-4'}>
      <h3 className="px-1 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h3>
      <div className={cn('grid gap-2', listLayout ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2')}>
        {styles.map((style) => (
          <StyleMenu
            key={style.id}
            style={style}
            selected={selected}
            defaultOpen={selected?.styleId === style.id}
            factoryReorder={factoryReorder}
            compact={compact}
            listLayout={listLayout}
            onReorder={onReorder}
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
  factoryReorder = false,
  compact = false,
  listLayout = true,
  onReorder,
  onSelect,
}: {
  style: RhythmStyle
  selected: RhythmPreset | undefined
  defaultOpen: boolean
  factoryReorder?: boolean
  compact?: boolean
  listLayout?: boolean
  onReorder?: (styleId: RhythmStyleId, beatId: string, toIndex: number) => void
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const active = selected?.styleId === style.id

  const grooveIndexAt = (clientY: number) => {
    const rows = listRef.current?.querySelectorAll('[data-factory-groove]')
    if (!rows || rows.length === 0) return null
    let index = rows.length - 1
    for (let i = 0; i < rows.length; i += 1) {
      const rect = rows[i]!.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        index = i
        break
      }
    }
    return index
  }

  const onGripPointerDown = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (!factoryReorder || !onReorder) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { id, moved: false }
    setDraggingId(id)
    setDropIndex(style.grooves.findIndex((item) => item.id === id))
  }

  const onGripPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    dragRef.current.moved = true
    const next = grooveIndexAt(event.clientY)
    if (next != null) setDropIndex(next)
  }

  const onGripPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const target = grooveIndexAt(event.clientY) ?? dropIndex
    dragRef.current = null
    setDraggingId(null)
    setDropIndex(null)
    if (!drag || !onReorder || !drag.moved || target == null) return
    onReorder(style.id, drag.id, target)
  }

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
        className={cn(
          'flex w-full items-center justify-between text-left',
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2',
        )}
      >
        <span>
          <span className="block text-sm font-semibold leading-5 text-white">{style.name}</span>
          {!open ? (
            <span className="block text-xs leading-4 text-slate-400">
              {style.grooves.length} {style.grooves.length === 1 ? 'groove' : 'grooves'}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn('size-4 text-slate-400 transition', open && 'rotate-180 text-white')}
        />
      </button>
      {open ? (
        <div ref={listRef} className="space-y-1 border-t border-white/8 px-2 pb-2 pt-1.5">
          {style.grooves.map((item, index) => (
            <div
              key={item.id}
              data-factory-groove={item.id}
              data-drop={dropIndex === index ? '1' : '0'}
              className={cn(
                'flex items-stretch gap-0.5 rounded-xl',
                dropIndex === index && draggingId && draggingId !== item.id ? 'ring-1 ring-[#A855F7]' : '',
                draggingId === item.id ? 'opacity-55' : '',
              )}
            >
              {factoryReorder ? (
                <button
                  type="button"
                  aria-label={`Reorder ${item.name}`}
                  data-factory-grip={item.id}
                  onPointerDown={(event) => onGripPointerDown(event, item.id)}
                  onPointerMove={onGripPointerMove}
                  onPointerUp={onGripPointerUp}
                  onPointerCancel={onGripPointerUp}
                  className="flex w-8 shrink-0 touch-none items-center justify-center rounded-xl text-slate-500 hover:text-white"
                >
                  <GripVertical className="size-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                data-preset={item.id}
                className={cn(
                  'flex min-h-9 min-w-0 flex-1 items-center justify-between rounded-xl px-2.5 py-1.5 text-left',
                  item.id === selected?.id
                    ? 'bg-[#A855F7] text-white'
                    : 'bg-white/4 text-slate-200 hover:bg-white/8',
                )}
              >
                <span
                  className={cn(
                    'min-w-0 text-sm font-semibold leading-5',
                    listLayout ? 'whitespace-normal break-words' : 'truncate',
                  )}
                >
                  {item.name}
                </span>
                <span className={cn('ml-2 shrink-0 text-xs font-semibold', item.id === selected?.id ? 'text-white/80' : 'text-slate-500')}>
                  {meterLabel(item.beats, item.beatUnit)}
                </span>
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
