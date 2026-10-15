/**
 * FastYIN pitch tracker (de Cheveigné & Kawahara 2002, FFT difference).
 * CMND + absolute threshold + parabolic interpolation, with pYIN-style
 * multi-candidate picking and an HPS octave check so a weak/missing
 * fundamental (bass, drop tunings) is not read as 2f/3f.
 *
 * Adaptive window: ≥ ~2.6 periods of the lowest target (E0 ≈ 20.6 Hz →
 * ~100–150 ms at 48 kHz); shorter windows for high strings.
 */

export const MIN_HZ = 16
export const MAX_HZ = 4800
export const HIGH_MIN_HZ = 48
export const LOW_MAX_HZ = 140
export const MIN_WINDOW = 2048
export const MAX_WINDOW = 32768
export const HOP = 512
export const LOW_DECIMATED_MIN = 2048
export const LOW_DECIMATED_MAX = 4096
export const FFT_MAX = 65536
export const YIN_THRESHOLD = 0.12
export const YIN_THRESHOLD_BASS = 0.15
export const YIN_THRESHOLD_HIGH = 0.1
export const CANDIDATE_CMND = 0.38
export const MIN_CLARITY = 0.88
export const MIN_CLARITY_BASS = 0.82
export const MIN_CLARITY_SUB = 0.76
export const MIN_RMS = 0.0022
export const CLARITY_K = 0.9

export type PitchEstimate = {
  frequency: number
  clarity: number
}

export type PitchScratch = {
  nsdf: Float32Array
  diff: Float32Array
  cmnd: Float32Array
  low: Float32Array
  re: Float32Array
  im: Float32Array
  mag: Float32Array
  window: Float32Array
}

export type YinResult = PitchEstimate & {
  candidates: PitchEstimate[]
  fftSize: number
}

export function createPitchScratch(maxWindow = MAX_WINDOW): PitchScratch {
  return {
    nsdf: new Float32Array(maxWindow + 8),
    diff: new Float32Array(maxWindow),
    cmnd: new Float32Array(maxWindow),
    low: new Float32Array(LOW_DECIMATED_MAX + 8),
    re: new Float32Array(FFT_MAX),
    im: new Float32Array(FFT_MAX),
    mag: new Float32Array(FFT_MAX),
    window: new Float32Array(maxWindow),
  }
}

export function lowDecimateFactor(sampleRate: number): number {
  if (sampleRate >= 80000) return 8
  if (sampleRate >= 40000) return 4
  return 2
}

function snapWindow(needed: number): number {
  const caps = [2048, 3072, 4096, 6144, 8192, 12288, 16384, 24576, MAX_WINDOW]
  const n = Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, needed))
  for (const cap of caps) {
    if (n <= cap) return cap
  }
  return MAX_WINDOW
}

/** Adaptive analysis window: ≥2.6 periods on lows (~128 ms at E0 / 48 kHz). */
export function windowForHz(hz: number | null, sampleRate: number): number {
  const f = hz && hz > 0 ? hz : 28
  const periods = f < 28 ? 2.6 : f < 50 ? 2.8 : f < 90 ? 2.6 : f < 180 ? 2.4 : 2.2
  return snapWindow(Math.ceil((sampleRate / f) * periods))
}

export function minHzForWindow(n: number, sampleRate: number): number {
  if (n < 8) return MAX_HZ
  return Math.max(MIN_HZ, (2.05 * sampleRate) / n)
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

export function peakAbs(buffer: ArrayLike<number>): number {
  let peak = 0
  for (let i = 0; i < buffer.length; i += 1) {
    const a = Math.abs(buffer[i])
    if (a > peak) peak = a
  }
  return peak
}

function parabolicExtremum(values: ArrayLike<number>, index: number): [number, number] {
  if (index <= 0 || index >= values.length - 1) return [index, values[index] ?? 0]
  const y0 = values[index - 1]
  const y1 = values[index]
  const y2 = values[index + 1]
  const denom = 2 * (y0 - 2 * y1 + y2)
  if (Math.abs(denom) < 1e-12) return [index, y1]
  const shift = (y0 - y2) / denom
  if (!Number.isFinite(shift) || Math.abs(shift) > 1) return [index, y1]
  const y = y1 - 0.25 * (y0 - y2) * shift
  return [index + shift, Number.isFinite(y) ? y : y1]
}

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

function fftRadix2(re: Float32Array, im: Float32Array, n: number, inverse: boolean): void {
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len
    const wlenRe = Math.cos(ang)
    const wlenIm = Math.sin(ang)
    const half = len >> 1
    for (let i = 0; i < n; i += len) {
      let wRe = 1
      let wIm = 0
      for (let j = 0; j < half; j += 1) {
        const i0 = i + j
        const i1 = i0 + half
        const vRe = re[i1] * wRe - im[i1] * wIm
        const vIm = re[i1] * wIm + im[i1] * wRe
        re[i1] = re[i0] - vRe
        im[i1] = im[i0] - vIm
        re[i0] += vRe
        im[i0] += vIm
        const nWRe = wRe * wlenRe - wIm * wlenIm
        wIm = wRe * wlenIm + wIm * wlenRe
        wRe = nWRe
      }
    }
  }
  if (inverse) {
    const inv = 1 / n
    for (let i = 0; i < n; i += 1) {
      re[i] *= inv
      im[i] *= inv
    }
  }
}

