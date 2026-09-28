/**
 * Tempo from an onset-strength envelope (multi-band spectral flux) plus a
 * comb-filter tempogram with a log-Gaussian prior around 120 BPM.
 * Classic Ellis / librosa-style approach, independent implementation.
 */

export const TEMPO_MIN_BPM = 40
export const TEMPO_MAX_BPM = 240
export const TEMPO_PRIOR_BPM = 120
export const LISTEN_MAX_MS = 9000
export const LISTEN_MIN_MS = 4800

const WIN = 2048
const HOP = 256

export type TempoEstimate = {
  bpm: number
  bpmExact: number
  half: number
  double: number
  confidence: number
  hint: string
}

export function confidenceHint(confidence: number): string {
  if (confidence >= 0.82) return 'Locked in — a clear, steady beat'
  if (confidence >= 0.65) return 'Pretty sure'
  if (confidence >= 0.45) return 'Best guess — ½× or 2× might be what you feel'
  return 'Uncertain — try a clearer groove or a longer clip'
}

function hann(n: number): Float32Array {
  const w = new Float32Array(n)
  for (let i = 0; i < n; i += 1) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)))
  return w
}

function fftRadix2(re: Float32Array, im: Float32Array): void {
  const n = re.length
  let j = 0
  for (let i = 1; i < n; i += 1) {
    let bit = n >> 1
    while (j & bit) {
      j ^= bit
      bit >>= 1
    }
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
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1
    const step = (-2 * Math.PI) / size
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < half; k += 1) {
        const angle = step * k
        const wr = Math.cos(angle)
        const wi = Math.sin(angle)
        const a = i + k
        const b = a + half
        const tr = wr * re[b] - wi * im[b]
        const ti = wr * im[b] + wi * re[b]
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}

const WINDOW = hann(WIN)

const BAND_HZ = [40, 80, 160, 320, 650, 1300, 2600, 5200, 11000]
const BAND_WEIGHT = [0.75, 0.9, 1.1, 1.2, 1.15, 0.95, 0.55, 0.32]
const LOW_WEIGHT = [1.45, 1.4, 1.15, 0.7, 0.28, 0.12, 0.05, 0.02]

function bandIndex(hz: number): number {
  for (let i = 0; i < BAND_HZ.length - 1; i += 1) {
    if (hz >= BAND_HZ[i] && hz < BAND_HZ[i + 1]) return i
  }
  return -1
}

function mixMono(buffer: AudioBuffer | { numberOfChannels: number; length: number; getChannelData: (c: number) => Float32Array }): Float32Array {
  const ch0 = buffer.getChannelData(0)
  if (buffer.numberOfChannels === 1) return ch0
  const out = new Float32Array(buffer.length)
  const nCh = buffer.numberOfChannels
  for (let c = 0; c < nCh; c += 1) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < out.length; i += 1) out[i] += ch[i]
  }
  const inv = 1 / nCh
  for (let i = 0; i < out.length; i += 1) out[i] *= inv
  return out
}

function highpassNormalize(onset: Float32Array, fps: number, floor: number | null): Float32Array {
  const smoothN = Math.max(4, Math.round(0.35 * fps))
  let run = 0
  const hp = new Float32Array(onset.length)
  for (let i = 0; i < onset.length; i += 1) {
    run += onset[i]
    if (i >= smoothN) run -= onset[i - smoothN]
    const mean = run / Math.min(smoothN, i + 1)
    hp[i] = Math.max(0, onset[i] - mean)
  }

  let mean = 0
  for (let i = 0; i < hp.length; i += 1) mean += hp[i]
  mean /= Math.max(1, hp.length)
  let v = 0
  for (let i = 0; i < hp.length; i += 1) {
    const d = hp[i] - mean
    v += d * d
  }
  const sd = Math.sqrt(v / Math.max(1, hp.length)) || 1
  for (let i = 0; i < hp.length; i += 1) hp[i] = (hp[i] - mean) / sd
  if (floor === null) return hp

  const sparse = new Float32Array(hp.length)
  for (let i = 1; i < hp.length - 1; i += 1) {
    if (hp[i] >= hp[i - 1] && hp[i] > hp[i + 1] && hp[i] > floor) sparse[i] = hp[i]
  }
  let kept = 0
  for (let i = 0; i < sparse.length; i += 1) if (sparse[i] > 0) kept += 1
  return kept >= 6 ? sparse : hp
}

