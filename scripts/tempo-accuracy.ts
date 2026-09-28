import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  detectTempo,
  synthesizeClickTrack,
  synthesizeDrumLoop,
} from '../src/lib/tempo-detect.ts'

const SR = 44100
const BPMS = [70, 92, 120, 128, 140, 174] as const

function centsTempo(detected: number, truth: number): number {
  return 1200 * Math.log2(detected / truth)
}

function octaveOff(detected: number, truth: number): boolean {
  const r = detected / truth
  return Math.abs(r - 2) < 0.06 || Math.abs(r - 0.5) < 0.06
}

function hit(detected: number, truth: number, tol = 1.6): boolean {
  return Math.abs(detected - truth) <= tol
}

function decodeF32le(path: string, channels: number): Float32Array {
  const raw = readFileSync(path)
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  const frames = Math.floor(raw.length / 4 / channels)
  const mono = new Float32Array(frames)
  for (let i = 0; i < frames; i += 1) {
    let s = 0
    for (let c = 0; c < channels; c += 1) s += view.getFloat32((i * channels + c) * 4, true)
    mono[i] = s / channels
  }
  return mono
}

function loadM4aMono(file: string, rate = SR): Float32Array {
  const dir = mkdtempSync(join(tmpdir(), 'omni-tempo-'))
  const out = join(dir, 's.f32')
  try {
    execFileSync(
      'ffmpeg',
      ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-y', out],
      { stdio: 'pipe' },
    )
    return decodeF32le(out, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function mixCrocellLoop(bpm: number, seconds: number): Float32Array | null {
  const kickPath = 'public/rhythm/drums/crocell/kick/t4_rr1.m4a'
  const snarePath = 'public/rhythm/drums/crocell/snare_snappy_p2/t4_rr1.m4a'
  const hatPath = 'public/rhythm/drums/crocell/hihat_closed/t3_rr1.m4a'
  let kick: Float32Array
  let snare: Float32Array
  let hat: Float32Array
  try {
    kick = loadM4aMono(kickPath)
    snare = loadM4aMono(snarePath)
    hat = loadM4aMono(hatPath)
  } catch {
    return null
  }
  const n = Math.floor(SR * seconds)
  const out = new Float32Array(n)
  const beat = 60 / bpm
  const stamp = (src: Float32Array, atSec: number, gain: number) => {
    const at = Math.floor(atSec * SR)
    for (let i = 0; i < src.length && at + i < n; i += 1) out[at + i] += src[i] * gain
  }
  for (let t = 0; t < seconds; t += beat) {
    const beatI = Math.round(t / beat) % 4
    stamp(kick, t, beatI === 0 || beatI === 2 ? 1 : 0.15)
    if (beatI === 1 || beatI === 3) stamp(snare, t, 0.9)
    stamp(hat, t, 0.22)
    stamp(hat, t + beat * 0.5, 0.14)
  }
  let peak = 1e-6
  for (let i = 0; i < n; i += 1) peak = Math.max(peak, Math.abs(out[i]))
  const g = 0.7 / peak
  for (let i = 0; i < n; i += 1) out[i] *= g
  return out
}

let failed = 0
let octaveErrors = 0
let total = 0

function report(ok: boolean, octave: boolean, label: string, extra: string) {
  total += 1
  if (!ok) failed += 1
  if (octave) octaveErrors += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}  ${extra}${octave ? '  OCTAVE' : ''}`)
}

function check(label: string, samples: Float32Array, sr: number, truth: number, tol = 1.6) {
  const est = detectTempo(samples, sr)
  if (!est) {
    report(false, false, label, 'no estimate')
    return
  }
  const oct = octaveOff(est.bpm, truth)
  const ok = hit(est.bpm, truth, tol) || hit(est.bpmExact, truth, tol)
  report(
    ok,
    oct,
    label,
    `got ${est.bpm} (${est.bpmExact.toFixed(1)})  truth ${truth}  conf ${est.confidence.toFixed(2)}`,
  )
}

console.log('==== click tracks ====')
for (const bpm of BPMS) {
  check(`click ${bpm}`, synthesizeClickTrack(bpm, SR, 8), SR, bpm, 1.1)
}

console.log('\n==== synthetic rock drums ====')
for (const bpm of BPMS) {
  check(`rock ${bpm}`, synthesizeDrumLoop(bpm, SR, 9, 'rock'), SR, bpm, 2)
}

console.log('\n==== four-on-the-floor ====')
for (const bpm of [120, 128, 140]) {
  check(`four ${bpm}`, synthesizeDrumLoop(bpm, SR, 8, 'four'), SR, bpm, 2)
}

console.log('\n==== shuffle / swing ====')
for (const bpm of [92, 120, 140]) {
  check(`synth shuffle ${bpm}`, synthesizeDrumLoop(bpm, SR, 10, 'shuffle'), SR, bpm, 2.5)
  check(`click swing ${bpm}`, synthesizeClickTrack(bpm, SR, 9, 0.3), SR, bpm, 2.5)
}

console.log('\n==== CrocellKit loops (real samples) ====')
let mixed = 0
for (const bpm of BPMS) {
  const loop = mixCrocellLoop(bpm, 10)
  if (!loop) {
    console.log(`skip crocell ${bpm} (ffmpeg/m4a unavailable)`)
    continue
  }
  mixed += 1
  check(`crocell ${bpm}`, loop, SR, bpm, 2)
}
if (mixed === 0) console.log('No Crocell mixes — ffmpeg could not decode m4a')

console.log('\n==== short / noisy edges ====')
check('click 120 @ 3.5s', synthesizeClickTrack(120, SR, 3.5), SR, 120, 1.5)
check('rock 174 @ 6s', synthesizeDrumLoop(174, SR, 6, 'rock'), SR, 174, 2.5)

console.log('\n==== music-like (drums + bass notes) ====')
for (const bpm of [92, 128, 140] as const) {
  const drums = synthesizeDrumLoop(bpm, SR, 10, 'rock')
  const beat = 60 / bpm
  for (let t = 0; t < 10; t += beat) {
    const at = Math.floor(t * SR)
    const freq = t / beat % 4 < 2 ? 73 : 98
    for (let k = 0; k < SR * 0.22 && at + k < drums.length; k += 1) {
      const env = Math.exp(-k / SR * 8)
      drums[at + k] += 0.22 * env * Math.sin((2 * Math.PI * freq * k) / SR)
    }
  }
  check(`music ${bpm}`, drums, SR, bpm, 2.5)
}

console.log(`\n${total - failed}/${total} passed  ·  octave errors ${octaveErrors}`)
if (failed) {
  console.error(`${failed} case(s) failed`)
  process.exit(1)
}
console.log('All tempo checks passed.')
