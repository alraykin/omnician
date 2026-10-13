/**
 * Tuner calibration harness.
 * Synthesizes sine + plucked-string tones (including missing-fundamental bass)
 * for every semitone B0–E6 at several cent offsets and A4 references, then
 * runs the live detector pipeline (same filter, windows, hops, sample rates).
 */
import { writeFileSync } from 'node:fs'

import {
  HOP,
  MAX_WINDOW,
  MIN_WINDOW,
  createPitchScratch,
  estimateFromFilled,
} from '../src/lib/mpm.ts'
import { analyzeFrequency, midiToFreq, nearestString, pitchClassName } from '../src/lib/notes.ts'
import { filterBuffer } from '../src/lib/pitch-filter.ts'
import { createSmoothState, pushEstimate } from '../src/lib/pitch-smooth.ts'
import { BUILTIN_PRESETS } from '../src/lib/presets.ts'

export const MIDI_LO = 23 // B0
export const MIDI_HI = 88 // E6
export const OFFSETS = [-50, -20, -5, 0, 5, 20, 50] as const
export const A4S = [432, 440, 444] as const
export const RATES = [44100, 48000] as const
export const KINDS = ['sine', 'pluck'] as const

export const SINE_LIMIT = 1
export const PLUCK_LIMIT = 2

export type SignalKind = (typeof KINDS)[number]

export type CalCase = {
  midi: number
  name: string
  offset: number
  a4: number
  rate: number
  kind: SignalKind
  expectedHz: number
}

export type CalResult = CalCase & {
  detectedHz: number
  errorCents: number
  noteName: string
  expectedName: string
  nameOk: boolean
  ok: boolean
}

export type RangeRow = {
  range: string
  midiLo: number
  midiHi: number
  sineMax: number
  pluckMax: number
  sineFails: number
  pluckFails: number
  nameFails: number
  n: number
}

const RANGES: Array<{ range: string; midiLo: number; midiHi: number }> = [
  { range: 'B0–D♯1 (sub-bass)', midiLo: 23, midiHi: 27 },
  { range: 'E1–B1 (bass)', midiLo: 28, midiHi: 35 },
  { range: 'C2–B2 (low guitar)', midiLo: 36, midiHi: 47 },
  { range: 'C3–B3 (mid)', midiLo: 48, midiHi: 59 },
  { range: 'C4–B4 (treble)', midiLo: 60, midiHi: 71 },
  { range: 'C5–E6 (high)', midiLo: 72, midiHi: 88 },
]

function noteName(midi: number): string {
  const pitch = pitchClassName(midi)
  return `${pitch.sharpName}${pitch.octave}`
}

function cents(hz: number, target: number): number {
  if (!(hz > 0) || !(target > 0)) return Number.NaN
  return 1200 * Math.log2(hz / target)
}

function sineTone(hz: number, sr: number, seconds: number): Float32Array {
  const n = Math.floor(sr * seconds)
  const out = new Float32Array(n)
  const w = (2 * Math.PI * hz) / sr
  for (let i = 0; i < n; i += 1) out[i] = Math.sin(w * i) * 0.72
  return out
}

/** Plucked string: exponential decay + strong partials. Low notes omit the fundamental. */
function pluckTone(hz: number, sr: number, seconds: number): Float32Array {
  const n = Math.floor(sr * seconds)
  const out = new Float32Array(n)
  const missingFund = hz < 55
  const amps = missingFund
    ? [0.035, 1, 0.64, 0.36, 0.2, 0.11, 0.06]
    : hz < 110
      ? [0.22, 1, 0.58, 0.3, 0.16, 0.08, 0.04]
      : [0.82, 0.52, 0.3, 0.16, 0.09, 0.05, 0.03]
  let norm = 0
  for (const a of amps) norm += a
  const w = (2 * Math.PI * hz) / sr
  for (let i = 0; i < n; i += 1) {
    const t = i / sr
    const env = (1 - Math.exp(-t * 90)) * Math.exp(-t / 0.85)
    let s = 0
    for (let h = 1; h <= amps.length; h += 1) {
      const decay = Math.exp(-t * (0.35 + h * 0.22))
      s += Math.sin(w * h * i) * amps[h - 1] * decay
    }
    out[i] = (s / norm) * 0.7 * env
  }
  return out
}

