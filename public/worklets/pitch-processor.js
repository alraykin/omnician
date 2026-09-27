/* Self-contained AudioWorklet: MPM + YIN. Uses the context sampleRate. */
const MIN_HZ = 30
const MAX_HZ = 1400
const MAX_WINDOW = 8192
const MIN_WINDOW = 2048

function createScratch(maxWindow) {
  return {
    nsdf: new Float32Array(maxWindow),
    diff: new Float32Array(maxWindow),
    cmnd: new Float32Array(maxWindow),
  }
}

function windowForHz(hz, sampleRate) {
  const f = hz && hz > 0 ? hz : 70
  const periods = f < 90 ? 4 : f < 180 ? 3.2 : 2.6
  const needed = Math.ceil((sampleRate / f) * periods)
  const capped = Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, needed))
  if (capped <= 2048) return 2048
  if (capped <= 3072) return 3072
  if (capped <= 4096) return 4096
  if (capped <= 6144) return 6144
  return MAX_WINDOW
}

function parabolicTau(values, tau) {
  if (tau <= 0 || tau >= values.length - 1) return tau
  const s0 = values[tau - 1]
  const s1 = values[tau]
  const s2 = values[tau + 1]
  const denom = 2 * (s0 - 2 * s1 + s2)
  if (Math.abs(denom) < 1e-12) return tau
  const shift = (s0 - s2) / denom
  if (!Number.isFinite(shift) || Math.abs(shift) > 1) return tau
  return tau + shift
}

function localRms(buffer, start, end) {
  let sum = 0
  const n = Math.max(1, end - start)
  for (let i = start; i < end; i += 1) sum += buffer[i] * buffer[i]
  return Math.sqrt(sum / n)
}

function nearer(hz, target) {
  return Math.abs(Math.log2(hz / target))
}

function mpmPitch(buffer, sampleRate, scratch) {
  const n = buffer.length
  const tauMin = Math.max(2, Math.floor(sampleRate / MAX_HZ))
  const tauMax = Math.min(scratch.nsdf.length - 1, Math.floor(sampleRate / MIN_HZ), n - 2)
  if (tauMax <= tauMin + 2) return { frequency: 0, clarity: 0 }
  const nsdf = scratch.nsdf
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
  let maxPeak = 0
  const peaks = []
  for (let tau = tauMin + 1; tau < tauMax; tau += 1) {
    const y = nsdf[tau]
    if (y > nsdf[tau - 1] && y >= nsdf[tau + 1] && y > 0.25) {
      peaks.push(tau)
      if (y > maxPeak) maxPeak = y
    }
  }
  if (peaks.length === 0 || maxPeak < 0.28) return { frequency: 0, clarity: 0 }
  const cutoff = Math.max(0.82 * maxPeak, 0.72)
  let chosen = peaks[0]
  for (const tau of peaks) {
    if (nsdf[tau] >= cutoff) {
      chosen = tau
      break
    }
  }
  const tau = parabolicTau(nsdf, chosen)
  const frequency = sampleRate / tau
  const clarity = Math.max(0, Math.min(1, nsdf[chosen]))
  if (!Number.isFinite(frequency) || frequency < MIN_HZ || frequency > MAX_HZ) {
    return { frequency: 0, clarity: 0 }
  }
  return { frequency, clarity }
}

function yinPitch(buffer, sampleRate, scratch) {
  const n = buffer.length
  const tauMin = Math.max(2, Math.floor(sampleRate / MAX_HZ))
  const tauMax = Math.min(scratch.diff.length - 1, Math.floor(sampleRate / MIN_HZ), Math.floor(n / 2) - 1)
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
    if (cmnd[tau] < 0.13) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau += 1
      tauEstimate = tau
      break
    }
  }
  if (tauEstimate === 0) {
    let best = tauMin
    for (let tau = tauMin + 1; tau <= tauMax; tau += 1) {
      if (cmnd[tau] < cmnd[best]) best = tau
    }
    if (cmnd[best] > 0.35) return { frequency: 0, clarity: 0 }
    tauEstimate = best
  }
  const tau = parabolicTau(cmnd, tauEstimate)
  const frequency = sampleRate / tau
  const clarity = Math.max(0, Math.min(1, 1 - cmnd[tauEstimate]))
  if (!Number.isFinite(frequency) || frequency < MIN_HZ || frequency > MAX_HZ) {
    return { frequency: 0, clarity: 0 }
  }
  return { frequency, clarity }
}

