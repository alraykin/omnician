import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PitchDetector } from 'pitchy'

import {
  HOP,
  createPitchScratch,
  estimateFromFilled,
  windowForHz,
} from '../src/lib/mpm.ts'
import { filterBuffer } from '../src/lib/pitch-filter.ts'
import { createSmoothState, pushEstimate } from '../src/lib/pitch-smooth.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(HERE, 'fixtures', 'guitar-notes')

const NOTES = [
  { name: 'E1', hz: 41.20344461410874 },
  { name: 'B1', hz: 61.7354126570155 },
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

function harmonicTone(hz: number, sr: number, seconds: number, bright = false): Float32Array {
  const n = Math.floor(sr * seconds)
  const out = new Float32Array(n)
  const harms = bright
    ? [1, 0.78, 0.42, 0.22, 0.12, 0.07]
    : [1, 0.48, 0.24, 0.12, 0.07]
  let norm = 0
  for (const a of harms) norm += a
  for (let i = 0; i < n; i += 1) {
    const t = i / sr
    const env = 1 - Math.exp(-t * 80)
    const decay = Math.exp(-t / 1.15)
    let s = 0
    for (let h = 1; h <= harms.length; h += 1) {
      s += Math.sin(2 * Math.PI * hz * h * t) * harms[h - 1]
    }
    out[i] = (s / norm) * 0.62 * env * decay
  }
  return out
}

function karplusStrong(hz: number, sr: number, seconds: number, seed = 1): Float32Array {
  const delay = Math.max(2, Math.round(sr / hz))
  const n = Math.floor(sr * seconds)
  const out = new Float32Array(n)
  let rng = (seed * 1103515245 + 12345) >>> 0
  for (let i = 0; i < delay; i += 1) {
    rng = (rng * 1664525 + 1013904223) >>> 0
    out[i] = (rng / 4294967296) * 2 - 1
  }
  for (let i = delay; i < n; i += 1) {
    const a = out[i - delay]
    const b = out[i - delay - 1] ?? a
    out[i] = 0.996 * 0.5 * (a + b)
  }
  return out
}

function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  const n = Math.floor((input.length * toRate) / fromRate)
  const out = new Float32Array(n)
  const step = fromRate / toRate
  for (let i = 0; i < n; i += 1) {
    const pos = i * step
    const lo = Math.floor(pos)
    const hi = Math.min(input.length - 1, lo + 1)
    const t = pos - lo
    out[i] = input[lo] * (1 - t) + input[hi] * t
  }
  return out
}

function stereoSilentLeft(right: Float32Array): Float32Array {
  const out = new Float32Array(right.length)
  for (let i = 0; i < right.length; i += 1) out[i] = right[i]
  return out
}

function pickChannel(left: Float32Array, right: Float32Array): Float32Array {
  let e0 = 0
  let e1 = 0
  for (let i = 0; i < left.length; i += 1) {
    e0 += left[i] * left[i]
    e1 += right[i] * right[i]
  }
  const r0 = Math.sqrt(e0 / left.length)
  const r1 = Math.sqrt(e1 / right.length)
  if (r1 > r0 * 4) return right
  if (r0 > r1 * 4) return left
  const out = new Float32Array(left.length)
  for (let i = 0; i < left.length; i += 1) out[i] = (left[i] + right[i]) * 0.5
  return out
}

