import { MIN_HZ, MAX_HZ } from './yin'

export const SMOOTH = {
  minClarity: 0.7,
  minRms: 0.0024,
  holdMs: 560,
  medianSize: 5,
  onsetRatio: 2.15,
  onsetRms: 0.008,
  lockSemitones: 0.12,
  euroMinCutoff: 0.35,
  euroBeta: 0.004,
  euroDCutoff: 1.0,
}

export type SmoothState = {
  hz: number | null
  log2: number | null
  deriv: number
  median: number[]
  lastRms: number
  envRms: number
  lastOkAt: number
  held: boolean
}

export function createSmoothState(): SmoothState {
  return {
    hz: null,
    log2: null,
    deriv: 0,
    median: [],
    lastRms: 0,
    envRms: 0,
    lastOkAt: 0,
    held: false,
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function alpha(dt: number, cutoff: number): number {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / Math.max(dt, 1e-4))
}

function lowpass(current: number, previous: number, a: number): number {
  return previous + a * (current - previous)
}

function passes(frequency: number, clarity: number, signal: number): boolean {
  if (!Number.isFinite(frequency) || frequency < MIN_HZ || frequency > MAX_HZ) return false
  let clarityFloor = SMOOTH.minClarity
  let rmsFloor = SMOOTH.minRms
  if (frequency < 52) {
    clarityFloor = 0.78
    rmsFloor = 0.008
  } else if (frequency < 80) {
    clarityFloor = 0.74
    rmsFloor = 0.004
  }
  return clarity >= clarityFloor && signal >= rmsFloor
}

export type SmoothResult = {
  hz: number | null
  snapped: boolean
  held: boolean
  onset: boolean
}

/** Attack-aware: snap on pluck / new note, one-euro + median on sustain, hold on decay. */
export function pushEstimate(
  state: SmoothState,
  rawHz: number,
  clarity: number,
  signal: number,
  nowMs: number,
  dtSec: number,
): SmoothResult {
  const rising = signal > state.lastRms * SMOOTH.onsetRatio && signal > Math.max(SMOOTH.onsetRms, state.envRms * 1.35)
  const strong = passes(rawHz, clarity, signal)
  const onset = strong && rising

  state.envRms = Math.max(signal, state.envRms * 0.985)

  if (strong) {
    if (state.hz !== null && !onset) {
      const decaying = signal < state.envRms * 0.62
      const jump = Math.abs(12 * Math.log2(rawHz / state.hz))
      if (decaying || jump > SMOOTH.lockSemitones) {
        state.lastRms = signal
        state.held = true
        return { hz: state.hz, snapped: false, held: true, onset: false }
      }
    }

    state.lastRms = signal
    state.lastOkAt = nowMs
    state.held = false

    if (onset || state.hz === null) {
      state.hz = rawHz
      state.log2 = Math.log2(rawHz)
      state.deriv = 0
      state.median = [rawHz]
      state.envRms = signal
      return { hz: rawHz, snapped: true, held: false, onset }
    }

    const window = state.median
    window.push(rawHz)
    if (window.length > SMOOTH.medianSize) window.shift()
    const mid = window.length >= 3 ? median(window) : rawHz
    const x = Math.log2(mid)
    const prev = state.log2 ?? x
    const dx = (x - prev) / Math.max(dtSec, 1e-4)
    state.deriv = lowpass(dx, state.deriv, alpha(dtSec, SMOOTH.euroDCutoff))
    const cutoff = SMOOTH.euroMinCutoff + SMOOTH.euroBeta * Math.abs(state.deriv)
    state.log2 = lowpass(x, prev, alpha(dtSec, cutoff))
    state.hz = 2 ** state.log2
    return { hz: state.hz, snapped: false, held: false, onset: false }
  }

  state.lastRms *= 0.92
  if (state.hz !== null && nowMs - state.lastOkAt <= SMOOTH.holdMs) {
    state.held = true
    return { hz: state.hz, snapped: false, held: true, onset: false }
  }

  state.hz = null
  state.log2 = null
  state.deriv = 0
  state.median = []
  state.held = false
  return { hz: null, snapped: false, held: false, onset: false }
}