function preferFundamental(left, right) {
  if (left.frequency <= 0) return right
  if (right.frequency <= 0) return left
  const pair = left.clarity >= right.clarity ? [left, right] : [right, left]
  const best = pair[0]
  const other = pair[1]
  const ratio = best.frequency / other.frequency
  if (other.clarity >= 0.5 && ratio > 1.87 && ratio < 2.14) return other
  if (other.clarity >= 0.5 && ratio > 0.47 && ratio < 0.535) return best
  if (other.clarity >= 0.58 && ratio > 2.85 && ratio < 3.2 && other.frequency < 220) return other
  if (best.clarity < 0.55 && other.clarity > best.clarity) return other
  return best
}

function estimatePitchAdaptive(buffer, sampleRate, scratch, prevHz) {
  if (localRms(buffer, 0, buffer.length) < 0.001) return { frequency: 0, clarity: 0 }
  const mpm = mpmPitch(buffer, sampleRate, scratch)
  const yin = yinPitch(buffer, sampleRate, scratch)
  let pick = preferFundamental(mpm, yin)
  if (prevHz && pick.frequency > 0) {
    let hz = pick.frequency
    while (hz > prevHz * Math.SQRT2 && hz / 2 >= MIN_HZ) hz /= 2
    while (hz < prevHz / Math.SQRT2 && hz * 2 <= MAX_HZ) hz *= 2
    if (nearer(hz, prevHz) + 0.02 < nearer(pick.frequency, prevHz)) {
      pick = { frequency: hz, clarity: pick.clarity * 0.97 }
    }
  }
  return pick
}

function estimateFromFilled(buffer, filled, sampleRate, scratch, prevHz) {
  const take = (window) =>
    estimatePitchAdaptive(buffer.subarray(filled - window, filled), sampleRate, scratch, prevHz)
  if (prevHz) {
    const window = Math.min(filled, windowForHz(prevHz, sampleRate))
    if (window < MIN_WINDOW) return { frequency: 0, clarity: 0 }
    return take(window)
  }
  const first = Math.min(filled, windowForHz(90, sampleRate))
  if (first < MIN_WINDOW) return { frequency: 0, clarity: 0 }
  const quick = take(first)
  if (quick.frequency >= 82 && quick.clarity >= 0.74) return quick
  const full = Math.min(filled, windowForHz(55, sampleRate))
  if (full <= first) return quick
  return take(full)
}

function mixFrame(channels, index) {
  let sum = 0
  let live = 0
  for (let c = 0; c < channels.length; c += 1) {
    const channel = channels[c]
    if (!channel) continue
    const sample = channel[index]
    if (sample !== 0) live += 1
    sum += sample
  }
  if (live <= 1) return sum
  return sum / channels.length
}

class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.ring = new Float32Array(MAX_WINDOW)
    this.scratch = createScratch(MAX_WINDOW)
    this.view = new Float32Array(MAX_WINDOW)
    this.write = 0
    this.filled = 0
    this.hop = 0
    this.hopSize = Math.max(256, Math.round(sampleRate / 188))
    this.prevHz = null
  }

  process(inputs) {
    const channels = inputs[0]
    if (!channels || channels.length === 0) return true
    const lead = channels[0]
    if (!lead || lead.length === 0) return true
    for (let i = 0; i < lead.length; i += 1) {
      this.ring[this.write] = mixFrame(channels, i)
      this.write = (this.write + 1) % MAX_WINDOW
      if (this.filled < MAX_WINDOW) this.filled += 1
      this.hop += 1
      if (this.hop >= this.hopSize && this.filled >= MIN_WINDOW) {
        this.hop = 0
        this.emit()
      }
    }
    return true
  }

  emit() {
    const window = this.filled
    let src = this.write - window
    if (src < 0) src += MAX_WINDOW
    for (let i = 0; i < window; i += 1) this.view[i] = this.ring[(src + i) % MAX_WINDOW]
    let rms = 0
    const tail = Math.min(512, window)
    for (let i = window - tail; i < window; i += 1) rms += this.view[i] * this.view[i]
    rms = Math.sqrt(rms / tail)
    const estimate = estimateFromFilled(this.view.subarray(0, window), window, sampleRate, this.scratch, this.prevHz)
    if (estimate.frequency > 0 && estimate.clarity >= 0.55) this.prevHz = estimate.frequency
    this.port.postMessage({
      type: 'estimate',
      hz: estimate.frequency,
      clarity: estimate.clarity,
      rms,
      time: currentTime,
      sampleRate,
    })
  }
}

registerProcessor('omnician-pitch', PitchProcessor)