function fillDifference(
  buffer: ArrayLike<number>,
  tauMax: number,
  scratch: PitchScratch,
): number {
  const n = buffer.length
  const fftSize = Math.min(FFT_MAX, nextPow2(Math.max(32, n * 2)))
  const re = scratch.re
  const im = scratch.im
  const mag = scratch.mag
  for (let i = 0; i < fftSize; i += 1) {
    re[i] = i < n ? buffer[i] : 0
    im[i] = 0
  }
  fftRadix2(re, im, fftSize, false)
  const bins = fftSize
  for (let i = 0; i < bins; i += 1) {
    const p = re[i] * re[i] + im[i] * im[i]
    mag[i] = Math.sqrt(p)
    re[i] = p
    im[i] = 0
  }
  fftRadix2(re, im, fftSize, true)

  const energy = scratch.nsdf
  energy[0] = 0
  for (let i = 0; i < n; i += 1) {
    const x = buffer[i]
    energy[i + 1] = energy[i] + x * x
  }
  const diff = scratch.diff
  diff[0] = 0
  const eN = energy[n]
  for (let tau = 1; tau <= tauMax; tau += 1) {
    const sq1 = energy[n - tau]
    const sq2 = eN - energy[tau]
    const ac = re[tau]
    const d = sq1 + sq2 - 2 * ac
    diff[tau] = d > 0 ? d : 0
  }
  return fftSize
}

function yinThreshold(minHz: number): number {
  if (minHz < 36) return YIN_THRESHOLD_BASS
  if (minHz > 400) return YIN_THRESHOLD_HIGH
  return YIN_THRESHOLD
}

function collectMinima(
  cmnd: Float32Array,
  tauMin: number,
  tauMax: number,
  sampleRate: number,
  minHz: number,
  maxHz: number,
): PitchEstimate[] {
  const out: PitchEstimate[] = []
  const last = Math.min(tauMax, cmnd.length - 2)
  const start = Math.max(2, tauMin)
  for (let tau = start; tau <= last; tau += 1) {
    const y = cmnd[tau]
    if (y >= CANDIDATE_CMND) continue
    if (y > cmnd[tau - 1] || y > cmnd[tau + 1]) continue
    const [t, v] = parabolicExtremum(cmnd, tau)
    if (t <= tauMin + 0.4 || t >= tauMax - 0.4) continue
    const frequency = sampleRate / t
    if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) continue
    const clarity = Math.max(0, Math.min(1, 1 - Math.min(1, typeof v === 'number' ? v : y)))
    out.push({ frequency, clarity })
  }
  return out
}

export function hpsFrequency(
  scratch: PitchScratch,
  fftSize: number,
  sampleRate: number,
  minHz: number,
  maxHz: number,
): number {
  const mag = scratch.mag
  const nBins = fftSize >> 1
  const bMin = Math.max(2, Math.floor((minHz * fftSize) / sampleRate))
  const bMax = Math.min(nBins - 2, Math.floor((maxHz * fftSize) / sampleRate))
  if (bMax <= bMin + 2) return 0
  const harmonics = 4
  let best = -1
  let bestK = 0
  for (let k = bMin; k <= bMax; k += 1) {
    let p = mag[k]
    let ok = true
    for (let h = 2; h <= harmonics; h += 1) {
      const kh = k * h
      if (kh >= nBins) {
        ok = false
        break
      }
      p *= mag[kh]
    }
    if (ok && p > best) {
      best = p
      bestK = k
    }
  }
  if (bestK < 2 || best <= 0) return 0
  const y0 = mag[bestK - 1]
  const y1 = mag[bestK]
  const y2 = mag[bestK + 1]
  const denom = 2 * (y0 - 2 * y1 + y2)
  let k = bestK
  if (Math.abs(denom) > 1e-12) {
    const shift = (y0 - y2) / denom
    if (Number.isFinite(shift) && Math.abs(shift) <= 1) k = bestK + shift
  }
  const hz = (sampleRate * k) / fftSize
  return Number.isFinite(hz) && hz >= minHz && hz <= maxHz ? hz : 0
}

