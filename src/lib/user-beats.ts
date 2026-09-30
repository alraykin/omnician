import {
  MAX_BARS,
  clampBeats,
  clampBpm,
  cloneBar,
  isBeatUnit,
  makeBar,
  normalizeBeatSubdivisions,
  normalizeSubdivision,
  parseBeatAccents,
  parseVoiceHits,
  patternsEqual,
  VOICES,
  type RhythmBar,
} from '@/lib/rhythm'

export const USER_BEATS_KEY = 'omnician.drums.user-beats.v1'

export type UserBeat = {
  id: string
  name: string
  bpm: number
  bars: RhythmBar[]
  updatedAt: number
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ub-${crypto.randomUUID()}`
  }
  return `ub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function barsEqual(left: readonly RhythmBar[], right: readonly RhythmBar[]): boolean {
  if (left.length !== right.length) return false
  return left.every((bar, index) => {
    const other = right[index]
    return (
      other != null &&
      bar.beats === other.beats &&
      bar.beatUnit === other.beatUnit &&
      bar.subdivision === other.subdivision &&
      patternsEqual(bar.pattern, other.pattern)
    )
  })
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

function parseBeat(raw: unknown): UserBeat | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as {
    id?: unknown
    name?: unknown
    bpm?: unknown
    bars?: unknown
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
    bars: bars.map(cloneBar),
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : Date.now(),
  }
}

export function loadUserBeats(): UserBeat[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(USER_BEATS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseBeat).filter((beat): beat is UserBeat => beat !== null)
  } catch {
    return []
  }
}

export function saveUserBeats(beats: readonly UserBeat[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(
    USER_BEATS_KEY,
    JSON.stringify(
      beats.map((beat) => ({
        id: beat.id,
        name: beat.name.trim(),
        bpm: clampBpm(beat.bpm),
        bars: beat.bars.map(cloneBar),
        updatedAt: beat.updatedAt,
      })),
    ),
  )
}

export function findUserBeat(id: string, beats = loadUserBeats()): UserBeat | undefined {
  return beats.find((beat) => beat.id === id)
}

export function upsertUserBeat(
  beats: readonly UserBeat[],
  next: UserBeat,
): UserBeat[] {
  const index = beats.findIndex((beat) => beat.id === next.id)
  if (index < 0) return [next, ...beats]
  return beats.map((beat, item) => (item === index ? next : beat))
}

export function createUserBeat(
  name: string,
  bpm: number,
  bars: readonly RhythmBar[],
  id = newId(),
): UserBeat {
  const trimmed = name.trim() || 'Untitled beat'
  return {
    id,
    name: trimmed,
    bpm: clampBpm(bpm),
    bars: bars.slice(0, MAX_BARS).map(cloneBar),
    updatedAt: Date.now(),
  }
}

export function renameUserBeat(beats: readonly UserBeat[], id: string, name: string): UserBeat[] {
  const trimmed = name.trim()
  if (!trimmed) return [...beats]
  return beats.map((beat) =>
    beat.id === id ? { ...beat, name: trimmed, updatedAt: Date.now() } : beat,
  )
}

export function deleteUserBeat(beats: readonly UserBeat[], id: string): UserBeat[] {
  return beats.filter((beat) => beat.id !== id)
}

export function makeBlankBar(from: Pick<RhythmBar, 'beats' | 'beatUnit' | 'subdivision'>): RhythmBar {
  return makeBar(from.beats, from.beatUnit, from.subdivision)
}

/** New beat: 4 empty bars of 4/4 on a 16th grid. */
export const NEW_BEAT_BARS = 4
export const NEW_BEAT_BPM = 120

export function makeBlankBeat(): RhythmBar[] {
  return Array.from({ length: NEW_BEAT_BARS }, () => makeBar(4, 4, 4))
}
