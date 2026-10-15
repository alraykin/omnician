import {
  CLICK_SOUND_LABELS,
  MAX_BARS,
  accentsEqual,
  clampBeats,
  clampBpm,
  cloneBar,
  isBeatUnit,
  makeBar,
  meterLabel,
  normalizeBeatSubdivisions,
  normalizeClickSound,
  normalizeSubdivision,
  parseBeatAccents,
  parseVoiceHits,
  patternsEqual,
  VOICES,
  type ClickSoundId,
  type RhythmBar,
  type SubdivisionId,
} from '@/lib/rhythm'
import { parseSpeedBuilder, type SpeedBuilder } from '@/lib/speed-builder'

export const CLICK_PRESETS_KEY = 'omnician.click.presets.v1'

export type ClickPreset = {
  id: string
  name: string
  bpm: number
  clickSound: ClickSoundId
  bars: RhythmBar[]
  speedBuilder: SpeedBuilder
  updatedAt: number
}

export type ClickPresetStore = {
  loadedId: string | null
  presets: ClickPreset[]
}

export type ClickPresetSnapshot = {
  bpm: number
  clickSound: ClickSoundId
  bars: readonly RhythmBar[]
  speedBuilder: SpeedBuilder
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cp-${crypto.randomUUID()}`
  }
  return `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function parseBar(raw: unknown): RhythmBar | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as {
    beats?: unknown
    beatUnit?: unknown
    subdivision?: unknown
    beatAccents?: unknown
    beatSubdivisions?: unknown
    pattern?: unknown
  }
  const beats = clampBeats(typeof row.beats === 'number' ? row.beats : 4)
  const beatUnit = isBeatUnit(row.beatUnit) ? row.beatUnit : 4
  const subdivision = normalizeSubdivision(row.subdivision)
  const pattern = makeBar(beats, beatUnit, subdivision).pattern
  if (row.pattern && typeof row.pattern === 'object') {
    const source = row.pattern as Partial<Record<string, unknown>>
    for (const voice of VOICES) {
      pattern[voice] = parseVoiceHits(source[voice], beats, subdivision)
    }
  }
  const beatAccents = parseBeatAccents(row.beatAccents, beats, beatUnit)
  const beatSubdivisions = Array.isArray(row.beatSubdivisions)
    ? normalizeBeatSubdivisions(beats, subdivision, row.beatSubdivisions)
    : undefined
  return makeBar(beats, beatUnit, subdivision, pattern, beatAccents, beatSubdivisions)
}

export function clickBarsEqual(left: readonly RhythmBar[], right: readonly RhythmBar[]): boolean {
  if (left.length !== right.length) return false
  return left.every((bar, index) => {
    const other = right[index]
    return (
      other != null &&
      bar.beats === other.beats &&
      bar.beatUnit === other.beatUnit &&
      bar.subdivision === other.subdivision &&
      bar.beatSubdivisions.length === other.beatSubdivisions.length &&
      bar.beatSubdivisions.every((steps, item) => steps === other.beatSubdivisions[item]) &&
      accentsEqual(bar.beatAccents, other.beatAccents) &&
      patternsEqual(bar.pattern, other.pattern)
    )
  })
}

export function speedBuilderEqual(left: SpeedBuilder, right: SpeedBuilder): boolean {
  return (
    left.enabled === right.enabled &&
    left.fromPct === right.fromPct &&
    left.toPct === right.toPct &&
    left.stepPct === right.stepPct &&
    left.repeats === right.repeats &&
    left.precount === right.precount &&
    left.announce === right.announce
  )
}

export function clickPresetMatches(preset: ClickPreset, snap: ClickPresetSnapshot): boolean {
  return (
    preset.bpm === clampBpm(snap.bpm) &&
    preset.clickSound === snap.clickSound &&
    clickBarsEqual(preset.bars, snap.bars) &&
    speedBuilderEqual(preset.speedBuilder, snap.speedBuilder)
  )
}

function parsePreset(raw: unknown): ClickPreset | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as {
    id?: unknown
    name?: unknown
    bpm?: unknown
    clickSound?: unknown
    bars?: unknown
    speedBuilder?: unknown
    updatedAt?: unknown
  }
  if (typeof row.id !== 'string' || row.id.length === 0) return null
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  if (!name) return null
  const bars = Array.isArray(row.bars)
    ? row.bars.map(parseBar).filter((bar): bar is RhythmBar => bar !== null).slice(0, MAX_BARS)
    : []
  if (bars.length === 0) return null
  return {
    id: row.id,
    name,
    bpm: clampBpm(typeof row.bpm === 'number' ? row.bpm : 120),
    clickSound: normalizeClickSound(row.clickSound),
    bars: bars.map(cloneBar),
    speedBuilder: parseSpeedBuilder(row.speedBuilder),
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : Date.now(),
  }
}

export function emptyClickPresetStore(): ClickPresetStore {
  return { loadedId: null, presets: [] }
}