export function yinPitch(
  buffer: ArrayLike<number>,
  sampleRate: number,
  scratch: PitchScratch,
  minHz = MIN_HZ,
  maxHz = MAX_HZ,
  threshold = YIN_THRESHOLD,
): PitchEstimate {
  return fastYin(buffer, sampleRate, scratch, minHz, maxHz, threshold)
}

export function fastYin(
  buffer: ArrayLike<number>,
  sampleRate: number,
  scratch: PitchScratch,
  minHz = MIN_HZ,
  maxHz = MAX_HZ,
  threshold = YIN_THRESHOLD,
): YinResult {
  const empty: YinResult = { frequency: 0, clarity: 0, candidates: [], fftSize: 0 }
  const n = buffer.length
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz))
  const tauMax = Math.min(scratch.diff.length - 1, Math.floor(sampleRate / minHz), Math.floor(n / 2) - 1)
  if (tauMax <= tauMin + 2) return empty

  const fftSize = fillDifference(buffer, tauMax, scratch)
  const cmnd = scratch.cmnd
  const diff = scratch.diff
  cmnd[0] = 1
  let running = 0
  for (let tau = 1; tau <= tauMax; tau += 1) {
    running += diff[tau]
    cmnd[tau] = running > 0 ? (diff[tau] * tau) / running : 1
  }

  const candidates = collectMinima(cmnd, tauMin, tauMax, sampleRate, minHz, maxHz)

  let tauEstimate = 0
  for (let tau = tauMin; tau < tauMax; tau += 1) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau += 1
      tauEstimate = tau
      break
    }
  }
  if (tauEstimate === 0) {
    let bestI = 0
    let best = 1
    for (let tau = tauMin; tau <= tauMax; tau += 1) {
      if (cmnd[tau] < best) {
        best = cmnd[tau]
        bestI = tau
      }
    }
    if (best < 0.42) tauEstimate = bestI
  }
  if (tauEstimate === 0) return { ...empty, candidates, fftSize }

  const [tau, yinVal] = parabolicExtremum(cmnd, tauEstimate)
  if (tau <= tauMin + 0.4 || tau >= tauMax - 0.4) {
    return { frequency: 0, clarity: 0, candidates, fftSize }
  }
  const frequency = sampleRate / tau
  const raw = typeof yinVal === 'number' ? yinVal : cmnd[tauEstimate]
  const clarity = Math.max(0, Math.min(1, 1 - Math.min(1, Math.max(raw, cmnd[tauEstimate]))))
  if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) {
    return { frequency: 0, clarity: 0, candidates, fftSize }
  }
  return { frequency, clarity, candidates, fftSize }
}

