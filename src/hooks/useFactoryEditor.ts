import { useCallback, useEffect, useState } from 'react'

import {
  cloneFactoryLibrary,
  deleteFactoryBeat,
  emptyFactoryBeat,
  findFactoryBeat,
  moveFactoryBeat,
  newFactoryBeatId,
  parseFactoryBar,
  replaceFactoryBeat,
  serializeBar,
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
  const [saving, setSaving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState<Array<{ id: string; savedAt: string; beatCount: number }>>([])

  const selected = presetId ? findFactoryBeat(library, presetId) : null
  const dirty = Boolean(savedJson) && JSON.stringify(library) !== savedJson
  const visible = admin && mode === 'drums'

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
      if (!found) return
      const bars = preset ? barsForPreset(preset) : found.beat.bars.map(parseFactoryBar).filter((bar): bar is RhythmBar => bar !== null)
      if (!bars.length) return
      setDrumBars(bars.map(cloneBar))
      setDrumBarIndex(0)
      setBpm(found.beat.bpm)
      setPresetId(id)
      setUserBeatId(null)
      setDraftNew(false)
    },
    [library, setBpm, setDraftNew, setDrumBarIndex, setDrumBars, setPresetId, setUserBeatId],
  )

  useEffect(() => {
    if (!visible || !presetId || !selected) return
    const nextBeat = {
      ...selected.beat,
      bpm,
      bars: drumBars.map(serializeBar),
    }
    if (JSON.stringify(selected.beat) === JSON.stringify(nextBeat)) return
    setLibrary((current) => replaceFactoryBeat(current, nextBeat))
  }, [bpm, drumBars, presetId, selected, visible])

  const onName = (name: string) => {
    if (!selected) return
    setLibrary(replaceFactoryBeat(library, { ...selected.beat, name }))
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

  const onDelete = () => {
    if (!presetId) return
    const next = deleteFactoryBeat(library, presetId)
    setLibrary(next)
    const fallback = next.styles.flatMap((style) => style.beats)[0]
    if (fallback) loadBeat(fallback.id, next)
    else {
      setPresetId(null)
    }
  }

  const onSave = async () => {
    setSaving(true)
    setError(null)
    const result = await saveFactoryLibrary({ ...library, updatedAt: new Date().toISOString() })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setLibrary(cloneFactoryLibrary(result.library))
    setSavedJson(JSON.stringify(result.library))
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
    if (presetId && findFactoryBeat(result.library, presetId)) loadBeat(presetId, result.library)
  }

  return {
    visible,
    library,
    name: selected?.beat.name ?? '',
    styleId: (selected?.style.id ?? 'rock') as RhythmStyleId,
    dirty,
    saving,
    error,
    historyOpen,
    versions,
    setHistoryOpen,
    setAdmin,
    onName,
    onStyle,
    onMove,
    onNew,
    onDelete,
    onSave,
    openHistory,
    onRestore,
  }
}
