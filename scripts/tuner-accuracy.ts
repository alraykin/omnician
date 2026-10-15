/**
 * Tuner accuracy harness (Alex spec).
 * Chromatic E0–C8 + every builtin preset string.
 * Signals: additive decaying harmonics, weak/missing fundamental,
 * Karplus–Strong with slight inharmonicity, noise, vibrato, varied attacks.
 * Reports raw pitch within 1 / 5 / 10 cents, octave error rate, and
 * sustain stability, before (frozen MPM) vs after (FastYIN + HPS).
 */
import { createPitchScratch as createBeforeScratch, estimateFromFilled as estimateBefore, windowForHz as windowBefore } from './legacy-mpm.ts'
import { BUILTIN_PRESETS } from '../src/lib/presets.ts'
import { hzCents, midiToFreq, pitchClassName } from '../src/lib/notes.ts'
import { filterBuffer } from '../src/lib/pitch-filter.ts'
import { createSmoothState, pushEstimate } from '../src/lib/pitch-smooth.ts'
import {
  HOP,
  MAX_WINDOW,
  MIN_WINDOW,
  createPitchScratch as createAfterScratch,
  estimateFromFilled as estimateAfter,
  windowForHz as windowAfter,
} from '../src/lib/yin.ts'

const MIDI_LO = 16 // E0
const MIDI_HI = 108 // C8
const SR = 48000
const A4 = 440

type Kind = 'additive' | 'weak' | 'ks' | 'noise' | 'vibrato' | 'attack'
type Engine = 'before' | 'after'

type RawHit = {
  engine: Engine
  midi: number
  name: string
  kind: Kind
  hz: number
  detected: number
  cents: number
  octaveError: boolean
  voiced: boolean
}

function noteName(midi: number): string {
  const pitch = pitchClassName(midi)
  return `${pitch.sharpName}${pitch.octave}`
}

