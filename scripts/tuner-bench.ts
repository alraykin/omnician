import { PitchDetector } from 'pitchy'

import { createSmoothState, pushEstimate } from '../src/lib/pitch-smooth.ts'
import { createPitchScratch, estimateFromFilled } from '../src/lib/yin.ts'

const SR = 48000

type SignalKind = 'sine' | 'pluck'

function cents(hz: number, target: number): number {
  return 1200 * Math.log2(hz / target)
}

function makeSignal(
  hz: number,
  seconds: number,
  kind: SignalKind,
  detuneCents: number,
  noise = 0,
  seed = 1,
): Float32Array {
  const n = Math.floor(SR * seconds)
  const out = new Float32Array(n)
  const f = hz * 2 ** (detuneCents / 1200)
  let rng = seed + 1
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0
    return rng / 4294967296
  }
  for (let i = 0; i < n; i += 1) {
    const t = i / SR
    let sample = 0
    if (kind === 'sine') {
      sample = Math.sin(2 * Math.PI * f * t)
    } else {
      const env = Math.exp(-t / 0.55)
      sample =
        Math.sin(2 * Math.PI * f * t) * 0.72 +
        Math.sin(2 * Math.PI * f * 2 * t) * 0.28 * env +
        Math.sin(2 * Math.PI * f * 3 * t) * 0.16 * env +
        Math.sin(2 * Math.PI * f * 4 * t) * 0.08 * env
      sample *= env
    }
    sample += (rand() * 2 - 1) * noise
    out[i] = Math.max(-1, Math.min(1, sample))
  }
  return out
}

function rms(buffer: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i]
  return Math.sqrt(sum / buffer.length)
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const v = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(v)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function runOld(samples: Float32Array, targetHz: number) {
  const window = 8192
  const hop = 768
  const detector = PitchDetector.forFloat32Array(window)
  const buf = new Float32Array(window)
  let pending: number | null = null
  let pendingCount = 0
  let smooth: number | null = null
  const med: number[] = []
  let firstStable = -1
  const sustain: number[] = []

  for (let pos = window; pos + hop < samples.length; pos += hop) {
    buf.set(samples.subarray(pos - window, pos))
    const [frequency, clarity] = detector.findPitch(buf, SR)
    const signal = rms(buf)
    const tMs = (pos / SR) * 1000
    const strong =
      Number.isFinite(frequency) &&
      frequency > 30 &&
      frequency < 1400 &&
      clarity >= 0.8 &&
      signal >= 0.0035
    if (!strong) continue
    const same = pending !== null && Math.abs(12 * Math.log2(frequency / pending)) < 0.22
    if (same && pending !== null) {
      pending = pending * 0.65 + frequency * 0.35
      pendingCount += 1
    } else {
      pending = frequency
      pendingCount = 1
    }
    if (pendingCount < 4) continue
    med.push(pending)
    if (med.length > 9) med.shift()
    const mid = med.length >= 3 ? median(med) : pending
    if (smooth !== null && Math.abs(12 * Math.log2(mid / smooth)) < 0.24) {
      const off = Math.abs(12 * Math.log2(mid / smooth)) * 100
      if (off < 8) smooth = smooth * 0.965 + mid * 0.035
      else if (off < 18) smooth = smooth * 0.9 + mid * 0.1
      else smooth = smooth * 0.91 + mid * 0.09
    } else if (smooth === null) {
      smooth = mid
    }
    if (smooth === null) continue
    const err = cents(smooth, targetHz)
    if (firstStable < 0 && Math.abs(err) <= 2.5) firstStable = tMs
    if (tMs >= 350 && tMs <= 950) sustain.push(err)
  }
  return { firstMs: firstStable, jitter: stddev(sustain), n: sustain.length }
}

function runNew(samples: Float32Array, targetHz: number) {
  const hop = 256
  const scratch = createPitchScratch()
  const state = createSmoothState()
  let prevHz: number | null = null
  let firstStable = -1
  const sustain: number[] = []
  const view = new Float32Array(8192)

  for (let pos = 2048; pos + hop < samples.length; pos += hop) {
    const win = Math.min(8192, pos)
    view.set(samples.subarray(pos - win, pos))
    const slice = view.subarray(0, win)
    const estimate = estimateFromFilled(slice, win, SR, scratch, prevHz)
    if (estimate.frequency > 0 && estimate.clarity >= 0.55) prevHz = estimate.frequency
    const tMs = (pos / SR) * 1000
    const next = pushEstimate(state, estimate.frequency, estimate.clarity, rms(slice), tMs, hop / SR)
    if (next.hz === null) continue
    const err = cents(next.hz, targetHz)
    if (firstStable < 0 && Math.abs(err) <= 2.5) firstStable = tMs
    if (tMs >= 350 && tMs <= 950) sustain.push(err)
  }
  return { firstMs: firstStable, jitter: stddev(sustain), n: sustain.length }
}

const cases: Array<{ name: string; hz: number; kind: SignalKind; detune: number; noise: number }> = [
  { name: 'E1 sine', hz: 41.203, kind: 'sine', detune: 0, noise: 0 },
  { name: 'E1 pluck −8¢', hz: 41.203, kind: 'pluck', detune: -8, noise: 0.03 },
  { name: 'B0 sine', hz: 30.868, kind: 'sine', detune: 0, noise: 0 },
  { name: 'B0 pluck +12¢', hz: 30.868, kind: 'pluck', detune: 12, noise: 0.04 },
  { name: 'E2 pluck', hz: 82.407, kind: 'pluck', detune: 0, noise: 0.035 },
  { name: 'A2 sine +5¢', hz: 110, kind: 'sine', detune: 5, noise: 0.02 },
  { name: 'E4 pluck', hz: 329.628, kind: 'pluck', detune: 0, noise: 0.04 },
  { name: 'E4 sine noisy', hz: 329.628, kind: 'sine', detune: -12, noise: 0.08 },
]

function fmt(ms: number): string {
  return ms < 0 ? '  miss' : `${ms.toFixed(0).padStart(5)}ms`
}

console.log('Tuner bench @ 48 kHz  (first stable = |error| ≤ 2.5¢)')
console.log('case                 | old first  old jitter | new first  new jitter')
console.log('---------------------+-----------------------+----------------------')

let oldFirst = 0
let newFirst = 0
let oldJ = 0
let newJ = 0
let count = 0

for (const item of cases) {
  const target = item.hz * 2 ** (item.detune / 1200)
  const samples = makeSignal(item.hz, 1.2, item.kind, item.detune, item.noise)
  const before = runOld(samples, target)
  const after = runNew(samples, target)
  if (before.firstMs > 0 && after.firstMs > 0) {
    oldFirst += before.firstMs
    newFirst += after.firstMs
    oldJ += before.jitter
    newJ += after.jitter
    count += 1
  }
  console.log(
    `${item.name.padEnd(20)} | ${fmt(before.firstMs)}   ±${before.jitter.toFixed(2).padStart(4)}¢ | ${fmt(after.firstMs)}   ±${after.jitter.toFixed(2).padStart(4)}¢`,
  )
}

if (count) {
  console.log('---------------------+-----------------------+----------------------')
  console.log(
    `${'mean (locked cases)'.padEnd(20)} | ${fmt(oldFirst / count)}   ±${(oldJ / count).toFixed(2).padStart(4)}¢ | ${fmt(newFirst / count)}   ±${(newJ / count).toFixed(2).padStart(4)}¢`,
  )
}