function runDetector(samples: Float32Array, sr: number, target: number) {
  const filtered = filterBuffer(samples, sr)
  const hop = HOP
  const scratch = createPitchScratch()
  const state = createSmoothState()
  let prevHz: number | null = null
  const readings: number[] = []
  const rawFar: number[] = []
  const start = Math.min(filtered.length, windowForHz(target, sr))

  for (let pos = start; pos + hop < filtered.length; pos += hop) {
    const win = Math.min(filtered.length, windowForHz(prevHz ?? target, sr))
    if (pos < win) continue
    const slice = filtered.subarray(pos - win, pos)
    const estimate = estimateFromFilled(slice, win, sr, scratch, prevHz)
    if (estimate.frequency > 0) prevHz = estimate.frequency
    const tMs = (pos / sr) * 1000
    let energy = 0
    for (let i = Math.max(0, slice.length - 512); i < slice.length; i += 1) {
      energy += slice[i] * slice[i]
    }
    const signal = Math.sqrt(energy / Math.min(512, slice.length))
    if (estimate.frequency > 0) {
      const off = cents(estimate.frequency, target)
      if (Math.abs(off) > 80) rawFar.push(off)
    }
    const next = pushEstimate(state, estimate.frequency, estimate.clarity, signal, tMs, hop / sr)
    if (next.hz && tMs > 260) readings.push(cents(next.hz, target))
  }

  const mid = readings.length
    ? [...readings].sort((a, b) => a - b)[Math.floor(readings.length / 2)]
    : Number.NaN
  const maxAbs = readings.length ? Math.max(...readings.map(Math.abs)) : Number.NaN
  const far = readings.filter((c) => Math.abs(c) > 40).length
  return { n: readings.length, median: mid, maxAbs, far, rawFar: rawFar.length }
}

function decodeWav(bytes: Uint8Array): { rate: number; samples: Float32Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
  if (tag !== 'RIFF') throw new Error('not wav')
  const channels = view.getUint16(22, true)
  const rate = view.getUint32(24, true)
  const bits = view.getUint16(34, true)
  let offset = 12
  let dataOffset = -1
  let dataSize = 0
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
    const size = view.getUint32(offset + 4, true)
    if (id === 'data') {
      dataOffset = offset + 8
      dataSize = size
      break
    }
    offset += 8 + size
  }
  if (dataOffset < 0) throw new Error('no data chunk')
  const count = Math.floor(dataSize / (bits / 8) / channels)
  const mono = new Float32Array(count)
  if (bits === 16) {
    for (let i = 0; i < count; i += 1) {
      let sum = 0
      for (let c = 0; c < channels; c += 1) {
        sum += view.getInt16(dataOffset + (i * channels + c) * 2, true) / 32768
      }
      mono[i] = sum / channels
    }
  } else if (bits === 24) {
    for (let i = 0; i < count; i += 1) {
      let sum = 0
      for (let c = 0; c < channels; c += 1) {
        const p = dataOffset + (i * channels + c) * 3
        let v = bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16)
        if (v & 0x800000) v |= ~0xffffff
        sum += v / 8388608
      }
      mono[i] = sum / channels
    }
  } else {
    throw new Error(`unsupported wav bits ${bits}`)
  }
  return { rate, samples: mono }
}

function loadFixture(name: string): { rate: number; samples: Float32Array } | null {
  const wav = join(FIXTURES, `${name}.wav`)
  if (!existsSync(wav)) return null
  return decodeWav(new Uint8Array(readFileSync(wav)))
}

function crossCheckPitchy(samples: Float32Array, sr: number, target: number): number {
  const window = windowForHz(target, sr)
  const filtered = filterBuffer(samples, sr)
  const detector = PitchDetector.forFloat32Array(window)
  detector.clarityThreshold = 0.9
  const mid = Math.floor(filtered.length * 0.35)
  const slice = filtered.subarray(mid, mid + window)
  if (slice.length < window) return Number.NaN
  const buf = new Float32Array(window)
  buf.set(slice)
  const [hz] = detector.findPitch(buf, sr)
  return hz > 0 ? cents(hz, target) : Number.NaN
}

let failed = 0

