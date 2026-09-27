import { createSmoothState, pushEstimate } from '../src/lib/pitch-smooth.ts'
import {
  MAX_WINDOW,
  createPitchScratch,
  estimateFromFilled,
  windowForHz,
} from '../src/lib/yin.ts'

const NOTES = [
  { name: 'E2', hz: 82.40688922821748 },
  { name: 'A2', hz: 110 },
  { name: 'D3', hz: 146.8323839587038 },
  { name: 'G3', hz: 195.99771799087463 },
  { name: 'B3', hz: 246.94165062806206 },
  { name: 'E4', hz: 329.6275569128699 },
] as const

const RATES = [44100, 48000, 96000]

function cents(hz: number, target: number): number {
  return 1200 * Math.log2(hz / target)
}

function guitarTone(
  hz: number,
  sr: number,
  seconds: number,
  bright = false,
): Float32Array {
  const n = Math.floor(sr * seconds)
  const out = new Float32Array(n)
  const harms = bright
    ? [1, 0.85, 0.55, 0.32, 0.18, 0.1]
    : [1, 0.5, 0.28, 0.14, 0.08]
  let norm = 0
  for (const a of harms) norm += a
  for (let i = 0; i < n; i += 1) {
    const t = i / sr
    let s = 0
    for (let h = 1; h <= harms.length; h += 1) {
      s += Math.sin(2 * Math.PI * hz * h * t) * harms[h - 1]
    }
    out[i] = (s / norm) * 0.7
  }
  return out
}

function mixdown(left: Float32Array, right: Float32Array): Float32Array {
  const out = new Float32Array(left.length)
  for (let i = 0; i < left.length; i += 1) out[i] = (left[i] + right[i]) / 2
  return out
}

function runDetector(samples: Float32Array, sr: number, target: number) {
  const hop = Math.max(256, Math.round(sr / 188))
  const scratch = createPitchScratch()
  const state = createSmoothState()
  let prevHz: number | null = null
  const readings: number[] = []

  for (let pos = MIN_FILL(sr); pos + hop < samples.length; pos += hop) {
    const win = Math.min(MAX_WINDOW, pos)
    const slice = samples.subarray(pos - win, pos)
    const estimate = estimateFromFilled(slice, win, sr, scratch, prevHz)
    if (estimate.frequency > 0 && estimate.clarity >= 0.55) prevHz = estimate.frequency
    const tMs = (pos / sr) * 1000
    let energy = 0
    for (let i = 0; i < slice.length; i += 1) energy += slice[i] * slice[i]
    const next = pushEstimate(state, estimate.frequency, estimate.clarity, Math.sqrt(energy / slice.length), tMs, hop / sr)
    if (next.hz && tMs > 220) readings.push(cents(next.hz, target))
  }

  const mid = readings.length
    ? [...readings].sort((a, b) => a - b)[Math.floor(readings.length / 2)]
    : Number.NaN
  const maxAbs = readings.length ? Math.max(...readings.map(Math.abs)) : Number.NaN
  const far = readings.filter((c) => Math.abs(c) > 40).length
  return { n: readings.length, median: mid, maxAbs, far }
}

function MIN_FILL(sr: number): number {
  return Math.min(MAX_WINDOW, windowForHz(90, sr))
}

let failed = 0

console.log(
  'windows E2',
  Object.fromEntries(RATES.map((sr) => [sr, windowForHz(82.40688922821748, sr)])),
)

for (const sr of RATES) {
  console.log(`\n==== ${sr} Hz ====`)
  for (const note of NOTES) {
    const result = runDetector(guitarTone(note.hz, sr, 0.95, note.hz <= 110), sr, note.hz)
    const ok =
      Number.isFinite(result.median) &&
      Math.abs(result.median) <= 2 &&
      result.maxAbs <= 4 &&
      result.far === 0
    if (!ok) failed += 1
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${note.name}  med ${result.median.toFixed(2)}¢  max ${result.maxAbs.toFixed(2)}¢  far ${result.far}  n ${result.n}`,
    )
  }
}

console.log('\n==== mono mix of stereo interface @ 48k ====')
const leftSilent = new Float32Array(48000 * 0.8)
const rightGuitar = guitarTone(110, 48000, 0.8, true)
const mixed = mixdown(leftSilent, rightGuitar)
const rightOnly = runDetector(mixed, 48000, 110)
const rightOk = Math.abs(rightOnly.median) <= 2 && rightOnly.far === 0
if (!rightOk) failed += 1
console.log(
  `${rightOk ? 'ok  ' : 'FAIL'} guitar on right  med ${rightOnly.median.toFixed(2)}¢  far ${rightOnly.far}`,
)

const mismatch = runDetector(guitarTone(110, 96000, 0.7), 44100, 110)
console.log(
  `note  96k told-as-44100 med ${mismatch.median.toFixed(1)}¢ (capture must match rates; ~-1347¢ if mismatched)`,
)

if (failed) {
  console.error(`\n${failed} case(s) failed`)
  process.exit(1)
}
console.log('\nAll accuracy checks passed.')