function rng(seed: number): () => number {
  let s = (seed + 1) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function additive(
  hz: number,
  sr: number,
  seconds: number,
  amps: number[],
  attack = 80,
  decay = 1.1,
): Float32Array {
  const n = Math.floor(sr * seconds)
  const out = new Float32Array(n)
  let norm = 0
  for (const a of amps) norm += Math.abs(a)
  const w = (2 * Math.PI * hz) / sr
  for (let i = 0; i < n; i += 1) {
    const t = i / sr
    const env = (1 - Math.exp(-t * attack)) * Math.exp(-t / decay)
    let s = 0
    for (let h = 1; h <= amps.length; h += 1) {
      const harmDecay = Math.exp(-t * (0.28 + h * 0.18))
      s += Math.sin(w * h * i) * amps[h - 1] * harmDecay
    }
    out[i] = (s / (norm || 1)) * 0.7 * env
  }
  return out
}

function karplus(hz: number, sr: number, seconds: number, seed: number, inharm = 0.00014): Float32Array {
  const n = Math.floor(sr * seconds)
  const out = new Float32Array(n)
  const delay = sr / (hz * (1 + inharm))
  const di = Math.max(2, Math.floor(delay))
  const frac = delay - di
  const damp = hz > 1500 ? 0.99985 : hz > 600 ? 0.9994 : hz > 250 ? 0.9985 : 0.9965
  const rand = rng(seed)
  for (let i = 0; i < di + 2 && i < n; i += 1) out[i] = rand() * 2 - 1
  for (let i = di; i < n; i += 1) {
    const a = out[i - di]
    const b = out[i - di - 1] ?? a
    out[i] = damp * (a * (1 - frac) + b * frac)
  }
  return out
}

function withNoise(src: Float32Array, amount: number, seed: number): Float32Array {
  const rand = rng(seed)
  const out = new Float32Array(src.length)
  for (let i = 0; i < src.length; i += 1) out[i] = src[i] + (rand() * 2 - 1) * amount
  return out
}

function vibratoTone(hz: number, sr: number, seconds: number, depthCents = 8, rateHz = 5.5): Float32Array {
  const n = Math.floor(sr * seconds)
  const out = new Float32Array(n)
  const amps = hz < 80 ? [0.2, 1, 0.55, 0.28, 0.14] : [0.85, 0.5, 0.28, 0.14, 0.07]
  let norm = 0
  for (const a of amps) norm += a
  let phase = 0
  for (let i = 0; i < n; i += 1) {
    const t = i / sr
    const cents = depthCents * Math.sin(2 * Math.PI * rateHz * t)
    const inst = hz * 2 ** (cents / 1200)
    phase += (2 * Math.PI * inst) / sr
    const env = (1 - Math.exp(-t * 70)) * Math.exp(-t / 1.2)
    let s = 0
    for (let h = 1; h <= amps.length; h += 1) {
      s += Math.sin(phase * h) * amps[h - 1]
    }
    out[i] = (s / norm) * 0.65 * env
  }
  return out
}

function toneFor(kind: Kind, hz: number, sr: number, midi: number): { samples: Float32Array; expected: number } {
  const seconds = hz < 32 ? 1.35 : hz < 80 ? 1.05 : 0.82
  if (kind === 'additive') {
    const amps =
      hz < 55 ? [0.22, 1, 0.6, 0.32, 0.16, 0.08, 0.04] : [0.9, 0.55, 0.3, 0.16, 0.09, 0.05, 0.03]
    return { samples: additive(hz, sr, seconds, amps), expected: hz }
  }
  if (kind === 'weak') {
    const amps = hz < 110 ? [0.03, 1, 0.62, 0.34, 0.18, 0.1, 0.05] : [0.35, 1, 0.5, 0.25, 0.12]
    return { samples: additive(hz, sr, seconds, amps, 55, 1.35), expected: hz }
  }
  if (kind === 'ks') {
    const inharm = 0.00014
    return { samples: karplus(hz, sr, seconds, midi + 17, inharm), expected: hz * (1 + inharm) }
  }
  if (kind === 'noise') {
    const base = additive(
      hz,
      sr,
      seconds,
      hz < 55 ? [0.18, 1, 0.58, 0.3, 0.15] : [0.85, 0.5, 0.28, 0.14],
    )
    return { samples: withNoise(base, hz < 80 ? 0.045 : 0.07, midi + 99), expected: hz }
  }
  if (kind === 'vibrato') {
    return { samples: vibratoTone(hz, sr, seconds), expected: hz }
  }
  const attack = midi % 2 === 0 ? 18 : 140
  return {
    samples: additive(hz, sr, seconds, [0.8, 0.5, 0.28, 0.14, 0.07], attack, 1.0),
    expected: hz,
  }
}

function detectRaw(
  engine: Engine,
  samples: Float32Array,
  sr: number,
  target: number,
): { hz: number; clarity: number } {
  const filtered = filterBuffer(samples, sr)
  const scratch = engine === 'before' ? createBeforeScratch() : createAfterScratch()
  const windowFn = engine === 'before' ? windowBefore : windowAfter
  const estimate = engine === 'before' ? estimateBefore : estimateAfter
  const need = Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, windowFn(target, sr)))
  const extra = target < 40 ? 0.42 : target > 1400 ? 0.12 : 0.26
  const pos = Math.min(filtered.length, Math.max(need, Math.floor(sr * extra)))
  const take = Math.min(pos, MAX_WINDOW)
  const slice = filtered.subarray(pos - take, pos)
  return estimate(slice, take, sr, scratch, null)
}

const toneCache = new Map<string, { samples: Float32Array; expected: number }>()
const hitCache = new Map<string, RawHit>()

function toneCached(kind: Kind, midi: number): { samples: Float32Array; expected: number } {
  const key = `${kind}:${midi}`
  const hit = toneCache.get(key)
  if (hit) return hit
  const made = toneFor(kind, midiToFreq(midi, A4), SR, midi)
  toneCache.set(key, made)
  return made
}

function detectStable(
  samples: Float32Array,
  sr: number,
  target: number,
): { std: number; n: number; median: number } {
  const filtered = filterBuffer(samples, sr)
  const scratch = createAfterScratch()
  const state = createSmoothState()
  let prevHz: number | null = null
  const cents: number[] = []
  const start = Math.min(filtered.length, Math.max(MIN_WINDOW, Math.floor(sr * 0.28)))
  const step = Math.max(HOP, Math.floor(sr * 0.02))
  for (let pos = start; pos < filtered.length; pos += step) {
    const take = Math.min(pos, MAX_WINDOW)
    const slice = filtered.subarray(pos - take, pos)
    const est = estimateAfter(slice, take, sr, scratch, prevHz)
    if (est.frequency > 0) prevHz = est.frequency
    let energy = 0
    const tail = Math.min(512, slice.length)
    for (let i = slice.length - tail; i < slice.length; i += 1) energy += slice[i] * slice[i]
    const signal = Math.sqrt(energy / tail)
    const tMs = (pos / sr) * 1000
    const next = pushEstimate(state, est.frequency, est.clarity, signal, tMs, step / sr)
    if (next.hz && tMs >= 320 && !next.onset) {
      const c = hzCents(next.hz, target)
      if (Number.isFinite(c)) cents.push(c)
    }
  }
  if (cents.length < 3) return { std: Number.NaN, n: cents.length, median: Number.NaN }
  const sorted = [...cents].sort((a, b) => a - b)
  const mid = sorted[Math.floor(sorted.length / 2)] ?? Number.NaN
  const mean = cents.reduce((a, b) => a + b, 0) / cents.length
  const v = cents.reduce((a, b) => a + (b - mean) ** 2, 0) / (cents.length - 1)
  return { std: Math.sqrt(v), n: cents.length, median: mid }
}

