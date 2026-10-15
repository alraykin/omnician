import {
  MIN_CLARITY,
  MIN_CLARITY_BASS,
  MIN_CLARITY_SUB,
  MIN_HZ,
  MAX_HZ,
  MIN_RMS,
} from './yin'

export const SMOOTH = {
  minClarity: MIN_CLARITY,
  minClarityBass: MIN_CLARITY_BASS,
  minRms: MIN_RMS,
  holdMs: 720,
  medianSize: 5,
  onsetRatio: 2.1,
  onsetRms: 0.007,
  octaveLo: 1.87,
  octaveHi: 2.14,
  /** Follow a real jump; never lerp toward 0¢. */
  snapCents: 36,
  /** Light exponential on sustain — jitter only, no fake settling. */
  sustainAlpha: 0.22,
  noteHysteresisCents: 70,
}

export type SmoothState = {
  hz: number | null
  centsHz: number | null
  median: number[]
  lastRms: number
  envRms: number
  lastOkAt: number
  held: boolean
  octaveHits: number
  noteHits: number
}

export function createSmoothState(): SmoothState {
  return {
    hz: null,
    centsHz: null,
    median: [],
    lastRms: 0,
    envRms: 0,
    lastOkAt: 0,
    held: false,
    octaveHits: 0,
    noteHits: 0,
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function octavePair(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false
  const r = a > b ? a / b : b / a
  return r > SMOOTH.octaveLo && r < SMOOTH.octaveHi
}

function passes(frequency: number, clarity: number, signal: number): boolean {
  if (!Number.isFinite(frequency) || frequency < MIN_HZ || frequency > MAX_HZ) return false
  const floor = frequency < 32 ? MIN_CLARITY_SUB : frequency < 55 ? SMOOTH.minClarityBass : SMOOTH.minClarity
  const rmsFloor = frequency < 32 ? SMOOTH.minRms : frequency < 50 ? SMOOTH.minRms * 1.25 : SMOOTH.minRms
  return clarity >= floor && signal >= rmsFloor
}

export type SmoothResult = {
  hz: number | null
  snapped: boolean
  held: boolean
  onset: boolean
}

/**
 * Fast lock on a new pluck (raw Hz — not pulled to 0¢), median + light
 * exponential on sustain, note/octave hysteresis, hold on decay.
 */
export function pushEstimate(
  state: SmoothState,
  rawHz: number,
  clarity: number,
  signal: number,
  nowMs: number,
  _dtSec: number,
): SmoothResult {
  const rising = signal > state.lastRms * SMOOTH.onsetRatio && signal > Math.max(SMOOTH.onsetRms, state.envRms * 1.3)
  const strong = passes(rawHz, clarity, signal)
  const onset = strong && (rising || state.hz === null)

  state.envRms = Math.max(signal, state.envRms * 0.988)

  if (strong) {
    if (state.hz !== null && octavePair(rawHz, state.hz) && !onset) {
      state.octaveHits += 1
      if (state.octaveHits < 4) {
        state.lastRms = signal
        state.held = true
        return { hz: state.hz, snapped: false, held: true, onset: false }
      }
    } else {
      state.octaveHits = 0
    }

    if (state.hz !== null && !onset) {
      const jumpCents = Math.abs(1200 * Math.log2(rawHz / state.hz))
      if (jumpCents > SMOOTH.noteHysteresisCents && jumpCents < 140) {
        state.noteHits += 1
        if (state.noteHits < 2) {
          state.lastRms = signal
          state.held = true
          return { hz: state.hz, snapped: false, held: true, onset: false }
        }
      } else {
        state.noteHits = 0
      }

      const decaying = signal < state.envRms * 0.55
      if (decaying && jumpCents > 8) {
        state.lastRms = signal
        state.held = true
        return { hz: state.hz, snapped: false, held: true, onset: false }
      }
    } else {
      state.noteHits = 0
    }

    state.lastRms = signal
    state.lastOkAt = nowMs
    state.held = false

    if (onset) {
      state.hz = rawHz
      state.centsHz = rawHz
      state.median = [rawHz]
      state.envRms = signal
      state.octaveHits = 0
      state.noteHits = 0
      return { hz: rawHz, snapped: true, held: false, onset }
    }

    const window = state.median
    window.push(rawHz)
    if (window.length > SMOOTH.medianSize) window.shift()
    const mid = window.length >= 3 ? median(window) : rawHz
    const prev = state.centsHz ?? mid
    const jump = Math.abs(1200 * Math.log2(mid / prev))
    const next = jump > SMOOTH.snapCents ? mid : prev + SMOOTH.sustainAlpha * (mid - prev)
    state.centsHz = next
    state.hz = next
    return { hz: next, snapped: false, held: false, onset: false }
  }

  state.lastRms *= 0.9
  if (state.hz !== null && nowMs - state.lastOkAt <= SMOOTH.holdMs) {
    state.held = true
    return { hz: state.hz, snapped: false, held: true, onset: false }
  }

  state.hz = null
  state.centsHz = null
  state.median = []
  state.held = false
  state.octaveHits = 0
  state.noteHits = 0
  return { hz: null, snapped: false, held: false, onset: false }
}
