/**
 * McLeod Pitch Method (NSDF) after McLeod & Wyvill,
 * "A Smarter Way to Find Pitch" (ICMC 2005).
 * Peak picking matches the published key-maximum rule used by the MIT-licensed
 * `pitchy` library. This file is an independent implementation of the paper.
 *
 * Dual path: a short full-rate window for guitar, plus a decimated long window
 * so E0 (~20.6 Hz) has several periods. Harmonic/octave checks fold a weak
 * fundamental back down instead of locking the 2nd harmonic.
 */

export const MIN_HZ = 16
export const MAX_HZ = 1500
export const HIGH_MIN_HZ = 38
export const LOW_MAX_HZ = 120
export const MIN_WINDOW = 2048
export const MAX_WINDOW = 32768
export const HOP = 512
export const LOW_DECIMATED_MIN = 3072
export const LOW_DECIMATED_MAX = 4096
/** k in the paper: first key maximum at or above k * nMax. */
export const CLARITY_K = 0.9
/** Reject guesses below this NSDF height. */
export const MIN_CLARITY = 0.9
export const MIN_CLARITY_BASS = 0.85
export const MIN_CLARITY_SUB = 0.8
export const MIN_RMS = 0.0024

export type PitchEstimate = {
  frequency: number
  clarity: number
}

export type PitchScratch = {
  nsdf: Float32Array
  diff: Float32Array
  cmnd: Float32Array
  low: Float32Array
}

export function createPitchScratch(maxWindow = MAX_WINDOW): PitchScratch {
  return {
    nsdf: new Float32Array(maxWindow),
    diff: new Float32Array(maxWindow),
    cmnd: new Float32Array(maxWindow),
    low: new Float32Array(LOW_DECIMATED_MAX + 8),
  }
}

export function lowDecimateFactor(sampleRate: number): number {
  if (sampleRate >= 80000) return 8
  if (sampleRate >= 40000) return 4
  return 2
}

export function windowForHz(hz: number | null, sampleRate: number): number {
  const f = hz && hz > 0 ? hz : 55
  const periods = f < 28 ? 5.5 : f < 50 ? 4.5 : f < 90 ? 3.6 : f < 180 ? 2.8 : 2.4
  const needed = Math.ceil((sampleRate / f) * periods)
  const capped = Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, needed))
  if (capped <= 2048) return 2048
  if (capped <= 3072) return 3072
  if (capped <= 4096) return 4096
  if (capped <= 6144) return 6144
  if (capped <= 8192) return 8192
  if (capped <= 12288) return 12288
  if (capped <= 16384) return 16384
  if (capped <= 24576) return 24576
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

export function decimateAverage(
  buffer: ArrayLike<number>,
  factor: number,
  out?: Float32Array,
): Float32Array {
  const n = Math.floor(buffer.length / factor)
  const dest = out && out.length >= n ? out : new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    let s = 0
    const base = i * factor
    for (let k = 0; k < factor; k += 1) s += buffer[base + k]
    dest[i] = s / factor
  }
  return dest.length === n ? dest : dest.subarray(0, n)
}

function sliceTail(buffer: ArrayLike<number>, take: number): ArrayLike<number> {
  const n = buffer.length
  const count = Math.min(n, take)
  if (count === n) return buffer
  const start = n - count
  if (typeof (buffer as Float32Array).subarray === 'function') {
    return (buffer as Float32Array).subarray(start, n)
  }
  return buffer
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
  if (nMax < MIN_CLARITY_SUB) return { frequency: 0, clarity: 0 }

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
  const clarity = Math.max(
    0,
    Math.min(1, 1 - (typeof yinVal === 'number' ? Math.min(cmnd[tauEstimate], 1) : cmnd[tauEstimate])),
  )
  if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) {
    return { frequency: 0, clarity: 0 }
  }
  return { frequency, clarity }
}

function goertzelPower(buffer: ArrayLike<number>, sampleRate: number, hz: number): number {
  const n = buffer.length
  if (n < 8 || hz <= 0) return 0
  const k = (n * hz) / sampleRate
  const w = (2 * Math.PI * k) / n
  const cosine = Math.cos(w)
  const coeff = 2 * cosine
  let s0 = 0
  let s1 = 0
  let s2 = 0
  for (let i = 0; i < n; i += 1) {
    s0 = buffer[i] + coeff * s1 - s2
    s2 = s1
    s1 = s0
  }
  const real = s1 - s2 * cosine
  const imag = s2 * Math.sin(w)
  return real * real + imag * imag
}