function report(ok: boolean, label: string, extra: string) {
  if (!ok) failed += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}  ${extra}`)
}

console.log('windows', Object.fromEntries(NOTES.map((n) => [n.name, RATES.map((sr) => windowForHz(n.hz, sr))])))

console.log('\n==== synthesized harmonics ====')
for (const sr of RATES) {
  console.log(`-- ${sr} Hz --`)
  for (const note of NOTES) {
    const tone = harmonicTone(note.hz, sr, 1.05, note.hz <= 110)
    const result = runDetector(tone, sr, note.hz)
    const ok =
      Number.isFinite(result.median) &&
      Math.abs(result.median) <= 2 &&
      result.maxAbs <= 6 &&
      result.far === 0
    report(ok, `${note.name} @ ${sr}`, `med ${result.median.toFixed(2)}¢  max ${result.maxAbs.toFixed(2)}¢  far ${result.far}  n ${result.n}`)
  }
}

console.log('\n==== Karplus–Strong pluck (informational; loop filter pulls pitch flat) ====')
for (const sr of [44100, 48000]) {
  for (const note of NOTES) {
    const pluck = karplusStrong(note.hz, sr, 1.1, note.name.charCodeAt(0))
    const result = runDetector(pluck, sr, note.hz)
    const ok = Number.isFinite(result.median) && result.far === 0 && Math.abs(result.median) <= 15
    console.log(
      `${ok ? 'ok  ' : 'WARN'} KS ${note.name} @ ${sr}  med ${result.median.toFixed(2)}¢  far ${result.far}  n ${result.n}`,
    )
  }
}

console.log('\n==== stereo silent-channel mix @ 48k ====')
const guitar = harmonicTone(110, 48000, 0.9, true)
const silent = new Float32Array(guitar.length)
const rightOnly = pickChannel(silent, guitar)
const leftOnly = pickChannel(guitar, silent)
const rightResult = runDetector(rightOnly, 48000, 110)
const leftResult = runDetector(leftOnly, 48000, 110)
report(
  Math.abs(rightResult.median) <= 2 && rightResult.far === 0,
  'A2 on right / silent left',
  `med ${rightResult.median.toFixed(2)}¢`,
)
report(
  Math.abs(leftResult.median) <= 2 && leftResult.far === 0,
  'A2 on left / silent right',
  `med ${leftResult.median.toFixed(2)}¢`,
)

const mismatch = runDetector(harmonicTone(110, 96000, 0.7), 44100, 110)
console.log(
  `note  96k told-as-44100 med ${mismatch.median.toFixed(1)}¢ (must stay unused; ~-1347¢ if rates disagree)`,
)

console.log('\n==== recorded guitar fixtures (Iowa MIS / CC0) ====')
let recorded = 0
for (const note of NOTES) {
  const fixture = loadFixture(note.name)
  if (!fixture) {
    console.log(`skip ${note.name}  (no ${note.name}.wav in scripts/fixtures/guitar-notes)`)
    continue
  }
  recorded += 1
  for (const sr of RATES) {
    const samples = resample(fixture.samples, fixture.rate, sr)
    const result = runDetector(samples, sr, note.hz)
    const ok =
      Number.isFinite(result.median) &&
      Math.abs(result.median) <= 2.5 &&
      result.maxAbs <= 8 &&
      result.far === 0
    report(ok, `${note.name} rec @ ${sr}`, `med ${result.median.toFixed(2)}¢  max ${result.maxAbs.toFixed(2)}¢  far ${result.far}  n ${result.n}`)
    if (sr === 48000) {
      const py = crossCheckPitchy(samples, sr, note.hz)
      if (Number.isFinite(py)) {
        console.log(`     pitchy cross-check ${py.toFixed(2)}¢`)
      }
    }
  }
  const stereoRight = stereoSilentLeft(resample(fixture.samples, fixture.rate, 48000))
  const picked = pickChannel(new Float32Array(stereoRight.length), stereoRight)
  const stereo = runDetector(picked, 48000, note.hz)
  report(
    Math.abs(stereo.median) <= 2 && stereo.far === 0,
    `${note.name} rec stereo-silent-L @ 48k`,
    `med ${stereo.median.toFixed(2)}¢`,
  )
}

if (recorded === 0) {
  console.log('No recorded fixtures on disk yet — run scripts/fetch-guitar-samples.sh')
}

if (failed) {
  console.error(`\n${failed} case(s) failed`)
  process.exit(1)
}
console.log('\nAll accuracy checks passed.')
