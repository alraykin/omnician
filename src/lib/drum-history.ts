import { cloneBar, type RhythmBar } from '@/lib/rhythm'
import { normalizeDrumInput, type InputDivision } from '@/lib/beat-boxes'

export const MAX_DRUM_HISTORY = 50

export type DrumSnapshot = {
  bars: RhythmBar[]
  barIndex: number
  fillVariant: number
  drumInput: InputDivision
}

export type DrumHistory = {
  past: DrumSnapshot[]
  future: DrumSnapshot[]
}

export function emptyDrumHistory(): DrumHistory {
  return { past: [], future: [] }
}

export function captureDrumSnapshot(
  bars: readonly RhythmBar[],
  barIndex: number,
  fillVariant: number,
  drumInput: InputDivision,
): DrumSnapshot {
  return {
    bars: bars.map(cloneBar),
    barIndex: Math.min(Math.max(0, barIndex), Math.max(0, bars.length - 1)),
    fillVariant,
    drumInput: normalizeDrumInput(drumInput),
  }
}

export function pushDrumHistory(history: DrumHistory, current: DrumSnapshot): DrumHistory {
  return {
    past: [...history.past, current].slice(-MAX_DRUM_HISTORY),
    future: [],
  }
}

export function undoDrumHistory(
  history: DrumHistory,
  current: DrumSnapshot,
): { history: DrumHistory; snapshot: DrumSnapshot } | null {
  const prev = history.past[history.past.length - 1]
  if (!prev) return null
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, MAX_DRUM_HISTORY),
    },
    snapshot: {
      bars: prev.bars.map(cloneBar),
      barIndex: prev.barIndex,
      fillVariant: prev.fillVariant,
      drumInput: prev.drumInput,
    },
  }
}

export function redoDrumHistory(
  history: DrumHistory,
  current: DrumSnapshot,
): { history: DrumHistory; snapshot: DrumSnapshot } | null {
  const next = history.future[0]
  if (!next) return null
  return {
    history: {
      past: [...history.past, current].slice(-MAX_DRUM_HISTORY),
      future: history.future.slice(1),
    },
    snapshot: {
      bars: next.bars.map(cloneBar),
      barIndex: next.barIndex,
      fillVariant: next.fillVariant,
      drumInput: next.drumInput,
    },
  }
}