/** Drop to f/2 or f/3 only when the spectrum actually has energy there. */
export function maybeLowerOctave(
  buffer: ArrayLike<number>,
  sampleRate: number,
  estimate: PitchEstimate,
  minHz = MIN_HZ,
): PitchEstimate {
  if (estimate.frequency <= 0 || estimate.frequency > 120) return estimate
  let f = estimate.frequency
  for (const div of [2, 3]) {
    const lower = f / div
    if (lower < minHz) continue
    const pLow = goertzelPower(buffer, sampleRate, lower)
    const pHigh = goertzelPower(buffer, sampleRate, f)
    const pLo = goertzelPower(buffer, sampleRate, lower * 0.89)
    const pHi = goertzelPower(buffer, sampleRate, lower * 1.12)
    const pThird = goertzelPower(buffer, sampleRate, lower * 3)
    const pOct = goertzelPower(buffer, sampleRate, f * 2)
    const magLow = Math.sqrt(Math.max(0, pLow))
    const magHigh = Math.sqrt(Math.max(0, pHigh))
    if (magHigh < 1e-9) continue
    const peaked = pLow > pLo * 1.45 && pLow > pHi * 1.45
    const series = pThird > pOct * 0.28
    const minRatio = div === 3 ? 0.28 : 0.1
    if (peaked && series && magLow > magHigh * minRatio) {
      f = lower
      break
    }
  }
  if (f === estimate.frequency) return estimate
  return { frequency: f, clarity: estimate.clarity }
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

function clarityFloor(hz: number): number {
  if (hz < 32) return MIN_CLARITY_SUB
  if (hz < 55) return MIN_CLARITY_BASS
  return MIN_CLARITY
}

function pickEstimate(
  high: PitchEstimate,
  yin: PitchEstimate,
  low: PitchEstimate,
  prevHz: number | null,
): PitchEstimate {
  let chosen = high
  if (yin.frequency > 0 && yin.clarity >= 0.75 && high.frequency > 0) {
    if (isOctaveRatio(high.frequency, yin.frequency) && yin.frequency < high.frequency) {
      chosen = { frequency: yin.frequency, clarity: Math.min(high.clarity, yin.clarity + 0.04) }
    } else if (isThirdHarmonic(high.frequency, yin.frequency) && yin.frequency < 220) {
      chosen = { frequency: yin.frequency, clarity: Math.min(high.clarity, yin.clarity) }
    }
  }

  if (low.frequency > 0 && low.clarity >= MIN_CLARITY_SUB) {
    if (chosen.frequency <= 0) return low
    if (prevHz && prevHz < HIGH_MIN_HZ) {
      const lowErr = Math.abs(1200 * Math.log2(low.frequency / prevHz))
      const highErr = Math.abs(1200 * Math.log2(chosen.frequency / prevHz))
      if (lowErr + 12 < highErr) return low
    }
  }

  if (chosen.frequency > 0 && chosen.clarity < clarityFloor(chosen.frequency)) {
    if (low.frequency > 0 && low.clarity >= clarityFloor(low.frequency)) return low
    return { frequency: 0, clarity: chosen.clarity }
  }
  if (chosen.frequency > 0) return chosen
  if (low.frequency > 0 && low.clarity >= clarityFloor(low.frequency)) return low
  return chosen
}

/**
 * MPM first, YIN only to pull a 2nd/3rd-harmonic grab back to the fundamental.
 * Dual-path: full-rate guitar window + decimated bass window.
 * Low-clarity frames are rejected — we do not guess.
 */
export function estimatePitch(
  buffer: ArrayLike<number>,
  sampleRate: number,
  scratch: PitchScratch,
  prevHz: number | null = null,
): PitchEstimate {
  const energy = localRms(buffer)
  if (energy < MIN_RMS) return { frequency: 0, clarity: 0 }

  const highWin = Math.min(
    buffer.length,
    windowForHz(prevHz && prevHz >= 70 ? prevHz : 110, sampleRate),
  )
  const highBuf = sliceTail(buffer, highWin)
  const high = maybeLowerOctave(
    buffer,
    sampleRate,
    mpmPitch(highBuf, sampleRate, scratch, HIGH_MIN_HZ, MAX_HZ),
    MIN_HZ,
  )
  const yin = high.frequency > 0 ? yinPitch(highBuf, sampleRate, scratch, HIGH_MIN_HZ, MAX_HZ) : { frequency: 0, clarity: 0 }

  const wantLow =
    (!prevHz || prevHz < 58) && (high.frequency <= 0 || high.frequency < 58)
  let low: PitchEstimate = { frequency: 0, clarity: 0 }
  if (wantLow) {
    const factor = lowDecimateFactor(sampleRate)
    const fullNeeded = LOW_DECIMATED_MAX * factor
    const lowSlice = sliceTail(buffer, Math.min(buffer.length, fullNeeded))
    if (lowSlice.length >= LOW_DECIMATED_MIN * factor) {
      const decimated = decimateAverage(lowSlice, factor, scratch.low)
      const keep = Math.min(decimated.length, LOW_DECIMATED_MAX)
      const lowBuf =
        keep === decimated.length
          ? decimated
          : decimated.subarray(decimated.length - keep)
      if (lowBuf.length >= LOW_DECIMATED_MIN) {
        const rawLow = mpmPitch(lowBuf, sampleRate / factor, scratch, MIN_HZ, LOW_MAX_HZ)
        low = maybeLowerOctave(lowBuf, sampleRate / factor, rawLow, MIN_HZ)
      }
    }
  }

  return maybeLowerOctave(buffer, sampleRate, pickEstimate(high, yin, low, prevHz), MIN_HZ)
}

const EMPTY: PitchEstimate = { frequency: 0, clarity: 0 }

export function estimateFromFilled(
  buffer: ArrayLike<number>,
  filled: number,
  sampleRate: number,
  scratch: PitchScratch,
  prevHz: number | null,
): PitchEstimate {
  const take = Math.min(filled, MAX_WINDOW)
  if (take < MIN_WINDOW) return EMPTY
  const start = Math.max(0, filled - take)
  const slice =
    typeof (buffer as Float32Array).subarray === 'function'
      ? (buffer as Float32Array).subarray(start, start + take)
      : buffer
  return estimatePitch(slice, sampleRate, scratch, prevHz)
}