function onsetEnvelope(
  samples: ArrayLike<number>,
  sampleRate: number,
): { onset: Float32Array; low: Float32Array; fps: number } {
  const fps = sampleRate / HOP
  const frames = Math.max(0, Math.floor((samples.length - WIN) / HOP) + 1)
  const bands = BAND_WEIGHT.length
  const prev = new Float32Array(bands)
  const onset = new Float32Array(Math.max(1, frames))
  const lowOnset = new Float32Array(Math.max(1, frames))
  const re = new Float32Array(WIN)
  const im = new Float32Array(WIN)
  const mag = new Float32Array(bands)
  let first = true

  for (let f = 0; f < frames; f += 1) {
    const start = f * HOP
    re.fill(0)
    im.fill(0)
    mag.fill(0)
    for (let i = 0; i < WIN; i += 1) {
      const s = start + i < samples.length ? samples[start + i] : 0
      re[i] = s * WINDOW[i]
    }
    fftRadix2(re, im)
    const binHz = sampleRate / WIN
    for (let k = 1; k < WIN / 2; k += 1) {
      const hz = k * binHz
      const b = bandIndex(hz)
      if (b < 0) continue
      const m = Math.hypot(re[k], im[k])
      mag[b] += m
    }
    let flux = 0
    let fluxLow = 0
    for (let b = 0; b < bands; b += 1) {
      const logm = Math.log1p(mag[b])
      if (!first) {
        const d = Math.max(0, logm - prev[b])
        flux += d * BAND_WEIGHT[b]
        fluxLow += d * LOW_WEIGHT[b]
      }
      prev[b] = logm
    }
    onset[f] = first ? 0 : flux
    lowOnset[f] = first ? 0 : fluxLow
    first = false
  }

  return {
    onset: highpassNormalize(onset, fps, 0.35),
    low: highpassNormalize(lowOnset, fps, null),
    fps,
  }
}

function autocorr(onset: Float32Array, lagMax: number): Float32Array {
  const n = onset.length
  const ac = new Float32Array(lagMax + 1)
  const cap = Math.min(lagMax, n - 2)
  for (let lag = 0; lag <= cap; lag += 1) {
    let sum = 0
    const lim = n - lag
    for (let i = 0; i < lim; i += 1) sum += onset[i] * onset[i + lag]
    ac[lag] = lim > 0 ? sum / lim : 0
  }
  const scale = ac[0] > 1e-12 ? ac[0] : 1
  for (let lag = 0; lag <= cap; lag += 1) ac[lag] /= scale
  return ac
}

function acAt(ac: Float32Array, lag: number): number {
  if (lag <= 0 || lag >= ac.length - 1) return 0
  const i = Math.floor(lag)
  const t = lag - i
  return ac[i] * (1 - t) + ac[i + 1] * t
}

function tempoPrior(bpm: number, sigma = 0.74): number {
  const x = Math.log2(bpm / TEMPO_PRIOR_BPM)
  return Math.exp(-0.5 * (x / sigma) ** 2)
}

function combScore(ac: Float32Array, fps: number, bpm: number): number {
  const lag = (60 * fps) / bpm
  if (lag < 2 || lag >= ac.length - 2) return 0
  let score = 0
  let wsum = 0
  const weights = [1, 0.32, 0.14, 0.08]
  for (let k = 1; k <= 4; k += 1) {
    const w = weights[k - 1]
    score += w * acAt(ac, lag * k)
    wsum += w
  }
  return (score / wsum) * tempoPrior(bpm)
}

function relatedOctave(a: number, b: number): boolean {
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  if (lo < 1) return false
  const r = hi / lo
  return Math.abs(r - 2) < 0.08 || Math.abs(r - 3) < 0.1 || Math.abs(r - 0.5) < 0.04
}

function clampDetect(bpm: number): number {
  return Math.min(TEMPO_MAX_BPM, Math.max(TEMPO_MIN_BPM, bpm))
}

function pickTempo(ac: Float32Array, fps: number): { bpm: number; confidence: number } {
  const step = 0.5
  let bestBpm = TEMPO_PRIOR_BPM
  let best = -Infinity
  const peaks: { bpm: number; score: number }[] = []

  let prev = -Infinity
  let prevBpm = TEMPO_MIN_BPM
  let rising = false
  for (let bpm = TEMPO_MIN_BPM; bpm <= TEMPO_MAX_BPM + 0.001; bpm += step) {
    const s = combScore(ac, fps, bpm)
    if (s > prev) {
      rising = true
    } else if (rising && prev > 0) {
      peaks.push({ bpm: prevBpm, score: prev })
      rising = false
    }
    if (s > best) {
      best = s
      bestBpm = bpm
    }
    prev = s
    prevBpm = bpm
  }
  if (peaks.length === 0) peaks.push({ bpm: bestBpm, score: best })

  peaks.sort((a, b) => b.score - a.score)
  const bpm = bestBpm
  const winner = combScore(ac, fps, bpm)
  let second = 0
  for (const p of peaks) {
    if (relatedOctave(p.bpm, bpm) || Math.abs(p.bpm - bpm) < 4) continue
    if (p.score > second) second = p.score
  }
  const confidence = Math.max(0, Math.min(1, (winner - second * 0.55) / Math.max(0.18, winner + 0.05)))
  return { bpm: clampDetect(bpm), confidence }
}

