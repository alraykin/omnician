/**
 * Render Crocell hits and a Rock groove at Low / Mid / High, then measure
 * RMS and LUFS. Used to set INTENSITY_LOUDNESS_COMP so Mid/Low match High.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  INTENSITY_STRENGTH,
  KIT_INTENSITIES,
  playOptsForRole,
  type KitIntensity,
} from '../src/lib/kit-intensity.ts'
import { realizeDrumBar } from '../src/lib/kit-intensity-play.ts'
import { SAMPLE_GAIN, VOICE_PIECE } from '../src/lib/kit-samples.ts'
import { hitTimeInBar, type VoiceId } from '../src/lib/rhythm.ts'
import { barsForPreset, findPreset } from '../src/lib/rhythm-presets.ts'

const RATE = 44100
const ROOT = new URL('../public/rhythm/drums/crocell/', import.meta.url)

const PIECES: VoiceId[] = ['kick', 'snare', 'closedHat', 'openHat', 'ride', 'crash', 'highTom', 'floorTom']

type CrocellFile = { piece: string; tier: number; rr: number; file: string }

const cache = new Map<string, Float32Array>()

function fileUrl(name: string): string {
  return new URL(name, ROOT).pathname
}

function decodeM4a(file: string): Promise<Float32Array> {
  const hit = cache.get(file)
  if (hit) return Promise.resolve(hit)
  return new Promise((resolve, reject) => {
    const ff = spawn(
      'ffmpeg',
      ['-v', 'error', '-i', fileUrl(file), '-ac', '2', '-ar', String(RATE), '-f', 'f32le', 'pipe:1'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const chunks: Buffer[] = []
    ff.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    let err = ''
    ff.stderr.on('data', (chunk: Buffer) => {
      err += chunk.toString()
    })
    ff.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg ${file}: ${err || code}`))
        return
      }
      const raw = Buffer.concat(chunks)
      const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
      cache.set(file, samples)
      resolve(samples)
    })
  })
}

function rmsDb(samples: Float32Array): number {
  if (samples.length === 0) return -120
  let sum = 0
  for (let i = 0; i < samples.length; i += 1) sum += (samples[i] ?? 0) ** 2
  const rms = Math.sqrt(sum / samples.length)
  return 20 * Math.log10(Math.max(rms, 1e-9))
}

function writeWav16(path: string, stereo: Float32Array): void {
  const frames = stereo.length / 2
  const data = Buffer.alloc(frames * 4)
  for (let i = 0; i < stereo.length; i += 1) {
    const x = Math.max(-1, Math.min(1, stereo[i] ?? 0))
    data.writeInt16LE(Math.round(x * 32767), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(2, 22)
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 4, 28)
  header.writeUInt16LE(4, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  writeFileSync(path, Buffer.concat([header, data]))
}

function ebur128Lufs(stereo: Float32Array): Promise<number | null> {
  const dir = join(tmpdir(), 'omnician-intensity')
  mkdirSync(dir, { recursive: true })
  const wav = join(dir, `clip-${stereo.length}.wav`)
  writeWav16(wav, stereo)
  return new Promise((resolve) => {
    const ff = spawn(
      'ffmpeg',
      ['-v', 'info', '-i', wav, '-af', 'ebur128=framelog=verbose', '-f', 'null', '-'],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )
    let log = ''
    ff.stderr.on('data', (chunk: Buffer) => {
      log += chunk.toString()
    })
    ff.on('close', () => {
      const lines = log.split('\n').filter((line) => /I:\s+-?\d/.test(line))
      const last = lines.at(-1)
      const match = last?.match(/I:\s+(-?\d+(?:\.\d+)?)/)
      resolve(match ? Number(match[1]) : null)
    })
  })
}

function mixInto(dest: Float32Array, src: Float32Array, startFrame: number, gain: number): void {
  const offset = startFrame * 2
  const n = Math.min(src.length, dest.length - offset)
  for (let i = 0; i < n; i += 1) dest[offset + i] = (dest[offset + i] ?? 0) + (src[i] ?? 0) * gain
}

async function loadManifest(): Promise<CrocellFile[]> {
  const { readFileSync } = await import('node:fs')
  const raw = JSON.parse(readFileSync(new URL('manifest.json', ROOT), 'utf8')) as { files: CrocellFile[] }
  return raw.files
}

function pickFile(files: CrocellFile[], piece: string, tier: number): CrocellFile | undefined {
  return files.find((row) => row.piece === piece && row.tier === tier && row.rr === 1)
}

async function renderLayers(
  files: CrocellFile[],
  piece: string,
  tier: number,
  blendTier: number | undefined,
  blendMix: number,
  gain: number,
  dest: Float32Array,
  startFrame: number,
): Promise<void> {
  const a = pickFile(files, piece, tier)
  if (!a) return
  const bufA = await decodeM4a(a.file)
  if (!blendTier || blendMix <= 0.001) {
    mixInto(dest, bufA, startFrame, gain)
    return
  }
  const b = pickFile(files, piece, blendTier)
  mixInto(dest, bufA, startFrame, gain * (1 - blendMix))
  if (b) mixInto(dest, await decodeM4a(b.file), startFrame, gain * blendMix)
}

async function renderHit(files: CrocellFile[], voice: VoiceId, intensity: KitIntensity): Promise<Float32Array> {
  const role = voice === 'snare' ? 'backbeat' : 'normal'
  const opts = playOptsForRole(intensity, role)
  const piece = VOICE_PIECE[voice]
  const dest = new Float32Array(RATE * 2 * 2)
  const sampleGain = SAMPLE_GAIN[voice] ?? 1
  await renderLayers(files, piece, opts.tier, opts.blendTier, opts.blendMix, sampleGain * opts.vel, dest, 0)
  return dest
}

async function renderGroove(files: CrocellFile[], intensity: KitIntensity): Promise<Float32Array> {
  const preset = findPreset('rock-44')
  if (!preset) throw new Error('rock-44')
  const bar = barsForPreset(preset)[0]
  if (!bar) throw new Error('rock bar')
  const realized = realizeDrumBar(bar, intensity)
  const last = realized.hits.reduce((max, hit) => Math.max(max, hitTimeInBar(hit.hit, 120, bar.beatUnit)), 0)
  const dest = new Float32Array(Math.ceil((last + 2.4) * RATE) * 2)
  for (const ev of realized.hits) {
    const piece = VOICE_PIECE[ev.voice]
    const start = Math.round(hitTimeInBar(ev.hit, 120, bar.beatUnit) * RATE)
    const sampleGain = SAMPLE_GAIN[ev.voice] ?? 1
    await renderLayers(files, piece, ev.tier, ev.blendTier, ev.blendMix, sampleGain * ev.vel, dest, start)
  }
  return dest
}

function dbDelta(a: number, b: number): number {
  return a - b
}

async function main(): Promise<void> {
  const files = await loadManifest()
  const rows: Array<{
    name: string
    level: KitIntensity
    rms: number
    lufs: number | null
  }> = []

  for (const voice of PIECES) {
    const byLevel: Partial<Record<KitIntensity, number>> = {}
    for (const level of KIT_INTENSITIES) {
      const buf = await renderHit(files, voice, level)
      const rms = rmsDb(buf)
      byLevel[level] = rms
      rows.push({ name: voice, level, rms, lufs: null })
    }
    const high = byLevel.high ?? 0
    for (const level of KIT_INTENSITIES) {
      const rms = byLevel[level] ?? 0
      console.log(
        `${voice.padEnd(10)} ${level.padEnd(5)}  RMS ${rms.toFixed(2)} dB   vs High ${dbDelta(rms, high).toFixed(2)} dB`,
      )
    }
  }

  console.log('--- Backbeat groove @ 120 ---')
  const groove: Partial<Record<KitIntensity, { rms: number; lufs: number | null }>> = {}
  for (const level of KIT_INTENSITIES) {
    const buf = await renderGroove(files, level)
    const rms = rmsDb(buf)
    const lufs = await ebur128Lufs(buf)
    groove[level] = { rms, lufs }
    console.log(
      `groove     ${level.padEnd(5)}  RMS ${rms.toFixed(2)} dB   LUFS ${lufs?.toFixed(1) ?? '—'}   strength ${INTENSITY_STRENGTH[level]}`,
    )
  }
  const high = groove.high
  if (high) {
    for (const level of KIT_INTENSITIES) {
      const row = groove[level]
      if (!row) continue
      const rmsDelta = dbDelta(row.rms, high.rms)
      const lufsDelta = row.lufs != null && high.lufs != null ? dbDelta(row.lufs, high.lufs) : null
      const suggest = 10 ** (-rmsDelta / 20)
      console.log(
        `vs High    ${level.padEnd(5)}  RMS ${rmsDelta >= 0 ? '+' : ''}${rmsDelta.toFixed(2)} dB   LUFS ${
          lufsDelta == null ? '—' : `${lufsDelta >= 0 ? '+' : ''}${lufsDelta.toFixed(2)} dB`
        }   gain× ${suggest.toFixed(3)}`,
      )
      if (process.argv.includes('--assert') && level !== 'high') {
        const worst = Math.max(Math.abs(rmsDelta), lufsDelta == null ? 0 : Math.abs(lufsDelta))
        if (worst > 0.5) {
          throw new Error(`${level} vs High is ${worst.toFixed(2)} dB (need ≤ 0.5)`)
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