export function detectHz(samples: Float32Array, sr: number): number {
  const filtered = filterBuffer(samples, sr)
  const scratch = createPitchScratch()
  const state = createSmoothState()
  let prevHz: number | null = null
  const readings: number[] = []
  const last = filtered.length
  const start = Math.min(last, Math.max(MIN_WINDOW, Math.floor(sr * 0.3)))
  const step = Math.max(HOP, Math.floor(sr * 0.04))
  const positions: number[] = []
  for (let pos = start; pos < last; pos += step) positions.push(pos)
  positions.push(last)
  for (const pos of positions) {
    const take = Math.min(pos, MAX_WINDOW)
    const slice = filtered.subarray(pos - take, pos)
    const estimate = estimateFromFilled(slice, take, sr, scratch, prevHz)
    if (estimate.frequency > 0) prevHz = estimate.frequency
    let energy = 0
    const tail = Math.min(512, slice.length)
    for (let i = slice.length - tail; i < slice.length; i += 1) energy += slice[i] * slice[i]
    const signal = Math.sqrt(energy / tail)
    const tMs = (pos / sr) * 1000
    const next = pushEstimate(state, estimate.frequency, estimate.clarity, signal, tMs, step / sr)
    if (next.hz && tMs >= 280) readings.push(next.hz)
  }
  if (readings.length === 0) return 0
  const sorted = [...readings].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

export function enumerateCases(opts?: { quick?: boolean }): CalCase[] {
  const cases: CalCase[] = []
  const midis: number[] = []
  if (opts?.quick) {
    for (const midi of [23, 26, 28, 35, 40, 45, 52, 59, 64, 69, 76, 81, 88]) midis.push(midi)
  } else {
    for (let midi = MIDI_LO; midi <= MIDI_HI; midi += 1) midis.push(midi)
  }
  const a4s = opts?.quick ? ([440, 432] as const) : A4S
  const rates = opts?.quick ? ([48000, 44100] as const) : RATES
  const offsets = opts?.quick ? ([-50, -20, 0, 5, 50] as const) : OFFSETS
  for (const midi of midis) {
    for (const offset of offsets) {
      for (const a4 of a4s) {
        for (const rate of rates) {
          for (const kind of KINDS) {
            const expectedHz = midiToFreq(midi, a4) * 2 ** (offset / 1200)
            cases.push({
              midi,
              name: noteName(midi),
              offset,
              a4,
              rate,
              kind,
              expectedHz,
            })
          }
        }
      }
    }
  }
  return cases
}

const toneCache = new Map<string, Float32Array>()

function toneFor(kind: SignalKind, hz: number, rate: number): Float32Array {
  const key = `${kind}:${rate}:${hz.toFixed(6)}`
  const hit = toneCache.get(key)
  if (hit) return hit
  const seconds = hz < 40 ? 0.95 : hz < 80 ? 0.75 : 0.58
  const tone = kind === 'sine' ? sineTone(hz, rate, seconds) : pluckTone(hz, rate, seconds)
  toneCache.set(key, tone)
  return tone
}

export function runCase(item: CalCase): CalResult {
  const tone = toneFor(item.kind, item.expectedHz, item.rate)
  const detectedHz = detectHz(tone, item.rate)
  const errorCents = cents(detectedHz, item.expectedHz)
  const expected = analyzeFrequency(item.expectedHz, item.a4)
  const got = detectedHz > 0 ? analyzeFrequency(detectedHz, item.a4) : null
  const expectedName = `${expected.sharpName}${expected.octave}`
  const noteNameGot = got ? `${got.sharpName}${got.octave}` : '—'
  const limit = item.kind === 'sine' ? SINE_LIMIT : PLUCK_LIMIT
  const freqOk = Number.isFinite(errorCents) && Math.abs(errorCents) <= limit
  const boundary = Math.abs(item.offset) === 50
  const nameOk =
    got !== null &&
    (got.midi === expected.midi || (boundary && Math.abs(got.midi - expected.midi) <= 1))
  return {
    ...item,
    detectedHz,
    errorCents,
    noteName: noteNameGot,
    expectedName,
    nameOk,
    ok: freqOk && nameOk,
  }
}

export function summarize(results: readonly CalResult[]): RangeRow[] {
  return RANGES.map((band) => {
    const rows = results.filter((row) => row.midi >= band.midiLo && row.midi <= band.midiHi)
    const sines = rows.filter((row) => row.kind === 'sine')
    const plucks = rows.filter((row) => row.kind === 'pluck')
    const maxAbs = (list: CalResult[]) =>
      list.reduce((max, row) => {
        const err = Math.abs(row.errorCents)
        return Number.isFinite(err) ? Math.max(max, err) : Math.max(max, 999)
      }, 0)
    return {
      ...band,
      sineMax: maxAbs(sines),
      pluckMax: maxAbs(plucks),
      sineFails: sines.filter((row) => !row.ok).length,
      pluckFails: plucks.filter((row) => !row.ok).length,
      nameFails: rows.filter((row) => !row.nameOk).length,
      n: rows.length,
    }
  })
}

export function formatTable(rows: readonly RangeRow[], label: string): string {
  const lines = [
    `${label}`,
    `| Range | Sine max ¢ | Pluck max ¢ | Sine fails | Pluck fails | Name fails | N |`,
    `| --- | ---: | ---: | ---: | ---: | ---: | ---: |`,
  ]
  for (const row of rows) {
    lines.push(
      `| ${row.range} | ${row.sineMax.toFixed(2)} | ${row.pluckMax.toFixed(2)} | ${row.sineFails} | ${row.pluckFails} | ${row.nameFails} | ${row.n} |`,
    )
  }
  return lines.join('\n')
}

export function checkStringMapping(): { ok: boolean; fails: string[] } {
  const fails: string[] = []
  for (const preset of BUILTIN_PRESETS) {
    if (preset.strings.length === 0) continue
    for (const a4 of A4S) {
      for (const string of preset.strings) {
        for (const offset of [0, -20, 20, -5, 5] as const) {
          const hz = midiToFreq(string.midi, a4) * 2 ** (offset / 1200)
          const nearest = nearestString(hz, preset.strings, a4)
          if (nearest.midi !== string.midi) {
            fails.push(
              `${preset.id} ${string.label}${string.octave} @ A4=${a4} ${offset >= 0 ? '+' : ''}${offset}¢ → ${nearest.label}${nearest.octave}`,
            )
          }
        }
      }
    }
  }
  return { ok: fails.length === 0, fails }
}

function main() {
  const quick = process.argv.includes('--quick')
  const save = process.argv.find((arg) => arg.startsWith('--save='))?.slice(7)
  const cases = enumerateCases({ quick })
  const results: CalResult[] = []
  const t0 = Date.now()
  let done = 0
  const detectedCache = new Map<string, number>()
  for (const item of cases) {
    const key = `${item.kind}:${item.rate}:${item.expectedHz.toFixed(6)}`
    let detectedHz = detectedCache.get(key)
    if (detectedHz === undefined) {
      detectedHz = runCase(item).detectedHz
      detectedCache.set(key, detectedHz)
    }
    const errorCents = cents(detectedHz, item.expectedHz)
    const expected = analyzeFrequency(item.expectedHz, item.a4)
    const got = detectedHz > 0 ? analyzeFrequency(detectedHz, item.a4) : null
    const expectedName = `${expected.sharpName}${expected.octave}`
    const noteNameGot = got ? `${got.sharpName}${got.octave}` : '—'
    const limit = item.kind === 'sine' ? SINE_LIMIT : PLUCK_LIMIT
    const freqOk = Number.isFinite(errorCents) && Math.abs(errorCents) <= limit
    const boundary = Math.abs(item.offset) === 50
    const nameOk =
      got !== null &&
      (got.midi === expected.midi || (boundary && Math.abs(got.midi - expected.midi) <= 1))
    results.push({
      ...item,
      detectedHz,
      errorCents,
      noteName: noteNameGot,
      expectedName,
      nameOk,
      ok: freqOk && nameOk,
    })
    done += 1
    if (done % 200 === 0) {
      console.error(`… ${done}/${cases.length}`)
    }
  }

  const rows = summarize(results)
  const fails = results.filter((row) => !row.ok)
  console.log(formatTable(rows, quick ? 'QUICK calibration' : 'Full calibration'))
  console.log(`\n${results.length} cases, ${fails.length} failures, ${Date.now() - t0}ms`)

  const mapping = checkStringMapping()
  if (!mapping.ok) {
    console.log(`\nString-target mapping failures (${mapping.fails.length}):`)
    for (const line of mapping.fails.slice(0, 20)) console.log(`  ${line}`)
  } else {
    console.log('\nString-target mapping: all builtin strings @ 432/440/444 ±5/20¢ ok')
  }

  if (fails.length) {
    console.log('\nWorst failures:')
    const worst = [...fails].sort((a, b) => Math.abs(b.errorCents) - Math.abs(a.errorCents) || 0)
    for (const row of worst.slice(0, 24)) {
      console.log(
        `  ${row.kind} ${row.name} ${row.offset >= 0 ? '+' : ''}${row.offset}¢ A4=${row.a4} ${row.rate} → ${row.errorCents.toFixed(2)}¢ ${row.noteName} (want ${row.expectedName})`,
      )
    }
  }

  const snap = { rows, fails: fails.length, total: results.length, mappingOk: mapping.ok }
  if (save) {
    writeFileSync(save, JSON.stringify({ ...snap, results }, null, 2))
    console.log(`\nWrote ${save}`)
  }

  const snapToward = results.filter((row) => {
    if (row.offset === 0 || !Number.isFinite(row.errorCents)) return false
    const vsCenter = row.errorCents + row.offset
    return Math.abs(vsCenter) < Math.abs(row.offset) - 1.5 && Math.abs(row.errorCents) > (row.kind === 'sine' ? 1 : 2)
  })
  if (snapToward.length) {
    console.log(`\nSnap-toward-center failures: ${snapToward.length}`)
    for (const row of snapToward.slice(0, 8)) {
      console.log(
        `  ${row.kind} ${row.name} ${row.offset >= 0 ? '+' : ''}${row.offset}¢ read ${row.errorCents.toFixed(2)}¢ (pulled inward)`,
      )
    }
  }

  if (fails.length || !mapping.ok) {
    process.exitCode = 1
  } else {
    console.log('\nAll calibration checks passed.')
  }
}

const isMain = process.argv[1]?.includes('tuner-calibration')
if (isMain) main()