export function parseClickPresetStore(raw: unknown): ClickPresetStore {
  if (!raw || typeof raw !== 'object') return emptyClickPresetStore()
  const row = raw as { loadedId?: unknown; presets?: unknown }
  const presets = Array.isArray(row.presets)
    ? row.presets.map(parsePreset).filter((item): item is ClickPreset => item !== null)
    : []
  const loadedId = typeof row.loadedId === 'string' && presets.some((item) => item.id === row.loadedId) ? row.loadedId : null
  return { loadedId, presets }
}

export function loadClickPresetStore(): ClickPresetStore {
  if (typeof localStorage === 'undefined') return emptyClickPresetStore()
  try {
    const raw = localStorage.getItem(CLICK_PRESETS_KEY)
    if (!raw) return emptyClickPresetStore()
    return parseClickPresetStore(JSON.parse(raw) as unknown)
  } catch {
    return emptyClickPresetStore()
  }
}

export function saveClickPresetStore(store: ClickPresetStore): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(
    CLICK_PRESETS_KEY,
    JSON.stringify({
      loadedId: store.loadedId,
      presets: store.presets.map((preset) => ({
        id: preset.id,
        name: preset.name.trim(),
        bpm: clampBpm(preset.bpm),
        clickSound: preset.clickSound,
        bars: preset.bars.map(cloneBar),
        speedBuilder: preset.speedBuilder,
        updatedAt: preset.updatedAt,
      })),
    }),
  )
}

export function createClickPreset(name: string, snap: ClickPresetSnapshot, id = newId()): ClickPreset {
  return {
    id,
    name: name.trim() || 'Click preset',
    bpm: clampBpm(snap.bpm),
    clickSound: snap.clickSound,
    bars: snap.bars.slice(0, MAX_BARS).map(cloneBar),
    speedBuilder: { ...snap.speedBuilder },
    updatedAt: Date.now(),
  }
}

export function nextClickPresetName(presets: readonly ClickPreset[]): string {
  const used = new Set(presets.map((item) => item.name.toLowerCase()))
  let n = presets.length + 1
  let name = `Click preset ${n}`
  while (used.has(name.toLowerCase())) {
    n += 1
    name = `Click preset ${n}`
  }
  return name
}

export function upsertClickPreset(store: ClickPresetStore, next: ClickPreset): ClickPresetStore {
  const index = store.presets.findIndex((item) => item.id === next.id)
  const presets = index < 0 ? [next, ...store.presets] : store.presets.map((item, itemIndex) => (itemIndex === index ? next : item))
  return { loadedId: next.id, presets }
}

export function renameClickPreset(store: ClickPresetStore, id: string, name: string): ClickPresetStore {
  const trimmed = name.trim()
  if (!trimmed) return store
  return {
    ...store,
    presets: store.presets.map((item) => (item.id === id ? { ...item, name: trimmed, updatedAt: Date.now() } : item)),
  }
}

export function deleteClickPreset(store: ClickPresetStore, id: string): ClickPresetStore {
  const presets = store.presets.filter((item) => item.id !== id)
  return {
    loadedId: store.loadedId === id ? null : store.loadedId,
    presets,
  }
}

export function findClickPreset(store: ClickPresetStore, id: string | null): ClickPreset | undefined {
  if (!id) return undefined
  return store.presets.find((item) => item.id === id)
}

function subdivShort(steps: SubdivisionId, beatUnit: RhythmBar['beatUnit']): string {
  if (steps === 1 && beatUnit === 4) return '♩'
  if (steps === 2) return beatUnit === 8 ? '16ths' : '8ths'
  if (steps === 3) return '8th triplets'
  if (steps === 4) return beatUnit === 4 ? '16ths' : '32nds'
  if (steps === 5) return '5-lets'
  if (steps === 6) return '6-lets'
  return '7-lets'
}

function accentList(bar: RhythmBar): string | null {
  const beats = [...bar.beatAccents].sort((a, b) => a.beat - b.beat).map((item) => item.beat + 1)
  if (beats.length === 0) return null
  if (beats.length === 1 && beats[0] === 1) return null
  return `accents ${beats.join(', ')}`
}

export function clickPresetSummary(snap: ClickPresetSnapshot, opts?: { alwaysSpeed?: boolean }): string {
  const bar = snap.bars[0]
  if (!bar) return `${clampBpm(snap.bpm)} BPM`
  const parts = [
    `${clampBpm(snap.bpm)} BPM`,
    meterLabel(bar.beats, bar.beatUnit),
    CLICK_SOUND_LABELS[snap.clickSound],
    subdivShort(bar.subdivision, bar.beatUnit),
    snap.bars.length === 1 ? '1 bar' : `${snap.bars.length} bars`,
  ]
  const accents = accentList(bar)
  if (accents) parts.push(accents)
  if (opts?.alwaysSpeed !== false) {
    if (opts?.alwaysSpeed || snap.speedBuilder.enabled) {
      parts.push(`Speed ${snap.speedBuilder.fromPct} → ${snap.speedBuilder.toPct}%`)
    }
  }
  return parts.join(' · ')
}