function peakTimes(onset: Float32Array, fps: number, quantile: number): number[] {
  const vals: number[] = []
  for (let i = 0; i < onset.length; i += 1) if (onset[i] > 0.05) vals.push(onset[i])
  if (vals.length < 6) return []
  vals.sort((a, b) => a - b)
  const thresh = vals[Math.min(vals.length - 1, Math.floor(vals.length * quantile))]
  const times: number[] = []
  for (let i = 1; i < onset.length - 1; i += 1) {
    if (onset[i] >= onset[i - 1] && onset[i] > onset[i + 1] && onset[i] >= thresh) {
      times.push(i / fps)
    }
  }
  return times
}

function medianIoiBpm(onset: Float32Array, fps: number, quantile: number): number | null {
  const times = peakTimes(onset, fps, quantile)
  if (times.length < 6) return null
  const minIoi = 60 / TEMPO_MAX_BPM
  const maxIoi = 60 / TEMPO_MIN_BPM
  const iois: number[] = []
  for (let i = 1; i < times.length; i += 1) {
    const d = times[i] - times[i - 1]
    if (d >= minIoi && d <= maxIoi) iois.push(d)
    if (i + 1 < times.length) {
      const skip = times[i + 1] - times[i - 1]
      if (skip >= minIoi && skip <= maxIoi) iois.push(skip)
    }
  }
  if (iois.length < 4) return null
  iois.sort((a, b) => a - b)
  return 60 / iois[Math.floor(iois.length / 2)]
}

function nearBpm(a: number, b: number, tol = 0.1): boolean {
  if (a < 1 || b < 1) return false
  return Math.abs(a - b) / b < tol
}

function resolveOctave(
  bpm: number,
  onset: Float32Array,
  lowOnset: Float32Array,
  fps: number,
): number {
  const pulse = medianIoiBpm(onset, fps, 0.12)
  const bass = medianIoiBpm(lowOnset, fps, 0.4)
  if (bass && nearBpm(bass, bpm, 0.09)) return bpm
  if (pulse && nearBpm(pulse, bpm * 2, 0.1) && bpm * 2 <= 220 && bpm <= 118) {
    return clampDetect(bpm * 2)
  }
  if (bass && nearBpm(bass, bpm / 2, 0.1) && bpm / 2 >= TEMPO_MIN_BPM) {
    return clampDetect(bpm / 2)
  }
  const lagMax = Math.min(
    onset.length - 2,
    lowOnset.length - 2,
    Math.floor((60 * fps) / TEMPO_MIN_BPM) + 4,
  )
  if (lagMax < 8) return bpm
  const acLow = autocorr(lowOnset, lagMax)
  const acAtBpm = (b: number) => {
    if (b < TEMPO_MIN_BPM - 0.4 || b > TEMPO_MAX_BPM + 0.4) return -1
    return Math.max(0, acAt(acLow, (60 * fps) / b))
  }
  const s0 = acAtBpm(bpm)
  const sFast = acAtBpm(bpm * 2)
  if (sFast >= 0.12 && sFast >= s0 * 0.9 && bpm * 2 <= 220 && bpm <= 90) {
    return clampDetect(bpm * 2)
  }
  return bpm
}

function refineBpm(ac: Float32Array, fps: number, bpm: number): number {
  const step = 0.1
  let best = bpm
  let bestS = combScore(ac, fps, bpm)
  for (let b = bpm - 1.6; b <= bpm + 1.6; b += step) {
    if (b < TEMPO_MIN_BPM || b > TEMPO_MAX_BPM) continue
    const s = combScore(ac, fps, b)
    if (s > bestS) {
      bestS = s
      best = b
    }
  }
  return best
}

export function detectTempo(samples: ArrayLike<number>, sampleRate: number): TempoEstimate | null {
  if (!sampleRate || samples.length < sampleRate * 1.6) return null
  const { onset, low, fps } = onsetEnvelope(samples, sampleRate)
  if (onset.length < 24) return null
  const lagMax = Math.min(onset.length - 2, Math.floor((60 * fps) / TEMPO_MIN_BPM) + 4)
  const ac = autocorr(onset, lagMax)
  const picked = pickTempo(ac, fps)
  if (picked.confidence < 0.12) return null
  const octave = resolveOctave(picked.bpm, onset, low, fps)
  const exact = refineBpm(ac, fps, octave)
  const rounded = Math.round(exact)
  const half = Math.round(exact / 2)
  const double = Math.round(exact * 2)
  return {
    bpm: Math.min(TEMPO_MAX_BPM, Math.max(TEMPO_MIN_BPM, rounded)),
    bpmExact: Math.round(exact * 10) / 10,
    half: Math.min(300, Math.max(30, half)),
    double: Math.min(300, Math.max(30, double)),
    confidence: picked.confidence,
    hint: confidenceHint(picked.confidence),
  }
}