function summarize(hits: RawHit[]) {
  const voiced = hits.filter((h) => h.voiced)
  const n = voiced.length
  const within = (c: number) => voiced.filter((h) => Math.abs(h.cents) <= c).length
  const oct = voiced.filter((h) => h.octaveError).length
  const miss = hits.length - n
  return {
    n: hits.length,
    voiced: n,
    miss,
    pct1: n ? (100 * within(1)) / n : 0,
    pct5: n ? (100 * within(5)) / n : 0,
    pct10: n ? (100 * within(10)) / n : 0,
    octavePct: n ? (100 * oct) / n : 100,
    octaveN: oct,
  }
}

function fmtPct(x: number): string {
  return `${x.toFixed(1)}%`
}

function runRaw(engine: Engine, midi: number, kind: Kind): RawHit {
  const key = `${engine}:${kind}:${midi}`
  const cached = hitCache.get(key)
  if (cached) return cached
  const { samples, expected } = toneCached(kind, midi)
  const got = detectRaw(engine, samples, SR, expected)
  const cents = hzCents(got.frequency, expected)
  const voiced = got.frequency > 0 && Number.isFinite(cents)
  const octaveError = voiced && Math.abs(cents) >= 1100
  const row: RawHit = {
    engine,
    midi,
    name: noteName(midi),
    kind,
    hz: expected,
    detected: got.frequency,
    cents: voiced ? cents : Number.NaN,
    octaveError,
    voiced,
  }
  hitCache.set(key, row)
  return row
}

const CHROMATIC_KINDS: Kind[] = ['additive', 'weak', 'ks', 'noise', 'vibrato', 'attack']
const STRING_KINDS: Kind[] = ['additive', 'weak', 'ks']