/** @deprecated Standalone NSDF is no longer the live tracker; FastYIN is. */
export function mpmPitch(
  buffer: ArrayLike<number>,
  sampleRate: number,
  scratch: PitchScratch,
  minHz = MIN_HZ,
  maxHz = MAX_HZ,
): PitchEstimate {
  return yinPitch(buffer, sampleRate, scratch, minHz, maxHz)
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

export function harmonicStrength(
  buffer: ArrayLike<number>,
  sampleRate: number,
  hz: number,
): number {
  if (hz <= 0) return 0
  const weights = [1, 0.7, 0.5, 0.32, 0.18]
  let score = 0
  for (let h = 1; h <= weights.length; h += 1) {
    const f = hz * h
    if (f > sampleRate * 0.45) break
    score += weights[h - 1] * magAt(buffer, sampleRate, f)
  }
  return score
}

function isOctaveRatio(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false
  const r = a > b ? a / b : b / a
  return r > 1.87 && r < 2.14
}

function isThirdHarmonic(higher: number, lower: number): boolean {
  const r = higher / lower
  return r > 2.82 && r < 3.22
}

/**
 * Fold a 2nd/3rd-harmonic lock back to the fundamental when odd partials
 * of the lower octave are present (missing-fundamental bass).
 */
export function maybeLowerOctave(
  buffer: ArrayLike<number>,
  sampleRate: number,
  estimate: PitchEstimate,
  minHz = MIN_HZ,
): PitchEstimate {
  if (estimate.frequency <= 0 || estimate.frequency > 260) return estimate
  let f = estimate.frequency
  for (const div of [2, 3]) {
    const lower = f / div
    if (lower < minHz) continue
    if (canFoldTo(buffer, sampleRate, lower, f)) {
      f = lower
      break
    }
  }
  if (f === estimate.frequency) return estimate
  return { frequency: f, clarity: estimate.clarity }
}

function canFoldTo(
  buffer: ArrayLike<number>,
  sampleRate: number,
  lower: number,
  current: number,
): boolean {
  if (lower < MIN_HZ || current <= 0) return false
  const magC = magAt(buffer, sampleRate, current)
  if (magC < 1e-12) return false
  const ratio = current / lower
  if (ratio > 1.87 && ratio < 2.14) {
    // Octave: 3f of the lower note is 1.5× current — a real odd partial,
    // not leakage from 2× current.
    const f3 = lower * 3
    const mag3 = magAt(buffer, sampleRate, f3)
    const peaked =
      mag3 > magAt(buffer, sampleRate, f3 * 0.89) * 1.2 &&
      mag3 > magAt(buffer, sampleRate, f3 * 1.12) * 1.2
    const odd = mag3 + 0.55 * magAt(buffer, sampleRate, lower * 5)
    return peaked && odd > magC * 0.28
  }
  if (ratio > 2.82 && ratio < 3.22) {
    const magL = magAt(buffer, sampleRate, lower)
    const peak = Math.max(
      magC,
      magAt(buffer, sampleRate, current * 2),
      magAt(buffer, sampleRate, current * 3),
    )
    const even =
      magAt(buffer, sampleRate, lower * 2) + 0.65 * magAt(buffer, sampleRate, lower * 4)
    const peaked =
      magL > magAt(buffer, sampleRate, lower * 0.89) * 1.25 &&
      magL > magAt(buffer, sampleRate, lower * 1.12) * 1.25
    return peaked && magL > peak * 0.18 && even > peak * 0.2
  }
  return false
}

function pickAmong(
  yin: YinResult,
  hpsHz: number,
  buffer: ArrayLike<number>,
  sampleRate: number,
  minHz: number,
): PitchEstimate {
  if (yin.frequency <= 0) {
    const fallback = yin.candidates.find((c) => c.frequency >= minHz && c.clarity > 0.7)
    if (fallback) return fallback
    if (hpsHz >= minHz && hpsHz <= MAX_HZ) return { frequency: hpsHz, clarity: 0.7 }
    return { frequency: 0, clarity: 0 }
  }

  let frequency = yin.frequency
  if (hpsHz >= minHz && yin.frequency < 220) {
    const ratio = yin.frequency / hpsHz
    const div = ratio > 2.82 && ratio < 3.22 ? 3 : ratio > 1.87 && ratio < 2.14 ? 2 : 0
    if (div > 0) {
      const lower = yin.frequency / div
      if (lower >= minHz && canFoldTo(buffer, sampleRate, lower, yin.frequency)) {
        frequency = lower
      }
    }
  }

  if (frequency === yin.frequency && yin.frequency < 220) {
    for (const c of yin.candidates) {
      if (c.frequency < minHz || c.frequency >= yin.frequency * 0.72) continue
      if (!isOctaveRatio(yin.frequency, c.frequency) && !isThirdHarmonic(yin.frequency, c.frequency)) {
        continue
      }
      if (canFoldTo(buffer, sampleRate, c.frequency, yin.frequency)) {
        frequency = c.frequency
        break
      }
    }
  }

  return { frequency, clarity: yin.clarity }
}

function clarityFloor(hz: number): number {
  if (hz < 32) return MIN_CLARITY_SUB
  if (hz < 55) return MIN_CLARITY_BASS
  return MIN_CLARITY
}

function pickEstimate(
  high: PitchEstimate,
  low: PitchEstimate,
  prevHz: number | null,
  buffer: ArrayLike<number>,
  sampleRate: number,
): PitchEstimate {
  let chosen = high
  if (high.frequency <= 0 && low.frequency > 0) return low
  if (low.frequency > 0 && low.clarity >= MIN_CLARITY_SUB) {
    if (chosen.frequency <= 0) return low
    if (
      low.frequency < chosen.frequency &&
      (isOctaveRatio(chosen.frequency, low.frequency) || isThirdHarmonic(chosen.frequency, low.frequency)) &&
      canFoldTo(buffer, sampleRate, low.frequency, chosen.frequency)
    ) {
      return { frequency: low.frequency, clarity: Math.max(low.clarity, chosen.clarity * 0.96) }
    }
    if (prevHz && prevHz < 85) {
      const lowErr = Math.abs(1200 * Math.log2(low.frequency / prevHz))
      const highErr = Math.abs(1200 * Math.log2(chosen.frequency / prevHz))
      if (lowErr + 10 < highErr) return low
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

function peakNormalize(
  buffer: ArrayLike<number>,
  dest: Float32Array,
): { view: Float32Array; rms: number } | null {
  const n = buffer.length
  if (n < MIN_WINDOW / 4 || dest.length < n) return null
  let peak = 0
  let sum = 0
  for (let i = 0; i < n; i += 1) {
    const x = buffer[i]
    sum += x * x
    const a = Math.abs(x)
    if (a > peak) peak = a
  }
  const rms = Math.sqrt(sum / n)
  if (peak < 1e-7 || rms < MIN_RMS) return null
  const scale = 1 / peak
  for (let i = 0; i < n; i += 1) dest[i] = buffer[i] * scale
  return { view: dest.subarray(0, n), rms }
}

function runYinHps(
  buffer: ArrayLike<number>,
  sampleRate: number,
  scratch: PitchScratch,
  minHz: number,
  maxHz: number,
): PitchEstimate {
  const yin = fastYin(buffer, sampleRate, scratch, minHz, maxHz, yinThreshold(minHz))
  const hpsHz = yin.fftSize
    ? hpsFrequency(scratch, yin.fftSize, sampleRate, minHz, Math.min(maxHz, 1400))
    : 0
  const picked = pickAmong(yin, hpsHz, buffer, sampleRate, minHz)
  return maybeLowerOctave(buffer, sampleRate, picked, minHz)
}

/**
 * FastYIN baseline + HPS/multi-candidate octave check.
 * Dual-path: full-rate adaptive window, plus a decimated long window for E0–E2.
 * Low-clarity frames are rejected — we do not guess, and we never snap to 0¢.
 */
export function estimatePitch(
  buffer: ArrayLike<number>,
  sampleRate: number,
  scratch: PitchScratch,
  prevHz: number | null = null,
): PitchEstimate {
  const energy = localRms(buffer)
  if (energy < MIN_RMS) return { frequency: 0, clarity: 0 }

  const win = Math.min(buffer.length, windowForHz(prevHz, sampleRate))
  const rawBuf = sliceTail(buffer, win)
  const norm = peakNormalize(rawBuf, scratch.window)
  if (!norm) return { frequency: 0, clarity: 0 }
  const buf = norm.view
  const minHz = Math.max(MIN_HZ, Math.min(HIGH_MIN_HZ, minHzForWindow(buf.length, sampleRate)))
  const high = runYinHps(buf, sampleRate, scratch, minHz, MAX_HZ)

  const wantLow =
    !prevHz ||
    prevHz < 100 ||
    high.frequency <= 0 ||
    high.frequency < 100 ||
    high.clarity < 0.9
  let low: PitchEstimate = { frequency: 0, clarity: 0 }
  if (wantLow) {
    const factor = lowDecimateFactor(sampleRate)
    const fullNeeded = LOW_DECIMATED_MAX * factor
    const lowSlice = sliceTail(buffer, Math.min(buffer.length, fullNeeded))
    if (lowSlice.length >= LOW_DECIMATED_MIN * factor) {
      const decimated = decimateAverage(lowSlice, factor, scratch.low)
      const keep = Math.min(decimated.length, LOW_DECIMATED_MAX)
      const lowBuf =
        keep === decimated.length ? decimated : decimated.subarray(decimated.length - keep)
      if (lowBuf.length >= LOW_DECIMATED_MIN) {
        const lowRate = sampleRate / factor
        const rawLow = fastYin(
          lowBuf,
          lowRate,
          scratch,
          MIN_HZ,
          LOW_MAX_HZ,
          YIN_THRESHOLD_BASS,
        )
        const hpsLow = rawLow.fftSize
          ? hpsFrequency(scratch, rawLow.fftSize, lowRate, MIN_HZ, LOW_MAX_HZ)
          : 0
        low = maybeLowerOctave(
          lowBuf,
          lowRate,
          pickAmong(rawLow, hpsLow, lowBuf, lowRate, MIN_HZ),
          MIN_HZ,
        )
      }
    }
  }

  const picked = maybeLowerOctave(
    buf,
    sampleRate,
    pickEstimate(high, low, prevHz, buf, sampleRate),
    MIN_HZ,
  )
  if (picked.frequency > 0 && picked.clarity < clarityFloor(picked.frequency)) {
    return { frequency: 0, clarity: picked.clarity }
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

export const estimatePitchAdaptive = estimatePitch