export function sliceForFileAnalysis(
  samples: Float32Array,
  sampleRate: number,
): Float32Array {
  const duration = samples.length / sampleRate
  const startSec = duration > 18 ? Math.min(duration * 0.14, 14) : duration > 10 ? 2 : 0
  const takeSec = Math.min(48, Math.max(0, duration - startSec))
  const start = Math.floor(startSec * sampleRate)
  const take = Math.floor(takeSec * sampleRate)
  return samples.subarray(start, Math.min(samples.length, start + take))
}

export function mixToMono(buffer: AudioBuffer): Float32Array {
  return mixMono(buffer)
}

export function synthesizeClickTrack(
  bpm: number,
  sampleRate: number,
  seconds: number,
  swing = 0,
): Float32Array {
  const n = Math.floor(sampleRate * seconds)
  const out = new Float32Array(n)
  const beat = 60 / bpm
  const click = (time: number, gain: number) => {
    const at = Math.floor(time * sampleRate)
    const dur = Math.floor(sampleRate * (gain > 0.7 ? 0.014 : 0.008))
    for (let k = 0; k < dur && at + k < n; k += 1) {
      const env = 1 - k / dur
      out[at + k] += gain * env * (k % 2 === 0 ? 1 : -1)
    }
  }
  if (swing <= 0) {
    let beatI = 0
    for (let t = 0; t < seconds; t += beat) {
      click(t, beatI % 4 === 0 ? 1 : 0.62)
      beatI += 1
    }
    return out
  }
  let i = 0
  let t = 0
  const eighth = beat / 2
  while (t < seconds) {
    const onBeat = i % 2 === 0
    click(t, onBeat ? (i % 8 === 0 ? 1 : 0.7) : 0.28)
    i += 1
    t += onBeat ? eighth * (1 - swing) : eighth * (1 + swing)
  }
  return out
}

export function synthesizeDrumLoop(
  bpm: number,
  sampleRate: number,
  seconds: number,
  kind: 'rock' | 'shuffle' | 'four',
): Float32Array {
  const n = Math.floor(sampleRate * seconds)
  const out = new Float32Array(n)
  const beat = 60 / bpm
  const swing = kind === 'shuffle' ? 0.32 : 0

  const hit = (time: number, type: 'kick' | 'snare' | 'hat') => {
    const at = Math.floor(time * sampleRate)
    if (at < 0 || at >= n) return
    if (type === 'kick') {
      for (let k = 0; k < sampleRate * 0.18 && at + k < n; k += 1) {
        const t = k / sampleRate
        const f = 58 + 42 * Math.exp(-t * 22)
        const env = Math.exp(-t * 14)
        out[at + k] += 0.9 * env * Math.sin(2 * Math.PI * f * t)
      }
    } else if (type === 'snare') {
      for (let k = 0; k < sampleRate * 0.14 && at + k < n; k += 1) {
        const t = k / sampleRate
        const env = Math.exp(-t * 18)
        const noise = ((k * 16807 + 13) % 1000) / 500 - 1
        out[at + k] += 0.42 * env * noise + 0.22 * env * Math.sin(2 * Math.PI * 196 * t)
      }
    } else {
      for (let k = 0; k < sampleRate * 0.035 && at + k < n; k += 1) {
        const t = k / sampleRate
        const env = Math.exp(-t * 70)
        const noise = ((k * 48271 + 97) % 1000) / 500 - 1
        out[at + k] += 0.055 * env * noise
      }
    }
  }

  let t = 0
  let eighth = 0
  while (t < seconds) {
    const beatI = Math.floor(eighth / 2) % 4
    const off = eighth % 2 === 1
    if (kind === 'four') {
      if (!off) hit(t, 'kick')
      if (beatI === 1 || beatI === 3) if (!off) hit(t, 'snare')
    } else {
      if (!off && (beatI === 0 || beatI === 2)) hit(t, 'kick')
      if (!off && (beatI === 1 || beatI === 3)) hit(t, 'snare')
      if (kind === 'rock' && !off && beatI === 2) hit(t + beat * 0.5 * 0.02, 'kick')
    }
    hit(t, 'hat')
    eighth += 1
    t += (beat / 2) * (off ? 1 + swing : 1 - swing)
  }
  return out
}
