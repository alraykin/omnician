/* McLeod Pitch Method in the AudioWorklet. Uses the context sampleRate. */
const MIN_HZ = 16
const MAX_HZ = 1500
const HIGH_MIN_HZ = 38
const LOW_MAX_HZ = 120
const MAX_WINDOW = 32768
const MIN_WINDOW = 2048
const HOP = 512
const LOW_DECIMATED_MIN = 3072
const LOW_DECIMATED_MAX = 4096
const CLARITY_K = 0.9
const MIN_CLARITY = 0.9
const MIN_CLARITY_BASS = 0.85
const MIN_CLARITY_SUB = 0.8
const MIN_RMS = 0.0024
const HP_HZ = 12
const LP_HZ = 1500

function lowDecimateFactor(rate) {
  if (rate >= 80000) return 8
  if (rate >= 40000) return 4
  return 2
}

function windowForHz(hz, rate) {
  const f = hz && hz > 0 ? hz : 55
  const periods = f < 28 ? 5.5 : f < 50 ? 4.5 : f < 90 ? 3.6 : f < 180 ? 2.8 : 2.4
  const needed = Math.ceil((rate / f) * periods)
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

function localRms(buffer, start, end) {
  let sum = 0
  const n = Math.max(1, end - start)
  for (let i = start; i < end; i += 1) sum += buffer[i] * buffer[i]
  return Math.sqrt(sum / n)
}

function parabolicPeak(values, index) {
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

function keyMaximumIndices(nsdf, tauMin, tauMax) {
  const keys = []
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

function fillNsdf(buffer, tauMax, nsdf) {
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

function maybeLowerOctave(buffer, rate, estimate, minHz) {
  if (estimate.frequency <= 0 || estimate.frequency > 120) return estimate
  let f = estimate.frequency
  for (const div of [2, 3]) {
    const lower = f / div
    if (lower < minHz) continue
    const pLow = goertzelPower(buffer, rate, lower)
    const pHigh = goertzelPower(buffer, rate, f)
    const pLo = goertzelPower(buffer, rate, lower * 0.89)
    const pHi = goertzelPower(buffer, rate, lower * 1.12)
    const pThird = goertzelPower(buffer, rate, lower * 3)
    const pOct = goertzelPower(buffer, rate, f * 2)
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

function mpmPitch(buffer, rate, scratch, minHz, maxHz) {
  const n = buffer.length
  const tauMin = Math.max(2, Math.floor(rate / maxHz))
  const tauMax = Math.min(scratch.nsdf.length - 1, Math.floor(rate / minHz), n - 2)
  if (tauMax <= tauMin + 2) return { frequency: 0, clarity: 0 }
  fillNsdf(buffer, tauMax, scratch.nsdf)
  const keys = keyMaximumIndices(scratch.nsdf, tauMin, tauMax)
  if (keys.length === 0) return { frequency: 0, clarity: 0 }
  let nMax = 0
  for (let i = 0; i < keys.length; i += 1) {
    if (scratch.nsdf[keys[i]] > nMax) nMax = scratch.nsdf[keys[i]]
  }
  if (nMax < MIN_CLARITY_SUB) return { frequency: 0, clarity: 0 }
  const cutoff = CLARITY_K * nMax
  let chosen = keys[0]
  for (let i = 0; i < keys.length; i += 1) {
    if (scratch.nsdf[keys[i]] >= cutoff) {
      chosen = keys[i]
      break
    }
  }
  const refined = parabolicPeak(scratch.nsdf, chosen)
  const frequency = rate / refined[0]
  const clarity = Math.max(0, Math.min(1, refined[1]))
  if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) {
    return { frequency: 0, clarity: 0 }
  }
  return { frequency, clarity }
}

function yinPitch(buffer, rate, scratch, minHz, maxHz) {
  const n = buffer.length
  const tauMin = Math.max(2, Math.floor(rate / maxHz))
  const tauMax = Math.min(scratch.diff.length - 1, Math.floor(rate / minHz), Math.floor(n / 2) - 1)
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
    if (cmnd[tau] < 0.12) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau += 1
      tauEstimate = tau
      break
    }
  }
  if (tauEstimate === 0) return { frequency: 0, clarity: 0 }
  const refined = parabolicPeak(cmnd, tauEstimate)
  const frequency = rate / refined[0]
  const clarity = Math.max(0, Math.min(1, 1 - cmnd[tauEstimate]))
  if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) {
    return { frequency: 0, clarity: 0 }
  }
  return { frequency, clarity }
}

function isOctaveRatio(a, b) {
  if (a <= 0 || b <= 0) return false
  const r = a > b ? a / b : b / a
  return r > 1.87 && r < 2.14
}

function isThirdHarmonic(higher, lower) {
  return higher / lower > 2.85 && higher / lower < 3.2
}

function clarityFloor(hz) {
  if (hz < 32) return MIN_CLARITY_SUB
  if (hz < 55) return MIN_CLARITY_BASS
  return MIN_CLARITY
}

function pickEstimate(high, yin, low, prevHz) {
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

function estimatePitch(buffer, rate, scratch, prevHz) {
  if (localRms(buffer, 0, buffer.length) < MIN_RMS) return { frequency: 0, clarity: 0 }
  const highWin = Math.min(buffer.length, windowForHz(prevHz && prevHz >= 70 ? prevHz : 110, rate))
  const highBuf = sliceTail(buffer, highWin)
  const high = maybeLowerOctave(buffer, rate, mpmPitch(highBuf, rate, scratch, HIGH_MIN_HZ, MAX_HZ), MIN_HZ)
  const yin =
    high.frequency > 0 ? yinPitch(highBuf, rate, scratch, HIGH_MIN_HZ, MAX_HZ) : { frequency: 0, clarity: 0 }
  const wantLow = (!prevHz || prevHz < 58) && (high.frequency <= 0 || high.frequency < 58)
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
        const rawLow = mpmPitch(lowBuf, rate / factor, scratch, MIN_HZ, LOW_MAX_HZ)
        low = maybeLowerOctave(lowBuf, rate / factor, rawLow, MIN_HZ)
      }
    }
  }
  return maybeLowerOctave(buffer, rate, pickEstimate(high, yin, low, prevHz), MIN_HZ)
}

function rbj(type, freq, q, rate) {
  const w0 = (2 * Math.PI * freq) / rate
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
      nsdf: new Float32Array(MAX_WINDOW),
      diff: new Float32Array(MAX_WINDOW),
      cmnd: new Float32Array(MAX_WINDOW),
      low: new Float32Array(LOW_DECIMATED_MAX + 8),
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