function main() {
  const t0 = Date.now()
  const chromatic: RawHit[] = []
  const strings: RawHit[] = []

  for (let midi = MIDI_LO; midi <= MIDI_HI; midi += 1) {
    for (const kind of CHROMATIC_KINDS) {
      chromatic.push(runRaw('before', midi, kind))
      chromatic.push(runRaw('after', midi, kind))
    }
    if ((midi - MIDI_LO) % 12 === 0) {
      console.error(`… chromatic ${noteName(midi)}`)
    }
  }

  let stringCount = 0
  for (const preset of BUILTIN_PRESETS) {
    for (const string of preset.strings) {
      stringCount += 1
      for (const kind of STRING_KINDS) {
        strings.push(runRaw('before', string.midi, kind))
        strings.push(runRaw('after', string.midi, kind))
      }
    }
  }

  const sustainNotes = [16, 28, 40, 45, 64, 69, 88, 108]
  const stability: Array<{ name: string; std: number; median: number; n: number }> = []
  for (const midi of sustainNotes) {
    const hz = midiToFreq(midi, A4)
    const { samples, expected } = toneFor('additive', hz, SR, midi)
    const row = detectStable(samples, SR, expected)
    stability.push({ name: noteName(midi), ...row })
  }

  // +5¢ sine must not pull toward 0.
  let snapFails = 0
  for (const midi of [40, 45, 64, 28, 16]) {
    const hz = midiToFreq(midi, A4) * 2 ** (5 / 1200)
    const tone = additive(hz, SR, 0.9, [0.9, 0.5, 0.28, 0.14])
    const got = detectRaw('after', tone, SR, hz)
    const c = hzCents(got.frequency, midiToFreq(midi, A4))
    // Pulled toward 0¢ if the reading is closer to center than the true +5¢.
    if (got.frequency > 0 && Math.abs(c) + 1.5 < 5) snapFails += 1
    if (!(got.frequency > 0 && Math.abs(c - 5) <= 4)) snapFails += 1
  }

  const beforeC = summarize(chromatic.filter((h) => h.engine === 'before'))
  const afterC = summarize(chromatic.filter((h) => h.engine === 'after'))
  const beforeS = summarize(strings.filter((h) => h.engine === 'before'))
  const afterS = summarize(strings.filter((h) => h.engine === 'after'))

  const afterStringFail = strings.filter(
    (h) => h.engine === 'after' && (!h.voiced || Math.abs(h.cents) > 10 || h.octaveError),
  )

  console.log('Tuner accuracy  (raw FastYIN+HPS vs frozen MPM)  @ 48 kHz, A4=440')
  console.log(`Chromatic E0–C8 (${MIDI_HI - MIDI_LO + 1} notes × ${CHROMATIC_KINDS.length} kinds)`)
  console.log(
    `  before  within 1¢ ${fmtPct(beforeC.pct1)}   5¢ ${fmtPct(beforeC.pct5)}   10¢ ${fmtPct(beforeC.pct10)}   octave ${fmtPct(beforeC.octavePct)} (${beforeC.octaveN})   unvoiced ${beforeC.miss}/${beforeC.n}`,
  )
  console.log(
    `  after   within 1¢ ${fmtPct(afterC.pct1)}   5¢ ${fmtPct(afterC.pct5)}   10¢ ${fmtPct(afterC.pct10)}   octave ${fmtPct(afterC.octavePct)} (${afterC.octaveN})   unvoiced ${afterC.miss}/${afterC.n}`,
  )
  console.log(`Preset strings (${stringCount} strings × ${STRING_KINDS.length} kinds)`)
  console.log(
    `  before  within 1¢ ${fmtPct(beforeS.pct1)}   5¢ ${fmtPct(beforeS.pct5)}   10¢ ${fmtPct(beforeS.pct10)}   octave ${fmtPct(beforeS.octavePct)} (${beforeS.octaveN})   unvoiced ${beforeS.miss}/${beforeS.n}`,
  )
  console.log(
    `  after   within 1¢ ${fmtPct(afterS.pct1)}   5¢ ${fmtPct(afterS.pct5)}   10¢ ${fmtPct(afterS.pct10)}   octave ${fmtPct(afterS.octavePct)} (${afterS.octaveN})   unvoiced ${afterS.miss}/${afterS.n}`,
  )
  console.log('Sustain stability after (median + light exp, additive):')
  for (const row of stability) {
    console.log(
      `  ${row.name.padEnd(4)}  median ${Number.isFinite(row.median) ? row.median.toFixed(2) : '—'}¢  std ${Number.isFinite(row.std) ? row.std.toFixed(2) : '—'}¢  n ${row.n}`,
    )
  }
  console.log(`No snap-toward-center (+5¢): ${snapFails === 0 ? 'ok' : `${snapFails} fail(s)`}`)
  console.log(`${Date.now() - t0}ms`)

  const afterOct = afterC.octaveN + afterS.octaveN
  const worst = [...chromatic, ...strings]
    .filter((h) => h.engine === 'after' && (!h.voiced || Math.abs(h.cents) > 10))
    .sort((a, b) => (Math.abs(b.cents) || 9999) - (Math.abs(a.cents) || 9999))
    .slice(0, 16)
  if (worst.length) {
    console.log('\nWorst after failures:')
    for (const row of worst) {
      console.log(
        `  ${row.kind} ${row.name} → ${row.voiced ? `${row.cents.toFixed(1)}¢` : 'unvoiced'} (${row.detected.toFixed(2)} Hz, want ${row.hz.toFixed(2)})`,
      )
    }
  }

  const additiveAfter = summarize(chromatic.filter((h) => h.engine === 'after' && h.kind === 'additive'))
  const stableFail = stability.filter(
    (row) => !Number.isFinite(row.std) || row.std > 1.5 || Math.abs(row.median) > 5,
  )
  const stringRegress = stringCount !== 550 || afterStringFail.length > 0
  const fail =
    snapFails > 0 ||
    afterOct > 0 ||
    afterC.pct10 < 92 ||
    additiveAfter.pct5 < 90 ||
    stringRegress ||
    stableFail.length > 0

  if (stringCount !== 550) {
    console.error(`string count ${stringCount} != 550`)
  }
  if (afterStringFail.length) {
    console.error(`${afterStringFail.length} preset-string case(s) outside 10¢ or octave/unvoiced`)
  }
  if (fail) {
    process.exitCode = 1
    console.error('\nAccuracy harness failed.')
  } else {
    console.log('\nAll accuracy checks passed.')
  }
}

const isMain = process.argv[1]?.includes('tuner-accuracy')
if (isMain) main()
