/* FastYIN + HPS in the AudioWorklet. Keep in sync with src/lib/yin.ts. */
const MIN_HZ = 16
const MAX_HZ = 4800
const HIGH_MIN_HZ = 48
const LOW_MAX_HZ = 140
const MAX_WINDOW = 32768
const MIN_WINDOW = 2048
const HOP = 512
const LOW_DECIMATED_MIN = 2048
const LOW_DECIMATED_MAX = 4096
const FFT_MAX = 65536
const YIN_THRESHOLD = 0.12
const YIN_THRESHOLD_BASS = 0.15
const YIN_THRESHOLD_HIGH = 0.1
const CANDIDATE_CMND = 0.38
const MIN_CLARITY = 0.88
const MIN_CLARITY_BASS = 0.82
const MIN_CLARITY_SUB = 0.76
const MIN_RMS = 0.0022
const HP_HZ = 6
const LP_HZ = 8000

function lowDecimateFactor(rate) {
  if (rate >= 80000) return 8
  if (rate >= 40000) return 4
  return 2
}

function snapWindow(needed) {
  const caps = [2048, 3072, 4096, 6144, 8192, 12288, 16384, 24576, MAX_WINDOW]
  const n = Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, needed))
  for (let i = 0; i < caps.length; i += 1) {
    if (n <= caps[i]) return caps[i]
  }
  return MAX_WINDOW
}

function windowForHz(hz, rate) {
  const f = hz && hz > 0 ? hz : 28
  const periods = f < 28 ? 2.6 : f < 50 ? 2.8 : f < 90 ? 2.6 : f < 180 ? 2.4 : 2.2
  return snapWindow(Math.ceil((rate / f) * periods))
}

function minHzForWindow(n, rate) {
  if (n < 8) return MAX_HZ
  return Math.max(MIN_HZ, (2.05 * rate) / n)
}

function localRms(buffer, start, end) {
  let sum = 0
  const n = Math.max(1, end - start)
  for (let i = start; i < end; i += 1) sum += buffer[i] * buffer[i]
  return Math.sqrt(sum / n)
}

function parabolicExtremum(values, index) {
  if (index <= 0 || index >= values.length - 1) return [index, values[index] || 0]
  const y0 = values[index - 1]
  const y1 = values[index]
  const y2 = values[index + 1]
  const denom = 2 * (y0 - 2 * y1 + y2)
  if (Math.abs(denom) < 1e-12) return [index, y1]
  const shift = (y0 - y2) / denom
  if (!Number.isFinite(shift) || Math.abs(shift) > 1) return [index, y1]
  return [index + shift, y1 - 0.25 * (y0 - y2) * shift]
}

function nextPow2(n) {
  let p = 1
  while (p < n) p <<= 1
  return p
}

function fftRadix2(re, im, n, inverse) {
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

function fillDifference(buffer, tauMax, scratch) {
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
  for (let i = 0; i < fftSize; i += 1) {
    const p = re[i] * re[i] + im[i] * im[i]
    mag[i] = Math.sqrt(p)
    re[i] = p
    im[i] = 0
  }
  fftRadix2(re, im, fftSize, true)
  const energy = scratch.nsdf
  energy[0] = 0
  for (let i = 0; i < n; i += 1) energy[i + 1] = energy[i] + buffer[i] * buffer[i]
  const diff = scratch.diff
  diff[0] = 0
  const eN = energy[n]
  for (let tau = 1; tau <= tauMax; tau += 1) {
    const d = energy[n - tau] + (eN - energy[tau]) - 2 * re[tau]
    diff[tau] = d > 0 ? d : 0
  }
  return fftSize
}

function yinThreshold(minHz) {
  if (minHz < 36) return YIN_THRESHOLD_BASS
  if (minHz > 400) return YIN_THRESHOLD_HIGH
  return YIN_THRESHOLD
}

function collectMinima(cmnd, tauMin, tauMax, rate, minHz, maxHz) {
  const out = []
  const last = Math.min(tauMax, cmnd.length - 2)
  const start = Math.max(2, tauMin)
  for (let tau = start; tau <= last; tau += 1) {
    const y = cmnd[tau]
    if (y >= CANDIDATE_CMND) continue
    if (y > cmnd[tau - 1] || y > cmnd[tau + 1]) continue
    const refined = parabolicExtremum(cmnd, tau)
    const t = refined[0]
    if (t <= tauMin + 0.4 || t >= tauMax - 0.4) continue
    const frequency = rate / t
    if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) continue
    out.push({ frequency, clarity: Math.max(0, Math.min(1, 1 - Math.min(1, refined[1]))) })
  }
  return out
}

