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
export const MAX_HZ = 2200
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
  const start = Math.max(1, tauMin)
  const last = Math.min(tauMax, nsdf.length - 2)
  for (let i = start; i <= last; i += 1) {
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

  // High notes: NSDF at 2τ is often taller after filtering. Do not skip the
  // first (shortest-τ) peak when it is already a clear high-frequency match.
  const firstTau = keys[0] ?? 0
  const highCutoff = firstTau > 0 && sampleRate / firstTau > 800 ? 0.82 : CLARITY_K
  const cutoff = highCutoff * nMax
  for (const i of keys) {
    if (scratch.nsdf[i] < cutoff) continue
    const [tau, peak] = parabolicPeak(scratch.nsdf, i)
    if (tau <= tauMin + 0.6 || tau >= tauMax - 0.6) continue
    const frequency = sampleRate / tau
    const clarity = Math.max(0, Math.min(1, peak))
    if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) continue
    return { frequency, clarity }
  }
  return { frequency: 0, clarity: 0 }
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
  if (tau <= tauMin + 0.6 || tau >= tauMax - 0.6) {
    return { frequency: 0, clarity: 0 }
  }
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

function magAt(buffer: ArrayLike<number>, sampleRate: number, hz: number): number {
  return Math.sqrt(Math.max(0, goertzelPower(buffer, sampleRate, hz)))
}

/**
 * Harmonic-series strength at f. Weights 2f/3f so a missing fundamental
 * still scores when the 2nd harmonic dominates.
 */
export function harmonicStrength(
  buffer: ArrayLike<number>,
  sampleRate: number,
  hz: number,
): number {
  if (hz <= 0) return 0
  const weights = [1, 0.65, 0.4, 0.2]
  let score = 0
  for (let h = 1; h <= weights.length; h += 1) {
    const f = hz * h
    if (f > sampleRate * 0.45) break
    score += weights[h - 1] * magAt(buffer, sampleRate, f)
  }
  return score
}

function nsdfAtTau(buffer: ArrayLike<number>, tau: number): number {
  const n = buffer.length
  const iTau = Math.floor(tau)
  const frac = tau - iTau
  const lim = n - iTau - 1
  if (lim < 8 || iTau < 1) return -1
  let ac = 0
  let m = 0
  for (let j = 0; j < lim; j += 1) {
    const a = buffer[j]
    const b = buffer[j + iTau] * (1 - frac) + buffer[j + iTau + 1] * frac
    ac += a * b
    m += a * a + b * b
  }
  return m > 1e-12 ? (2 * ac) / m : -1
}

/** Fractional-τ NSDF peak so interpolation bias does not pull readings. */
export function refineFrequency(
  buffer: ArrayLike<number>,
  sampleRate: number,
  hz: number,
): number {
  if (hz <= 0) return hz
  const tau0 = sampleRate / hz
  const maxTau = buffer.length - 3
  if (tau0 < 2 || tau0 > maxTau) return hz
  if (hz >= 55) return hz
  const span = 8
  let lo = tau0 / 2 ** (span / 1200)
  let hi = tau0 * 2 ** (span / 1200)
  lo = Math.max(2, lo)
  hi = Math.min(maxTau, hi)
  for (let i = 0; i < 14; i += 1) {
    const m1 = lo + (hi - lo) * 0.382
    const m2 = lo + (hi - lo) * 0.618
    if (nsdfAtTau(buffer, m1) < nsdfAtTau(buffer, m2)) lo = m1
    else hi = m2
  }
  const tau = (lo + hi) / 2
  const next = sampleRate / tau
  return Number.isFinite(next) && next > 0 ? next : hz
}

/**
 * Fold a 2nd/3rd-harmonic lock back to the fundamental.
 * Works when the fundamental is weak or missing: odd partials of f/2
 * (1.5f, 2.5f) are not harmonics of f, so their energy is the tell.
 */
export function maybeLowerOctave(
  buffer: ArrayLike<number>,
  sampleRate: number,
  estimate: PitchEstimate,
  minHz = MIN_HZ,
): PitchEstimate {
  if (estimate.frequency <= 0 || estimate.frequency > 200) return estimate
  let f = estimate.frequency
  for (const div of [2, 3]) {
    const lower = f / div
    if (lower < minHz) continue
    const magF = magAt(buffer, sampleRate, f)
    const peakHarm = Math.max(
      magF,
      magAt(buffer, sampleRate, f * 2),
      magAt(buffer, sampleRate, f * 3),
    )
    if (peakHarm < 1e-12) continue
    const magLower = magAt(buffer, sampleRate, lower)
    const peaked =
      magLower > magAt(buffer, sampleRate, lower * 0.89) * 1.25 &&
      magLower > magAt(buffer, sampleRate, lower * 1.12) * 1.25
    const oddSeries =
      div === 2
        ? magAt(buffer, sampleRate, lower * 3) + 0.55 * magAt(buffer, sampleRate, lower * 5)
        : magAt(buffer, sampleRate, lower * 2) + 0.65 * magAt(buffer, sampleRate, lower * 4)
    const fundRatio = magLower / peakHarm
    const oddStrong = oddSeries > peakHarm * (div === 3 ? 0.38 : 0.32)
    if ((peaked && fundRatio > 0.12) || oddStrong || fundRatio > 0.35) {
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
  if (high.frequency <= 0 && yin.frequency > 0 && yin.clarity >= 0.75) {
    chosen = yin
  } else if (yin.frequency > 0 && yin.clarity >= 0.75 && high.frequency > 0) {
    if (
      isOctaveRatio(high.frequency, yin.frequency) &&
      yin.frequency > high.frequency &&
      high.frequency > 400
    ) {
      chosen = { frequency: yin.frequency, clarity: Math.min(high.clarity + 0.04, yin.clarity) }
    } else if (
      isOctaveRatio(high.frequency, yin.frequency) &&
      yin.frequency < high.frequency &&
      high.frequency < 130
    ) {
      chosen = { frequency: yin.frequency, clarity: Math.min(high.clarity, yin.clarity + 0.04) }
    } else if (isThirdHarmonic(high.frequency, yin.frequency) && yin.frequency < 220) {
      chosen = { frequency: yin.frequency, clarity: Math.min(high.clarity, yin.clarity) }
    }
  }

  if (low.frequency > 0 && low.clarity >= MIN_CLARITY_SUB) {
    if (chosen.frequency <= 0) return low
    if (prevHz && prevHz < 80) {
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
  const highMin = HIGH_MIN_HZ
  const high = maybeLowerOctave(
    buffer,
    sampleRate,
    mpmPitch(highBuf, sampleRate, scratch, highMin, MAX_HZ),
    MIN_HZ,
  )
  // YIN may dip at 2τ. Only trust it to fold a low/mid harmonic lock, never high strings.
  const yin = yinPitch(
    highBuf,
    sampleRate,
    scratch,
    high.frequency > 280 ? Math.max(highMin, high.frequency * 0.72) : highMin,
    MAX_HZ,
  )

  const wantLow =
    !prevHz ||
    prevHz < 90 ||
    high.frequency <= 0 ||
    high.frequency < 90
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

  let picked = maybeLowerOctave(buffer, sampleRate, pickEstimate(high, yin, low, prevHz), MIN_HZ)
  if (picked.frequency > 0) {
    const refined = refineFrequency(buffer, sampleRate, picked.frequency)
    if (
      refined > MIN_HZ &&
      refined < MAX_HZ &&
      Math.abs(1200 * Math.log2(refined / picked.frequency)) <= 10
    ) {
      picked = { frequency: refined, clarity: picked.clarity }
    }
  }
  return picked
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
