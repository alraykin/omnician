export const MIN_HZ = 30
export const MAX_HZ = 1400

export type PitchEstimate = {
  frequency: number
  clarity: number
}

export type PitchScratch = {
  nsdf: Float32Array
  diff: Float32Array
  cmnd: Float32Array
}

export function createPitchScratch(maxWindow = 4096): PitchScratch {
  return {
    nsdf: new Float32Array(maxWindow),
    diff: new Float32Array(maxWindow),
    cmnd: new Float32Array(maxWindow),
  }
}

export function windowForHz(hz: number | null, sampleRate: number): number {
  if (hz === null || hz <= 0) return 3072
  const needed = Math.ceil((sampleRate / hz) * 2.5)
  if (needed <= 1536) return 1536
  if (needed <= 2048) return 2048
  if (needed <= 3072) return 3072
  return 4096
}

function parabolicTau(values: ArrayLike<number>, tau: number): number {
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

function localRms(buffer: ArrayLike<number>, start: number, end: number): number {
  let sum = 0
  const n = Math.max(1, end - start)
  for (let i = start; i < end; i += 1) {
    const s = buffer[i]
    sum += s * s
  }
  return Math.sqrt(sum / n)
}

/** McLeod Pitch Method (NSDF) with parabolic interpolation. */
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
  const peaks: number[] = []
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
  if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) {
    return { frequency: 0, clarity: 0 }
  }
  return { frequency, clarity }
}

/** YIN with cumulative-mean normalization and parabolic interpolation. */
export function yinPitch(
  buffer: ArrayLike<number>,
  sampleRate: number,
  scratch: PitchScratch,
  minHz = MIN_HZ,
  maxHz = MAX_HZ,
  threshold = 0.13,
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
  if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) {
    return { frequency: 0, clarity: 0 }
  }
  return { frequency, clarity }
}

function nearer(hz: number, target: number): number {
  return Math.abs(Math.log2(hz / target))
}

/**
 * Adaptive MPM, with YIN as an octave/low-note check.
 * `prevHz` steers window size and rejects octave flips.
 */
export function estimatePitchAdaptive(
  buffer: ArrayLike<number>,
  sampleRate: number,
  scratch: PitchScratch,
  prevHz: number | null = null,
): PitchEstimate {
  const energy = localRms(buffer, 0, buffer.length)
  if (energy < 0.001) return { frequency: 0, clarity: 0 }

  const mpm = mpmPitch(buffer, sampleRate, scratch)
  const yin = yinPitch(buffer, sampleRate, scratch)

  let pick = mpm
  if (mpm.clarity < 0.55 && yin.clarity > mpm.clarity) pick = yin
  if (mpm.frequency > 0 && yin.frequency > 0) {
    const ratio = mpm.frequency / yin.frequency
    if (ratio > 1.85 && ratio < 2.15 && yin.clarity >= 0.62) {
      pick = prevHz && nearer(mpm.frequency, prevHz) + 0.04 < nearer(yin.frequency, prevHz) ? mpm : yin
    } else if (ratio > 0.46 && ratio < 0.54 && mpm.clarity >= 0.62) {
      pick = prevHz && nearer(yin.frequency, prevHz) + 0.04 < nearer(mpm.frequency, prevHz) ? yin : mpm
    }
  }

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

const EMPTY: PitchEstimate = { frequency: 0, clarity: 0 }

/** Pick a window from the newest samples in `buffer` (length = filled). */
export function estimateFromFilled(
  buffer: ArrayLike<number>,
  filled: number,
  sampleRate: number,
  scratch: PitchScratch,
  prevHz: number | null,
): PitchEstimate {
  const take = (window: number) => {
    const start = filled - window
    if (typeof (buffer as Float32Array).subarray === 'function') {
      return estimatePitchAdaptive(
        (buffer as Float32Array).subarray(start, start + window),
        sampleRate,
        scratch,
        prevHz,
      )
    }
    return estimatePitchAdaptive(buffer, sampleRate, scratch, prevHz)
  }

  if (prevHz) {
    const window = Math.min(filled, windowForHz(prevHz, sampleRate))
    if (window < 1536) return EMPTY
    return take(window)
  }
  if (filled < 2048) return EMPTY
  const quick = take(2048)
  if (quick.frequency >= 90 && quick.clarity >= 0.74) return quick
  if (filled < 3072) return EMPTY
  const mid = take(3072)
  if (mid.frequency >= 48 && mid.clarity >= 0.7) return mid
  if (filled < 4096) return EMPTY
  return take(4096)
}
