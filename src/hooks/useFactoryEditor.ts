import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  cloneFactoryLibrary,
  deleteFactoryBeat,
  emptyFactoryBeat,
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
import { barsForPreset, findPreset, type RhythmStyleId } from '@/lib/rhythm-presets'
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
      return true
    },
    [loadBeat, setDraftNew, setPresetId, setUserBeatId],
  )

  const onName = (nextName: string) => {
    if (!selected) return
    setLibrary(replaceFactoryBeat(library, { ...selected.beat, name: nextName.trim().slice(0, 40) || selected.beat.name }))
  }

  const onStyle = (styleId: RhythmStyleId) => {
    if (!presetId || !selected) return
    const index = selected.style.id === styleId ? selected.index : 999
    setLibrary(moveFactoryBeat(library, presetId, styleId, index))
  }

  const onMove = (delta: number) => {
    if (!selected) return
    setLibrary(moveFactoryBeat(library, selected.beat.id, selected.style.id, selected.index + delta))
  }

  const onNew = () => {
    const styleId = selected?.style.id ?? 'rock'
    const beat = emptyFactoryBeat(styleId, newFactoryBeatId())
    const next = cloneFactoryLibrary(library)
    next.styles.find((item) => item.id === styleId)?.beats.push(beat)
    setLibrary(next)
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
    if (presetId && findFactoryBeat(result.library, presetId)) loadBeat(presetId, result.library)
  }

  return {
    visible,
    library,
    name,
    styleId: (selected?.style.id ?? 'rock') as RhythmStyleId,
    dirty,
    canSaveDefault,
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
    onMove,
    onNew,
    onDelete,
    onSaveDefault,
    onSaveAsNew,
    onRename,
    openHistory,
    onRestore,
  }
}
