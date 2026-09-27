/**
 * McLeod Pitch Method (NSDF) after McLeod & Wyvill,
 * "A Smarter Way to Find Pitch" (ICMC 2005).
 * Peak picking matches the published key-maximum rule used by the MIT-licensed
 * `pitchy` library. This file is an independent implementation of the paper.
 */

export const MIN_HZ = 27
export const MAX_HZ = 1500
export const MIN_WINDOW = 2048
export const MAX_WINDOW = 8192
export const HOP = 512
/** k in the paper: first key maximum at or above k * nMax. */
export const CLARITY_K = 0.9
/** Reject guesses below this NSDF height. */
export const MIN_CLARITY = 0.9
export const MIN_CLARITY_BASS = 0.85
export const MIN_RMS = 0.0024

export type PitchEstimate = {
  frequency: number
  clarity: number
}

export type PitchScratch = {
  nsdf: Float32Array
  diff: Float32Array
  cmnd: Float32Array
}

export function createPitchScratch(maxWindow = MAX_WINDOW): PitchScratch {
  return {
    nsdf: new Float32Array(maxWindow),
    diff: new Float32Array(maxWindow),
    cmnd: new Float32Array(maxWindow),
  }
}

export function windowForHz(hz: number | null, sampleRate: number): number {
  const f = hz && hz > 0 ? hz : 55
  const periods = f < 50 ? 3.6 : f < 90 ? 3.2 : f < 180 ? 2.8 : 2.4
  const needed = Math.ceil((sampleRate / f) * periods)
  const capped = Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, needed))
  if (capped <= 2048) return 2048
  if (capped <= 3072) return 3072
  if (capped <= 4096) return 4096
  if (capped <= 6144) return 6144
  return MAX_WINDOW
}

export function localRms(buffer: ArrayLike<number>, start = 0, end = buffer.length): number {
  let sum = 0
  const n = Math.max(1, end - start)
  for (let i = start; i < end; i += 1) {
    const s = buffer[i]
    sum += s * s
  }
  return Math.sqrt(sum / n)
}

function parabolicPeak(values: ArrayLike<number>, index: number): [number, number] {
  if (index <= 0 || index >= values.length - 1) return [index, values[index] ?? 0]
  const y0 = values[index - 1]
  const y1 = values[index]
  const y2 = values[index + 1]
  const denom = 2 * (y0 - 2 * y1 + y2)
  if (Math.abs(denom) < 1e-12) return [index, y1]
  const shift = (y0 - y2) / denom
  if (!Number.isFinite(shift) || Math.abs(shift) > 1) return [index, y1]
  const yMax = y1 - 0.25 * (y0 - y2) * shift
  return [index + shift, Number.isFinite(yMax) ? yMax : y1]
}

/** McLeod key maxima: tallest point between + and − zero crossings of the NSDF. */
export function keyMaximumIndices(nsdf: ArrayLike<number>, tauMin: number, tauMax: number): number[] {
  const keys: number[] = []
  let looking = false
  let max = -Infinity
  let maxIndex = -1
  const last = Math.min(tauMax, nsdf.length - 2)
  for (let i = Math.max(1, tauMin); i <= last; i += 1) {
    const prev = nsdf[i - 1]
    const cur = nsdf[i]
    if (prev <= 0 && cur > 0) {
      looking = true
      maxIndex = i
      max = cur
    } else if (prev > 0 && cur <= 0) {
      if (looking && maxIndex !== -1) keys.push(maxIndex)
      looking = false
      maxIndex = -1
      max = -Infinity
    } else if (looking && cur > max) {
      max = cur
      maxIndex = i
    }
  }
  if (looking && maxIndex !== -1 && max > 0) keys.push(maxIndex)
  return keys
}

function fillNsdf(buffer: ArrayLike<number>, tauMax: number, nsdf: Float32Array): void {
  const n = buffer.length
  nsdf[0] = 1
  for (let tau = 1; tau <= tauMax; tau += 1) {
    let ac = 0
    let m = 0
    const lim = n - tau
    for (let j = 0; j < lim; j += 1) {
      const a = buffer[j]
      const b = buffer[j + tau]
      ac += a * b
      m += a * a + b * b
    }
    nsdf[tau] = m > 1e-12 ? (2 * ac) / m : 0
  }
}

export function mpmPitch(
  buffer: ArrayLike<number>,
  sampleRate: number,
  scratch: PitchScratch,
  minHz = MIN_HZ,
  maxHz = MAX_HZ,
): PitchEstimate {
  const n = buffer.length
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz))
  const tauMax = Math.min(scratch.nsdf.length - 1, Math.floor(sampleRate / minHz), n - 2)
  if (tauMax <= tauMin + 2) return { frequency: 0, clarity: 0 }

  fillNsdf(buffer, tauMax, scratch.nsdf)
  const keys = keyMaximumIndices(scratch.nsdf, tauMin, tauMax)
  if (keys.length === 0) return { frequency: 0, clarity: 0 }

  let nMax = 0
  for (const i of keys) {
    if (scratch.nsdf[i] > nMax) nMax = scratch.nsdf[i]
  }
  if (nMax < MIN_CLARITY_BASS) return { frequency: 0, clarity: 0 }

  const cutoff = CLARITY_K * nMax
  let chosen = keys[0]
  for (const i of keys) {
    if (scratch.nsdf[i] >= cutoff) {
      chosen = i
      break
    }
  }

  const [tau, peak] = parabolicPeak(scratch.nsdf, chosen)
  const frequency = sampleRate / tau
  const clarity = Math.max(0, Math.min(1, peak))
  if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) {
    return { frequency: 0, clarity: 0 }
  }
  return { frequency, clarity }
}