function hpsFrequency(scratch, fftSize, rate, minHz, maxHz) {
  const mag = scratch.mag
  const nBins = fftSize >> 1
  const bMin = Math.max(2, Math.floor((minHz * fftSize) / rate))
  const bMax = Math.min(nBins - 2, Math.floor((maxHz * fftSize) / rate))
  if (bMax <= bMin + 2) return 0
  let best = -1
  let bestK = 0
  for (let k = bMin; k <= bMax; k += 1) {
    let p = mag[k]
    let ok = true
    for (let h = 2; h <= 4; h += 1) {
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
  const hz = (rate * k) / fftSize
  return Number.isFinite(hz) && hz >= minHz && hz <= maxHz ? hz : 0
}

function fastYin(buffer, rate, scratch, minHz, maxHz, threshold) {
  const empty = { frequency: 0, clarity: 0, candidates: [], fftSize: 0 }
  const n = buffer.length
  const tauMin = Math.max(2, Math.floor(rate / maxHz))
  const tauMax = Math.min(scratch.diff.length - 1, Math.floor(rate / minHz), Math.floor(n / 2) - 1)
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
  const candidates = collectMinima(cmnd, tauMin, tauMax, rate, minHz, maxHz)
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
  if (tauEstimate === 0) return { frequency: 0, clarity: 0, candidates, fftSize }
  const refined = parabolicExtremum(cmnd, tauEstimate)
  const tau = refined[0]
  if (tau <= tauMin + 0.4 || tau >= tauMax - 0.4) {
    return { frequency: 0, clarity: 0, candidates, fftSize }
  }
  const frequency = rate / tau
  const clarity = Math.max(0, Math.min(1, 1 - Math.min(1, Math.max(refined[1], cmnd[tauEstimate]))))
  if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) {
    return { frequency: 0, clarity: 0, candidates, fftSize }
  }
  return { frequency: refineTau(buffer, tau, rate, minHz, maxHz), clarity, candidates, fftSize }
}

function refineTau(buffer, tau0, rate, minHz, maxHz) {
  const n = buffer.length
  const maxTau = n - 3
  if (tau0 < 2 || tau0 > maxTau) return rate / tau0
  const span = Math.min(0.75, tau0 * (8 / 1200) * Math.LN2 * 1.1)
  let lo = Math.max(2, tau0 - span)
  let hi = Math.min(maxTau, tau0 + span)
  const diffAt = (tau) => {
    const iTau = Math.floor(tau)
    const frac = tau - iTau
    const lim = n - iTau - 1
    if (lim < 8) return Infinity
    let sum = 0
    for (let j = 0; j < lim; j += 1) {
      const b = buffer[j + iTau] * (1 - frac) + buffer[j + iTau + 1] * frac
      const d = buffer[j] - b
      sum += d * d
    }
    return sum
  }
  for (let i = 0; i < 16; i += 1) {
    const m1 = lo + (hi - lo) * 0.382
    const m2 = lo + (hi - lo) * 0.618
    if (diffAt(m1) < diffAt(m2)) hi = m2
    else lo = m1
  }
  const tau = (lo + hi) / 2
  const hz = rate / tau
  if (!Number.isFinite(hz) || hz < minHz || hz > maxHz) return rate / tau0
  if (Math.abs(1200 * Math.log2(hz / (rate / tau0))) > 12) return rate / tau0
  return hz
}

function goertzelPower(buffer, rate, hz) {
  const n = buffer.length
  if (n < 8 || hz <= 0) return 0
  const k = (n * hz) / rate
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

function magAt(buffer, rate, hz) {
  return Math.sqrt(Math.max(0, goertzelPower(buffer, rate, hz)))
}

function isOctaveRatio(a, b) {
  if (a <= 0 || b <= 0) return false
  const r = a > b ? a / b : b / a
  return r > 1.87 && r < 2.14
}

function isThirdHarmonic(higher, lower) {
  return higher / lower > 2.82 && higher / lower < 3.22
}

function maybeLowerOctave(buffer, rate, estimate, minHz) {
  if (estimate.frequency <= 0 || estimate.frequency > 260) return estimate
  let f = estimate.frequency
  for (const div of [2, 3]) {
    const lower = f / div
    if (lower < minHz) continue
    if (canFoldTo(buffer, rate, lower, f)) {
      f = lower
      break
    }
  }
  if (f === estimate.frequency) return estimate
  return { frequency: f, clarity: estimate.clarity }
}

function canFoldTo(buffer, rate, lower, current) {
  if (lower < MIN_HZ || current <= 0) return false
  const magC = magAt(buffer, rate, current)
  if (magC < 1e-12) return false
  const ratio = current / lower
  if (ratio > 1.87 && ratio < 2.14) {
    const f3 = lower * 3
    const mag3 = magAt(buffer, rate, f3)
    const peaked =
      mag3 > magAt(buffer, rate, f3 * 0.89) * 1.2 &&
      mag3 > magAt(buffer, rate, f3 * 1.12) * 1.2 &&
      mag3 > magAt(buffer, rate, current * 1.25) * 1.12 &&
      mag3 > magAt(buffer, rate, current * 1.75) * 1.12
    const odd = mag3 + 0.55 * magAt(buffer, rate, lower * 5)
    const mag2c = magAt(buffer, rate, current * 2)
    return peaked && odd > magC * 0.28 && mag3 > mag2c * 0.2
  }
  if (ratio > 2.82 && ratio < 3.22) {
    const magL = magAt(buffer, rate, lower)
    const peak = Math.max(magC, magAt(buffer, rate, current * 2), magAt(buffer, rate, current * 3))
    const even = magAt(buffer, rate, lower * 2) + 0.65 * magAt(buffer, rate, lower * 4)
    const peaked =
      magL > magAt(buffer, rate, lower * 0.89) * 1.25 && magL > magAt(buffer, rate, lower * 1.12) * 1.25
    return peaked && magL > peak * 0.18 && even > peak * 0.2
  }
  return false
}

function pickAmong(yin, hpsHz, buffer, rate, minHz) {
  if (yin.frequency <= 0) {
    for (let i = 0; i < yin.candidates.length; i += 1) {
      const c = yin.candidates[i]
      if (c.frequency >= minHz && c.clarity > 0.7) return c
    }
    if (hpsHz >= minHz && hpsHz <= MAX_HZ) return { frequency: hpsHz, clarity: 0.7 }
    return { frequency: 0, clarity: 0 }
  }
  let frequency = yin.frequency
  if (hpsHz >= minHz && yin.frequency < 220) {
    const ratio = yin.frequency / hpsHz
    const div = ratio > 2.82 && ratio < 3.22 ? 3 : ratio > 1.87 && ratio < 2.14 ? 2 : 0
    if (div > 0) {
      const lower = yin.frequency / div
      if (lower >= minHz && canFoldTo(buffer, rate, lower, yin.frequency)) frequency = lower
    }
  }
  if (frequency === yin.frequency && yin.frequency < 220) {
    for (let i = 0; i < yin.candidates.length; i += 1) {
      const c = yin.candidates[i]
      if (c.frequency < minHz || c.frequency >= yin.frequency * 0.72) continue
      if (!isOctaveRatio(yin.frequency, c.frequency) && !isThirdHarmonic(yin.frequency, c.frequency)) continue
      if (canFoldTo(buffer, rate, c.frequency, yin.frequency)) {
        frequency = c.frequency
        break
      }
    }
  }
  return { frequency, clarity: yin.clarity }
}

function clarityFloor(hz) {
  if (hz < 32) return MIN_CLARITY_SUB
  if (hz < 55) return MIN_CLARITY_BASS
  return MIN_CLARITY
}

function pickEstimate(high, low, prevHz, buffer, rate) {
  let chosen = high
  if (high.frequency <= 0 && low.frequency > 0) return low
  if (low.frequency > 0 && low.clarity >= MIN_CLARITY_SUB) {
    if (chosen.frequency <= 0) return low
    if (
      low.frequency < chosen.frequency &&
      (isOctaveRatio(chosen.frequency, low.frequency) || isThirdHarmonic(chosen.frequency, low.frequency)) &&
      canFoldTo(buffer, rate, low.frequency, chosen.frequency)
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

function sliceTail(buffer, take) {
  const n = buffer.length
  const count = Math.min(n, take)
  if (count === n) return buffer
  return buffer.subarray(n - count, n)
}

function decimateAverage(buffer, factor, out) {
  const n = Math.floor(buffer.length / factor)
  for (let i = 0; i < n; i += 1) {
    let s = 0
    const base = i * factor
    for (let k = 0; k < factor; k += 1) s += buffer[base + k]
    out[i] = s / factor
  }
  return out.subarray(0, n)
}

function peakNormalize(buffer, dest) {
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
  return dest.subarray(0, n)
}

function runYinHps(buffer, rate, scratch, minHz, maxHz) {
  const yin = fastYin(buffer, rate, scratch, minHz, maxHz, yinThreshold(minHz))
  const hpsHz = yin.fftSize ? hpsFrequency(scratch, yin.fftSize, rate, minHz, Math.min(maxHz, 1400)) : 0
  const picked = pickAmong(yin, hpsHz, buffer, rate, minHz)
  return maybeLowerOctave(buffer, rate, picked, minHz)
}

function estimatePitch(buffer, rate, scratch, prevHz) {
  if (localRms(buffer, 0, buffer.length) < MIN_RMS) return { frequency: 0, clarity: 0 }
  const win = Math.min(buffer.length, windowForHz(prevHz, rate))
  const rawBuf = sliceTail(buffer, win)
  const buf = peakNormalize(rawBuf, scratch.window)
  if (!buf) return { frequency: 0, clarity: 0 }
  const minHz = Math.max(MIN_HZ, Math.min(HIGH_MIN_HZ, minHzForWindow(buf.length, rate)))
  const high = runYinHps(buf, rate, scratch, minHz, MAX_HZ)
  const wantLow = !prevHz || prevHz < 100 || high.frequency <= 0 || high.frequency < 100 || high.clarity < 0.9
  let low = { frequency: 0, clarity: 0 }
  if (wantLow) {
    const factor = lowDecimateFactor(rate)
    const fullNeeded = LOW_DECIMATED_MAX * factor
    const lowSlice = sliceTail(buffer, Math.min(buffer.length, fullNeeded))
    if (lowSlice.length >= LOW_DECIMATED_MIN * factor) {
      const decimated = decimateAverage(lowSlice, factor, scratch.low)
      const keep = Math.min(decimated.length, LOW_DECIMATED_MAX)
      const lowBuf = keep === decimated.length ? decimated : decimated.subarray(decimated.length - keep)
      if (lowBuf.length >= LOW_DECIMATED_MIN) {
        const lowRate = rate / factor
        const rawLow = fastYin(lowBuf, lowRate, scratch, MIN_HZ, LOW_MAX_HZ, YIN_THRESHOLD_BASS)
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
  const picked = pickEstimate(high, low, prevHz, buf, rate)
  if (picked.frequency > 0 && picked.clarity < clarityFloor(picked.frequency)) {
    return { frequency: 0, clarity: picked.clarity }
  }
  return picked
}

function rbj(type, freq, q, rate) {
  const nyquist = rate * 0.45
  const clamped = Math.max(MIN_HZ * 0.25, Math.min(freq, nyquist))
  const w0 = (2 * Math.PI * clamped) / rate
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  const alpha = sin / (2 * q)
  const a0 = 1 + alpha
  const a1 = -2 * cos
  const a2 = 1 - alpha
  let b0
  let b1
  let b2
  if (type === 'highpass') {
    b0 = (1 + cos) / 2
    b1 = -(1 + cos)
    b2 = (1 + cos) / 2
  } else {
    b0 = (1 - cos) / 2
    b1 = 1 - cos
    b2 = (1 - cos) / 2
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 }
}

function tickBiquad(f, x) {
  const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2
  f.x2 = f.x1
  f.x1 = x
  f.y2 = f.y1
  f.y1 = y
  return y
}

function pickMono(channels, index, mode) {
  if (!channels || channels.length === 0) return 0
  if (channels.length === 1 || !channels[1]) return channels[0][index] || 0
  const a = channels[0][index] || 0
  const b = channels[1][index] || 0
  if (mode === 0) return a
  if (mode === 1) return b
  return (a + b) * 0.5
}

class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.ring = new Float32Array(MAX_WINDOW)
    this.view = new Float32Array(MAX_WINDOW)
    this.scratch = {
      nsdf: new Float32Array(MAX_WINDOW + 8),
      diff: new Float32Array(MAX_WINDOW),
      cmnd: new Float32Array(MAX_WINDOW),
      low: new Float32Array(LOW_DECIMATED_MAX + 8),
      re: new Float32Array(FFT_MAX),
      im: new Float32Array(FFT_MAX),
      mag: new Float32Array(FFT_MAX),
      window: new Float32Array(MAX_WINDOW),
    }
    this.write = 0
    this.filled = 0
    this.hop = 0
    this.prevHz = null
    this.dcX = 0
    this.dcY = 0
    this.hp = rbj('highpass', HP_HZ, 0.7071, sampleRate)
    this.lp = rbj('lowpass', LP_HZ, 0.7071, sampleRate)
    this.chMode = 0
    this.chHop = 0
    this.chRms0 = 0
    this.chRms1 = 0
    this.channelCount = 1
  }

  chooseChannel(channels) {
    if (!channels || channels.length < 2 || !channels[1]) {
      this.chMode = 0
      this.channelCount = channels && channels[0] ? 1 : 0
      return
    }
    this.channelCount = 2
    let e0 = 0
    let e1 = 0
    const n = channels[0].length
    for (let i = 0; i < n; i += 1) {
      const a = channels[0][i]
      const b = channels[1][i]
      e0 += a * a
      e1 += b * b
    }
    this.chRms0 = Math.sqrt(e0 / n)
    this.chRms1 = Math.sqrt(e1 / n)
    const loud = Math.max(this.chRms0, this.chRms1)
    const quiet = Math.min(this.chRms0, this.chRms1)
    if (loud < 1e-5) {
      this.chMode = 0
      return
    }
    if (this.chRms0 > this.chRms1 * 4) this.chMode = 0
    else if (this.chRms1 > this.chRms0 * 4) this.chMode = 1
    else if (quiet > loud * 0.35) this.chMode = 2
    else this.chMode = this.chRms0 >= this.chRms1 ? 0 : 1
  }

  process(inputs) {
    const channels = inputs[0]
    if (!channels || channels.length === 0 || !channels[0] || channels[0].length === 0) return true
    this.chooseChannel(channels)
    const n = channels[0].length
    for (let i = 0; i < n; i += 1) {
      const raw = pickMono(channels, i, this.chMode)
      const dc = raw - this.dcX + 0.995 * this.dcY
      this.dcX = raw
      this.dcY = dc
      const filtered = tickBiquad(this.lp, tickBiquad(this.hp, dc))
      this.ring[this.write] = filtered
      this.write = (this.write + 1) % MAX_WINDOW
      if (this.filled < MAX_WINDOW) this.filled += 1
      this.hop += 1
      if (this.hop >= HOP && this.filled >= MIN_WINDOW) {
        this.hop = 0
        this.emit()
      }
    }
    return true
  }

  emit() {
    const window = Math.min(this.filled, MAX_WINDOW)
    let src = this.write - window
    if (src < 0) src += MAX_WINDOW
    for (let i = 0; i < window; i += 1) this.view[i] = this.ring[(src + i) % MAX_WINDOW]
    const view = this.view.subarray(0, window)
    const rms = localRms(view, Math.max(0, window - 512), window)
    const estimate = estimatePitch(view, sampleRate, this.scratch, this.prevHz)
    if (estimate.frequency > 0) this.prevHz = estimate.frequency
    else if (rms < MIN_RMS) this.prevHz = null
    this.port.postMessage({
      type: 'estimate',
      hz: estimate.frequency,
      clarity: estimate.clarity,
      rms,
      time: currentTime,
      sampleRate,
      channelCount: this.channelCount,
      channelMode: this.chMode,
    })
  }
}

registerProcessor('omnician-pitch', PitchProcessor)
