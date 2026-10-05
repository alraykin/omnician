import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  cloneFactoryLibrary,
  deleteFactoryBeat,
  emptyFactoryBeat,
  factoryLibraryToStyles,
  findFactoryBeat,
  liveFactoryPatternKey,
  moveFactoryBeat,
  newFactoryBeatId,
  parseFactoryBar,
  parseFactoryLibraryJson,
  replaceFactoryBeat,
  savedFactoryPatternKey,
  beatFromPattern,
  upsertFactoryBeat,
  type FactoryLibrary,
} from '@/lib/factory-library'
import {
  bundledFactoryLibrary,
  fetchFactoryHistory,
  fetchFactorySession,
  hydrateFactoryLibrary,
  restoreFactoryVersion,
  saveFactoryLibrary,
} from '@/lib/factory-store'
import { barsForPreset, findPreset, setLiveRhythmStyles, type RhythmStyleId } from '@/lib/rhythm-presets'
import { cloneBar, type RhythmBar } from '@/lib/rhythm'

export function useFactoryEditor({
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
}: {
  mode: 'click' | 'drums'
  presetId: string | null
  bpm: number
  drumBars: RhythmBar[]
  setBpm: (bpm: number) => void
  setDrumBars: (bars: RhythmBar[]) => void
  setDrumBarIndex: (index: number) => void
  setPresetId: (id: string | null) => void
  setUserBeatId: (id: string | null) => void
  setDraftNew: (value: boolean) => void
}) {
  const [admin, setAdmin] = useState(false)
  const [library, setLibrary] = useState<FactoryLibrary>(() => bundledFactoryLibrary())
  const [savedJson, setSavedJson] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [prompt, setPrompt] = useState<null | 'save-new' | 'rename'>(null)
  const [versions, setVersions] = useState<Array<{ id: string; savedAt: string; beatCount: number }>>([])
  const [canUndo, setCanUndo] = useState(false)

  const selected = presetId ? findFactoryBeat(library, presetId) : null
  const savedLibrary = useMemo(() => (savedJson ? parseFactoryLibraryJson(savedJson) : null), [savedJson])
  const savedBeat =
    savedLibrary?.ok && presetId ? findFactoryBeat(savedLibrary.library, presetId)?.beat ?? null : null
  const patternDirty = Boolean(
    selected &&
      (savedBeat
        ? liveFactoryPatternKey(bpm, drumBars) !== savedFactoryPatternKey(savedBeat)
        : true),
  )
  const libraryDirty = Boolean(savedJson) && JSON.stringify(library) !== savedJson
  const dirty = patternDirty || libraryDirty
  const visible = admin && mode === 'drums'
  const canSaveDefault = Boolean(selected)
  const name = selected?.beat.name ?? ''

  useEffect(() => {
    void (async () => {
      const [session, hydrated] = await Promise.all([fetchFactorySession(), hydrateFactoryLibrary()])
      setAdmin(session)
      setLibrary(cloneFactoryLibrary(hydrated))
      setSavedJson(JSON.stringify(hydrated))
      if (session) {
        const history = await fetchFactoryHistory()
        setCanUndo(history.length > 0)
      }
    })()
  }, [])

  const loadBeat = useCallback(
    (id: string, nextLibrary = library) => {
      const found = findFactoryBeat(nextLibrary, id)
      const preset = findPreset(id)
      if (!found) return false
      const bars = preset
        ? barsForPreset(preset)
        : found.beat.bars.map(parseFactoryBar).filter((bar): bar is RhythmBar => bar !== null)
      if (!bars.length) return false
      setDrumBars(bars.map(cloneBar))
      setDrumBarIndex(0)
      setBpm(found.beat.bpm)
      setPresetId(id)
      setUserBeatId(null)
      setDraftNew(false)
      return true
    },
    [library, setBpm, setDraftNew, setDrumBarIndex, setDrumBars, setPresetId, setUserBeatId],
  )

  const persist = useCallback(
    async (next: FactoryLibrary, stayId: string | null, success: string) => {
      setSaving(true)
      setError(null)
      setNotice(null)
      const result = await saveFactoryLibrary({ ...next, updatedAt: new Date().toISOString() })
      setSaving(false)
      if (!result.ok) {
        setError(result.error)
        return false
      }
      const hydrated = cloneFactoryLibrary(result.library)
      setLibrary(hydrated)
      setSavedJson(JSON.stringify(hydrated))
      if (stayId) {
        if (!loadBeat(stayId, hydrated)) {
          setPresetId(stayId)
          setUserBeatId(null)
          setDraftNew(false)
        }
      }
      setNotice(success)
      setPrompt(null)
      setCanUndo(true)
      return true
    },
    [loadBeat, setDraftNew, setPresetId, setUserBeatId],
  )

  const commitLibrary = useCallback((next: FactoryLibrary, message?: string) => {
    setLibrary(next)
    setLiveRhythmStyles(factoryLibraryToStyles(next))
    if (message) setNotice(message)
  }, [])

  const onName = (nextName: string) => {
    if (!selected) return
    commitLibrary(replaceFactoryBeat(library, { ...selected.beat, name: nextName.trim().slice(0, 40) || selected.beat.name }))
  }

  const onStyle = (styleId: RhythmStyleId) => {
    if (!presetId || !selected) return
    const index = selected.style.id === styleId ? selected.index : 999
    commitLibrary(moveFactoryBeat(library, presetId, styleId, index))
  }

  const onReorder = (styleId: RhythmStyleId, beatId: string, toIndex: number) => {
    const current = findFactoryBeat(library, beatId)
    if (!current || current.style.id !== styleId) return
    if (current.index === toIndex) return
    commitLibrary(
      moveFactoryBeat(library, beatId, styleId, toIndex),
      'Moved — Save as default to publish this order.',
    )
  }

  const onNew = () => {
    const styleId = selected?.style.id ?? 'rock'
    const beat = emptyFactoryBeat(styleId, newFactoryBeatId())
    const next = cloneFactoryLibrary(library)
    next.styles.find((item) => item.id === styleId)?.beats.push(beat)
    commitLibrary(next)
    const bars = beat.bars.map(parseFactoryBar).filter((bar): bar is RhythmBar => bar !== null)
    setDrumBars(bars.map(cloneBar))
    setDrumBarIndex(0)
    setBpm(beat.bpm)
    setPresetId(beat.id)
    setUserBeatId(null)
    setDraftNew(false)
  }

  const onDelete = async () => {
    if (!presetId) return
    const next = deleteFactoryBeat(library, presetId)
    const fallback = next.styles.flatMap((style) => style.beats)[0]
    await persist(next, fallback?.id ?? null, 'Deleted')
    if (!fallback) setPresetId(null)
  }

  const onSaveDefault = async () => {
    if (!selected) {
      setError('Load a factory beat to overwrite, or use Save as new.')
      return
    }
    const nextBeat = beatFromPattern(selected.beat.id, selected.beat.name, bpm, drumBars, selected.beat.blurb)
    const next = replaceFactoryBeat(library, nextBeat)
    await persist(next, nextBeat.id, `Saved ${nextBeat.name}`)
  }

  const onSaveAsNew = async (nextName: string, styleId: RhythmStyleId) => {
    const beat = beatFromPattern(newFactoryBeatId(), nextName, bpm, drumBars)
    const next = upsertFactoryBeat(library, styleId, beat)
    await persist(next, beat.id, `Saved ${beat.name}`)
  }

  const onRename = (nextName: string) => {
    onName(nextName)
    setPrompt(null)
  }

  const openHistory = async () => {
    setVersions(await fetchFactoryHistory())
    setHistoryOpen(true)
  }

  const onRestore = async (id: string) => {
    const result = await restoreFactoryVersion(id)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setLibrary(cloneFactoryLibrary(result.library))
    setSavedJson(JSON.stringify(result.library))
    setHistoryOpen(false)
    setNotice('Restored')
    setCanUndo(true)
    if (presetId && findFactoryBeat(result.library, presetId)) loadBeat(presetId, result.library)
  }

  const onUndo = async () => {
    const history = await fetchFactoryHistory()
    const previous = history[0]
    if (!previous) {
      setError('Nothing to undo yet.')
      setCanUndo(false)
      return
    }
    await onRestore(previous.id)
    setNotice('Undid last save')
  }

  return {
    visible,
    library,
    name,
    styleId: (selected?.style.id ?? 'rock') as RhythmStyleId,
    dirty,
    canSaveDefault,
    canUndo,
    saving,
    error,
    notice,
    prompt,
    historyOpen,
    versions,
    setHistoryOpen,
    setPrompt,
    setAdmin,
    onName,
    onStyle,
    onReorder,
    onNew,
    onDelete,
    onSaveDefault,
    onSaveAsNew,
    onRename,
    openHistory,
    onRestore,
    onUndo,
  }
}