/** YIN as an octave check only — never a standalone guess. */
export function yinPitch(
  buffer: ArrayLike<number>,
  sampleRate: number,
  scratch: PitchScratch,
  minHz = MIN_HZ,
  maxHz = MAX_HZ,
  threshold = 0.12,
): PitchEstimate {
  const n = buffer.length
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz))
  const tauMax = Math.min(scratch.diff.length - 1, Math.floor(sampleRate / minHz), Math.floor(n / 2) - 1)
  if (tauMax <= tauMin + 2) return { frequency: 0, clarity: 0 }

  const diff = scratch.diff
  const cmnd = scratch.cmnd
  diff[0] = 0
  for (let tau = 1; tau <= tauMax; tau += 1) {
    let sum = 0
    const lim = n - tau
    for (let j = 0; j < lim; j += 1) {
      const d = buffer[j] - buffer[j + tau]
      sum += d * d
    }
    diff[tau] = sum
  }
  cmnd[0] = 1
  let running = 0
  for (let tau = 1; tau <= tauMax; tau += 1) {
    running += diff[tau]
    cmnd[tau] = running > 0 ? (diff[tau] * tau) / running : 1
  }

  let tauEstimate = 0
  for (let tau = tauMin; tau < tauMax; tau += 1) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau += 1
      tauEstimate = tau
      break
    }
  }
  if (tauEstimate === 0) return { frequency: 0, clarity: 0 }

  const [tau, yinVal] = parabolicPeak(cmnd, tauEstimate)
  const frequency = sampleRate / tau
  const clarity = Math.max(0, Math.min(1, 1 - (typeof yinVal === 'number' ? Math.min(cmnd[tauEstimate], 1) : cmnd[tauEstimate])))
  if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) {
    return { frequency: 0, clarity: 0 }
  }
  return { frequency, clarity }
}

function isOctaveRatio(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false
  const r = a > b ? a / b : b / a
  return r > 1.87 && r < 2.14
}

function isThirdHarmonic(higher: number, lower: number): boolean {
  const r = higher / lower
  return r > 2.85 && r < 3.2
}

/**
 * MPM first, YIN only to pull a 2nd/3rd-harmonic grab back to the fundamental.
 * Low-clarity frames are rejected — we do not guess.
 */
export function estimatePitch(
  buffer: ArrayLike<number>,
  sampleRate: number,
  scratch: PitchScratch,
): PitchEstimate {
  const energy = localRms(buffer)
  if (energy < MIN_RMS) return { frequency: 0, clarity: 0 }

  const mpm = mpmPitch(buffer, sampleRate, scratch)
  if (mpm.frequency <= 0) return mpm

  const yin = yinPitch(buffer, sampleRate, scratch)
  if (yin.frequency > 0 && yin.clarity >= 0.75) {
    if (isOctaveRatio(mpm.frequency, yin.frequency) && yin.frequency < mpm.frequency) {
      return { frequency: yin.frequency, clarity: Math.min(mpm.clarity, yin.clarity + 0.04) }
    }
    if (isThirdHarmonic(mpm.frequency, yin.frequency) && yin.frequency < 220) {
      return { frequency: yin.frequency, clarity: Math.min(mpm.clarity, yin.clarity) }
    }
  }

  const floor = mpm.frequency < 55 ? MIN_CLARITY_BASS : MIN_CLARITY
  if (mpm.clarity < floor) return { frequency: 0, clarity: mpm.clarity }
  return mpm
}

const EMPTY: PitchEstimate = { frequency: 0, clarity: 0 }

export function estimateFromFilled(
  buffer: ArrayLike<number>,
  filled: number,
  sampleRate: number,
  scratch: PitchScratch,
  prevHz: number | null,
): PitchEstimate {
  const take = (window: number) => {
    const start = Math.max(0, filled - window)
    if (typeof (buffer as Float32Array).subarray === 'function') {
      return estimatePitch((buffer as Float32Array).subarray(start, start + window), sampleRate, scratch)
    }
    return estimatePitch(buffer, sampleRate, scratch)
  }

  const window = Math.min(filled, windowForHz(prevHz, sampleRate))
  if (window < MIN_WINDOW) return EMPTY
  const first = take(window)
  if (first.frequency > 0) return first
  if (!prevHz || prevHz > 70) {
    const full = Math.min(filled, windowForHz(40, sampleRate))
    if (full > window) return take(full)
  }
  return first
}
