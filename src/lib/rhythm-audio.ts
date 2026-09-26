import {
  DEFAULT_KIT_INTENSITY,
  resolveTier,
  useRimshotBackbeat,
  type HitRole,
  type KitIntensity,
} from '@/lib/kit-intensity'
import { DEFAULT_KIT_MIX, KIT_VOICE_GROUP, mixFaderToGain, type KitMix } from '@/lib/kit-mix'
import { CLICK_SOUNDS, type ClickSoundId, type VoiceId } from '@/lib/rhythm'

type AudioContextCtor = typeof AudioContext

export function getAudioCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const view = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? view.webkitAudioContext
}

export function createRhythmContext(): AudioContext {
  const Ctor = getAudioCtor()
  if (!Ctor) throw new Error('NO_AUDIO')
  try {
    return new Ctor({ latencyHint: 'interactive', sampleRate: 48000 })
  } catch {
    try {
      return new Ctor({ latencyHint: 'interactive' })
    } catch {
      return new Ctor()
    }
  }
}

type CrocellPiece =
  | 'kick'
  | 'snare_snappy_p2'
  | 'rimshot_snappy_p2'
  | 'sidestick'
  | 'hihat_closed'
  | 'hihat_open'
  | 'crash'
  | 'ride'
  | 'ride_bell'
  | 'tom_high'
  | 'tom_mid'
  | 'tom_low'
  | 'china'
  | 'splash'
  | 'stack'
  | 'clap'

const VOICE_PIECE: Record<VoiceId, CrocellPiece> = {
  kick: 'kick',
  snare: 'snare_snappy_p2',
  rim: 'sidestick',
  clap: 'clap',
  highTom: 'tom_high',
  midTom: 'tom_mid',
  lowTom: 'tom_mid',
  floorTom: 'tom_low',
  closedHat: 'hihat_closed',
  openHat: 'hihat_open',
  ride: 'ride',
  rideBell: 'ride_bell',
  crash: 'crash',
  stack: 'stack',
  splash: 'splash',
  china: 'china',
}

type CrocellFile = {
  piece: CrocellPiece
  tier: KitIntensity
  rr: number
  file: string
}

type LayerBank = Partial<Record<CrocellPiece, Partial<Record<KitIntensity, AudioBuffer[]>>>>

const CLICK_FILES: Record<ClickSoundId, { normal: string; accent: string }> = {
  wood: {
    normal: '/rhythm/clicks/wood-soft-tick.wav',
    accent: '/rhythm/clicks/wood-soft-accent.wav',
  },
  clave: {
    normal: '/rhythm/clicks/clave-tick.wav',
    accent: '/rhythm/clicks/clave-accent.wav',
  },
  digital: {
    normal: '/rhythm/clicks/digital-soft-tick.wav',
    accent: '/rhythm/clicks/digital-soft-accent.wav',
  },
  mechanical: {
    normal: '/rhythm/clicks/mechanical-soft-tick.wav',
    accent: '/rhythm/clicks/mechanical-soft-accent.wav',
  },
}

/** Hidden per-lane trims under the 75% / 0 dB fader rest. Kick+snare lead. */
const SAMPLE_GAIN: Record<VoiceId, number> = {
  kick: 1.2,
  snare: 1.28,
  rim: 1.22,
  clap: 1.32,
  highTom: 1.22,
  midTom: 1.2,
  lowTom: 1.2,
  floorTom: 1.18,
  closedHat: 2.15,
  openHat: 1.58,
  ride: 3.25,
  rideBell: 4.35,
  crash: 0.88,
  stack: 1.05,
  splash: 2.45,
  china: 1.92,
}

/** Master input stays unity so fader dB readouts stay honest. Loudness is makeup. */
const MASTER_GAIN = 1
/** Makeup into the limiter — tuned to −12…−10 LUFS on Rock 1 @ 4. */
const MAKEUP_GAIN = Math.pow(10, 19.5 / 20)
const LIMITER_CEILING = Math.pow(10, -1.5 / 20)

/** Shared drum-room send. Dry path is untouched so grid taps stay at 0 ms. */
const REVERB_DECAY = 0.6
const REVERB_IR_SECONDS = 0.7
const REVERB_HP_HZ = 240
const REVERB_RETURN = 0.17
const REVERB_SEND: Record<VoiceId, number> = {
  kick: 0.05,
  snare: 0.18,
  rim: 0.17,
  clap: 0.2,
  highTom: 0.18,
  midTom: 0.17,
  lowTom: 0.16,
  floorTom: 0.16,
  closedHat: 0.07,
  openHat: 0.09,
  ride: 0.11,
  rideBell: 0.1,
  crash: 0.13,
  stack: 0.12,
  splash: 0.13,
  china: 0.13,
}

const CHOKE_HAT_VOICES: ReadonlySet<VoiceId> = new Set([
  'closedHat',
  'openHat',
  'crash',
  'stack',
  'splash',
  'china',
])

function renderBuffer(
  ctx: AudioContext,
  seconds: number,
  fill: (data: Float32Array, sampleRate: number) => void,
): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  fill(buffer.getChannelData(0), ctx.sampleRate)
  return buffer
}

function env(t: number, attack: number, decay: number): number {
  if (t < 0) return 0
  if (t < attack) return t / Math.max(0.0001, attack)
  return Math.exp(-(t - attack) / Math.max(0.0001, decay))
}

function tanh(x: number): number {
  const e = Math.exp(2 * x)
  return (e - 1) / (e + 1)
}

function bakeKick(ctx: AudioContext): AudioBuffer {
  return renderBuffer(ctx, 0.55, (data, sr) => {
    let phase = 0
    let clickPhase = 0
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      const freq = 52 + 138 * Math.exp(-t * 28)
      phase += (Math.PI * 2 * freq) / sr
      const body = Math.sin(phase) * env(t, 0.004, 0.22)
      const sub = Math.sin(phase * 0.5) * env(t, 0.008, 0.32) * 0.55
      clickPhase += (Math.PI * 2 * (1800 - t * 9000)) / sr
      const click = Math.sin(clickPhase) * env(t, 0.0004, 0.012) * 0.22
      const noise = (Math.random() * 2 - 1) * env(t, 0.0002, 0.018) * 0.12
      data[i] = tanh((body + sub) * 1.55 + click + noise) * 0.95
    }
  })
}

function bakeSnare(ctx: AudioContext): AudioBuffer {
  return renderBuffer(ctx, 0.42, (data, sr) => {
    let p1 = 0
    let p2 = 0
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      p1 += (Math.PI * 2 * (196 - t * 80)) / sr
      p2 += (Math.PI * 2 * (333 - t * 40)) / sr
      const body =
        (Math.sin(p1) * 0.55 + Math.sin(p2) * 0.35) * env(t, 0.0015, 0.09)
      const noise = (Math.random() * 2 - 1) * env(t, 0.0008, 0.16)
      const snap = (Math.random() * 2 - 1) * env(t, 0.0002, 0.018) * 0.7
      const air = (Math.random() * 2 - 1) * env(t, 0.001, 0.07) * 0.25
      data[i] = tanh(body * 1.2 + noise * 0.62 + snap + air) * 0.9
    }
  })
}

function bakeHat(ctx: AudioContext, open: boolean): AudioBuffer {
  const seconds = open ? 0.42 : 0.07
  const freqs = open
    ? [880, 1040, 1188, 1340, 1510, 1720, 1980]
    : [980, 1210, 1480, 1720, 2050, 2380]
  return renderBuffer(ctx, seconds, (data, sr) => {
    const phases = freqs.map(() => 0)
    const decay = open ? 0.12 : 0.018
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      let metal = 0
      for (let f = 0; f < freqs.length; f += 1) {
        phases[f] += (Math.PI * 2 * freqs[f] * (open ? 1 : 1.03)) / sr
        const square = Math.sin(phases[f]) > 0 ? 1 : -1
        metal += square / freqs.length
      }
      const hiss = (Math.random() * 2 - 1) * 0.4
      const tone = (metal * 0.7 + hiss) * env(t, 0.00035, decay)
      data[i] = tanh(tone * 1.7) * (open ? 0.72 : 0.44)
    }
  })
}

function bakeCrash(ctx: AudioContext): AudioBuffer {
  const freqs = [620, 780, 910, 1080, 1290, 1540, 1810, 2100]
  return renderBuffer(ctx, 1.05, (data, sr) => {
    const phases = freqs.map(() => Math.random() * Math.PI * 2)
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      let metal = 0
      for (let f = 0; f < freqs.length; f += 1) {
        phases[f] += (Math.PI * 2 * freqs[f] * (1 + t * 0.012)) / sr
        metal += Math.sin(phases[f]) / freqs.length
      }
      const wash = (Math.random() * 2 - 1) * env(t, 0.0015, 0.38)
      data[i] = tanh(metal * env(t, 0.002, 0.48) * 1.2 + wash * 0.4) * 0.62
    }
  })
}

function bakeTom(ctx: AudioContext, freq: number, seconds: number): AudioBuffer {
  return renderBuffer(ctx, seconds, (data, sr) => {
    let phase = 0
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      const f = freq * (1 + 0.18 * Math.exp(-t * 18))
      phase += (Math.PI * 2 * f) / sr
      const body = Math.sin(phase) * env(t, 0.003, 0.18)
      const head = (Math.random() * 2 - 1) * env(t, 0.0004, 0.04) * 0.28
      data[i] = tanh(body * 1.35 + head) * 0.82
    }
  })
}

function bakeRide(ctx: AudioContext): AudioBuffer {
  const freqs = [640, 880, 1120, 1380, 1640, 1980, 2360]
  return renderBuffer(ctx, 0.95, (data, sr) => {
    const phases = freqs.map(() => Math.random() * Math.PI * 2)
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      let metal = 0
      for (let f = 0; f < freqs.length; f += 1) {
        phases[f] += (Math.PI * 2 * freqs[f]) / sr
        metal += Math.sin(phases[f]) / freqs.length
      }
      const ping = metal * env(t, 0.0008, 0.38)
      const wash = (Math.random() * 2 - 1) * env(t, 0.0008, 0.28) * 0.22
      data[i] = tanh(ping * 1.1 + wash) * 0.5
    }
  })
}

function bakeRideBell(ctx: AudioContext): AudioBuffer {
  const freqs = [980, 1470, 1960, 2480, 3120]
  return renderBuffer(ctx, 0.55, (data, sr) => {
    const phases = freqs.map(() => Math.random() * Math.PI * 2)
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      let metal = 0
      for (let f = 0; f < freqs.length; f += 1) {
        phases[f] += (Math.PI * 2 * freqs[f]) / sr
        metal += Math.sin(phases[f]) / freqs.length
      }
      const ping = metal * env(t, 0.0004, 0.16)
      const click = (Math.random() * 2 - 1) * env(t, 0.0002, 0.012) * 0.28
      data[i] = tanh(ping * 1.35 + click) * 0.52
    }
  })
}

function bakeStack(ctx: AudioContext): AudioBuffer {
  const freqs = [540, 780, 1100, 1480, 1860, 2300]
  return renderBuffer(ctx, 0.48, (data, sr) => {
    const phases = freqs.map(() => Math.random() * Math.PI * 2)
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      let metal = 0
      for (let f = 0; f < freqs.length; f += 1) {
        phases[f] += (Math.PI * 2 * freqs[f] * (1 + t * 0.02)) / sr
        metal += (Math.sin(phases[f]) > 0 ? 1 : -1) / freqs.length
      }
      const trash = (Math.random() * 2 - 1) * env(t, 0.0006, 0.14)
      data[i] = tanh(metal * env(t, 0.0008, 0.12) * 1.15 + trash * 0.45) * 0.55
    }
  })
}

function bakeSplash(ctx: AudioContext): AudioBuffer {
  const freqs = [1100, 1480, 1860, 2240, 2680]
  return renderBuffer(ctx, 0.62, (data, sr) => {
    const phases = freqs.map(() => Math.random() * Math.PI * 2)
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      let metal = 0
      for (let f = 0; f < freqs.length; f += 1) {
        phases[f] += (Math.PI * 2 * freqs[f]) / sr
        metal += Math.sin(phases[f]) / freqs.length
      }
      const wash = (Math.random() * 2 - 1) * env(t, 0.0008, 0.2)
      data[i] = tanh(metal * env(t, 0.0007, 0.2) * 1.15 + wash * 0.32) * 0.5
    }
  })
}

function bakeChina(ctx: AudioContext): AudioBuffer {
  const freqs = [380, 520, 740, 980, 1290, 1680, 2140]
  return renderBuffer(ctx, 1.05, (data, sr) => {
    const phases = freqs.map(() => Math.random() * Math.PI * 2)
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      let metal = 0
      for (let f = 0; f < freqs.length; f += 1) {
        phases[f] += (Math.PI * 2 * freqs[f] * (1 + t * 0.018)) / sr
        metal += (Math.sin(phases[f]) > 0 ? 1 : -1) / freqs.length
      }
      const wash = (Math.random() * 2 - 1) * env(t, 0.0012, 0.36)
      data[i] = tanh(metal * env(t, 0.0015, 0.34) * 1.05 + wash * 0.42) * 0.56
    }
  })
}

function bakeRim(ctx: AudioContext): AudioBuffer {
  return renderBuffer(ctx, 0.14, (data, sr) => {
    let body = 0
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      body += (Math.PI * 2 * (210 - t * 380)) / sr
      const wood = Math.sin(body) * env(t, 0.0004, 0.018) * 0.35
      const stick = (Math.random() * 2 - 1) * env(t, 0.00015, 0.009) * 0.85
      const shell = (Math.random() * 2 - 1) * env(t, 0.0003, 0.022) * 0.22
      data[i] = tanh(wood + stick + shell) * 0.7
    }
  })
}

function bakeClap(ctx: AudioContext): AudioBuffer {
  return renderBuffer(ctx, 0.11, (data, sr) => {
    const bursts = [0, 0.009, 0.018]
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      let noise = 0
      for (const offset of bursts) {
        const local = t - offset
        if (local < 0) continue
        noise += (Math.random() * 2 - 1) * env(local, 0.0004, 0.014)
      }
      data[i] = tanh(noise * 1.45) * 0.68
    }
  })
}

function bakeSynthDrums(ctx: AudioContext): Record<VoiceId, AudioBuffer> {
  return {
    kick: bakeKick(ctx),
    snare: bakeSnare(ctx),
    rim: bakeRim(ctx),
    clap: bakeClap(ctx),
    highTom: bakeTom(ctx, 196, 0.55),
    midTom: bakeTom(ctx, 147, 0.62),
    lowTom: bakeTom(ctx, 120, 0.66),
    floorTom: bakeTom(ctx, 98, 0.72),
    closedHat: bakeHat(ctx, false),
    openHat: bakeHat(ctx, true),
    ride: bakeRide(ctx),
    rideBell: bakeRideBell(ctx),
    crash: bakeCrash(ctx),
    stack: bakeStack(ctx),
    splash: bakeSplash(ctx),
    china: bakeChina(ctx),
  }
}

function decodeAudio(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  const copy = data.slice(0)
  return new Promise((resolve, reject) => {
    let settled = false
    const ok = (buffer: AudioBuffer) => {
      if (settled) return
      settled = true
      resolve(buffer)
    }
    const fail = (error?: DOMException | string) => {
      if (settled) return
      settled = true
      reject(error ?? new Error('decodeAudioData failed'))
    }
    try {
      const result = ctx.decodeAudioData(copy, ok, fail)
      if (result && typeof result.then === 'function') {
        result.then(ok).catch(() => fail())
      }
    } catch {
      fail()
    }
  })
}

async function loadSample(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url, { cache: 'force-cache' })
  if (!response.ok) throw new Error(`Failed to load ${url} (${response.status})`)
  const data = await response.arrayBuffer()
  return decodeAudio(ctx, data)
}

function crocellUrl(file: string): string {
  return `${import.meta.env.BASE_URL}rhythm/drums/crocell/${file}`
}

async function loadCrocellManifest(): Promise<CrocellFile[]> {
  const response = await fetch(crocellUrl('manifest.json'), { cache: 'force-cache' })
  if (!response.ok) throw new Error('crocell manifest')
  const data = (await response.json()) as { files?: CrocellFile[] }
  return Array.isArray(data.files) ? data.files : []
}

function storeLayer(bank: LayerBank, piece: CrocellPiece, tier: KitIntensity, buffer: AudioBuffer): void {
  const tiers = bank[piece] ?? (bank[piece] = {})
  const row = tiers[tier] ?? (tiers[tier] = [])
  row.push(buffer)
}

function filePriority(tier: KitIntensity, focus: KitIntensity): number {
  return Math.abs(tier - focus)
}

function pickNearestTier(
  rows: Partial<Record<KitIntensity, AudioBuffer[]>>,
  tier: KitIntensity,
): AudioBuffer[] | undefined {
  if (rows[tier]?.length) return rows[tier]
  for (const delta of [1, -1, 2, -2, 3, -3, 4, -4]) {
    const next = (tier + delta) as KitIntensity
    if (next < 1 || next > 5) continue
    if (rows[next]?.length) return rows[next]
  }
  return undefined
}

async function loadCrocellLayers(
  ctx: AudioContext,
  bank: LayerBank,
  focus: KitIntensity,
): Promise<void> {
  const files = await loadCrocellManifest()
  const ordered = [...files].sort((a, b) => filePriority(a.tier, focus) - filePriority(b.tier, focus))
  const queue = [...ordered]
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length > 0) {
      const row = queue.shift()
      if (!row) return
      try {
        const buffer = await loadSample(ctx, crocellUrl(row.file))
        storeLayer(bank, row.piece, row.tier, buffer)
      } catch {
        // Synth / already-loaded neighbor covers this hit.
      }
    }
  })
  await Promise.all(workers)
}

type ClickPair = { normal: AudioBuffer; accent: AudioBuffer }

function bakeClick(
  ctx: AudioContext,
  fill: (data: Float32Array, sr: number, accent: boolean) => void,
): ClickPair {
  const seconds = 0.22
  return {
    normal: renderBuffer(ctx, seconds, (data, sr) => fill(data, sr, false)),
    accent: renderBuffer(ctx, seconds, (data, sr) => fill(data, sr, true)),
  }
}

function bakeClicks(ctx: AudioContext): Record<ClickSoundId, ClickPair> {
  const clicks: Record<ClickSoundId, ClickPair> = {
    wood: bakeClick(ctx, (data, sr, accent) => {
      const f0 = accent ? 560 : 430
      let p = 0
      let p2 = 0
      for (let i = 0; i < data.length; i += 1) {
        const t = i / sr
        p += (Math.PI * 2 * f0) / sr
        p2 += (Math.PI * 2 * f0 * 1.72) / sr
        const tone =
          (Math.sin(p) + Math.sin(p2) * 0.14) * env(t, 0.0007, accent ? 0.05 : 0.036)
        const knock = (Math.random() * 2 - 1) * env(t, 0.00025, 0.012) * 0.24
        data[i] = tanh(tone * 1.1 + knock) * (accent ? 0.72 : 0.55)
      }
    }),
    clave: bakeClick(ctx, (data, sr, accent) => {
      const f0 = accent ? 2280 : 1980
      let p = 0
      for (let i = 0; i < data.length; i += 1) {
        const t = i / sr
        p += (Math.PI * 2 * (f0 - t * 720)) / sr
        data[i] =
          Math.sin(p) * env(t, 0.0003, accent ? 0.024 : 0.016) * (accent ? 0.7 : 0.46)
      }
    }),
    digital: bakeClick(ctx, (data, sr, accent) => {
      const f0 = accent ? 1320 : 980
      let p = 0
      for (let i = 0; i < data.length; i += 1) {
        const t = i / sr
        p += (Math.PI * 2 * f0) / sr
        const square = Math.sin(p) > 0 ? 1 : -1
        data[i] = square * env(t, 0.0004, accent ? 0.028 : 0.018) * (accent ? 0.34 : 0.22)
      }
    }),
    mechanical: bakeClick(ctx, (data, sr, accent) => {
      let p = 0
      for (let i = 0; i < data.length; i += 1) {
        const t = i / sr
        p += (Math.PI * 2 * (accent ? 980 : 780)) / sr
        const tone = Math.sin(p) * env(t, 0.0004, 0.018)
        const air = (Math.random() * 2 - 1) * env(t, 0.0002, 0.01) * 0.28
        data[i] = (tone * 0.58 + air) * (accent ? 0.5 : 0.32)
      }
    }),
  }
  return matchClickLoudness(clicks)
}

async function loadClicks(
  ctx: AudioContext,
  fallback: Record<ClickSoundId, ClickPair>,
): Promise<Record<ClickSoundId, ClickPair>> {
  const clicks = { ...fallback }
  await Promise.all(
    CLICK_SOUNDS.map(async (id) => {
      try {
        const [normal, accent] = await Promise.all([
          loadSample(ctx, CLICK_FILES[id].normal),
          loadSample(ctx, CLICK_FILES[id].accent),
        ])
        clicks[id] = { normal, accent }
      } catch {
        // Keep the synthesized tick/accent pair for this voice.
      }
    }),
  )
  return matchClickLoudness(clicks)
}

function attackLoudness(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0)
  const n = Math.min(data.length, Math.floor(buffer.sampleRate * 0.055))
  let sum = 0
  let peak = 0
  for (let i = 0; i < n; i += 1) {
    const sample = data[i]
    const abs = Math.abs(sample)
    if (abs > peak) peak = abs
    sum += sample * sample
  }
  const rms = Math.sqrt(sum / Math.max(1, n))
  return Math.pow(Math.max(1e-6, rms), 0.72) * Math.pow(Math.max(1e-6, peak), 0.28)
}

function scaleBuffer(buffer: AudioBuffer, gain: number, ceiling: number): void {
  const data = buffer.getChannelData(0)
  let peak = 0
  for (let i = 0; i < data.length; i += 1) {
    data[i] *= gain
    const abs = Math.abs(data[i])
    if (abs > peak) peak = abs
  }
  if (peak > ceiling) {
    const trim = ceiling / peak
    for (let i = 0; i < data.length; i += 1) data[i] *= trim
  }
}

/** Match unaccented clicks to one loudness; accents stay a bit hotter than their own base. */
function matchClickLoudness(clicks: Record<ClickSoundId, ClickPair>): Record<ClickSoundId, ClickPair> {
  const target = attackLoudness(clicks.wood.normal)
  const accentBoost = Math.pow(10, 2.4 / 20)
  for (const id of Object.keys(clicks) as ClickSoundId[]) {
    const pair = clicks[id]
    const normal = attackLoudness(pair.normal)
    scaleBuffer(pair.normal, target / normal, 0.86)
    const accent = attackLoudness(pair.accent)
    scaleBuffer(pair.accent, (target * accentBoost) / accent, 0.94)
  }
  return clicks
}

function makeBrickwall(ctx: AudioContext, ceiling: number): WaveShaperNode {
  const curve = new Float32Array(4096)
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.max(-ceiling, Math.min(ceiling, x))
  }
  const shaper = ctx.createWaveShaper()
  shaper.curve = curve
  shaper.oversample = '2x'
  return shaper
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Short drum-room IR: early taps + damped noise tail. No third-party sample. */
function bakeRoomIR(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate
  const n = Math.max(1, Math.floor(sr * REVERB_IR_SECONDS))
  const ir = ctx.createBuffer(2, n, sr)
  const left = ir.getChannelData(0)
  const right = ir.getChannelData(1)
  const rand = mulberry32(0xc0ce11)
  const tau = REVERB_DECAY / Math.log(1000)
  const early: ReadonlyArray<{ t: number; g: number; pan: number }> = [
    { t: 0.0064, g: 0.62, pan: -0.38 },
    { t: 0.0118, g: 0.48, pan: 0.42 },
    { t: 0.0186, g: 0.36, pan: -0.18 },
    { t: 0.0274, g: 0.26, pan: 0.5 },
    { t: 0.0385, g: 0.18, pan: -0.46 },
    { t: 0.051, g: 0.13, pan: 0.22 },
    { t: 0.067, g: 0.09, pan: -0.28 },
  ]
  for (const tap of early) {
    const i = Math.min(n - 1, Math.floor(tap.t * sr))
    const leftG = tap.g * (0.5 - tap.pan * 0.5)
    const rightG = tap.g * (0.5 + tap.pan * 0.5)
    left[i] += leftG
    right[i] += rightG
  }
  let lpL = 0
  let lpR = 0
  for (let i = 0; i < n; i += 1) {
    const t = i / sr
    const decay = Math.exp(-t / tau)
    const bright = Math.exp(-t * 5.2)
    const coeff = 0.18 + 0.62 * (1 - bright)
    const noiseL = rand() * 2 - 1
    const noiseR = rand() * 2 - 1
    lpL += coeff * (noiseL - lpL)
    lpR += coeff * (noiseR - lpR)
    const tail = decay * 0.2
    left[i] += lpL * tail
    right[i] += lpR * tail
  }
  let peak = 0
  for (let i = 0; i < n; i += 1) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
  }
  const trim = peak > 0 ? 0.92 / peak : 1
  for (let i = 0; i < n; i += 1) {
    left[i] *= trim
    right[i] *= trim
  }
  return ir
}

function makeReverbBus(ctx: AudioContext, dest: AudioNode): { send: GainNode; wet: GainNode } {
  const send = ctx.createGain()
  send.gain.value = 1
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = REVERB_HP_HZ
  hp.Q.value = 0.7
  const conv = ctx.createConvolver()
  conv.normalize = false
  conv.buffer = bakeRoomIR(ctx)
  const wet = ctx.createGain()
  wet.gain.value = REVERB_RETURN
  send.connect(hp)
  hp.connect(conv)
  conv.connect(wet)
  wet.connect(dest)
  return { send, wet }
}

function makeKickBus(ctx: AudioContext, dest: AudioNode): AudioNode {
  const body = ctx.createBiquadFilter()
  body.type = 'peaking'
  body.frequency.value = 230
  body.Q.value = 0.75
  body.gain.value = 1.6
  const beater = ctx.createBiquadFilter()
  beater.type = 'highshelf'
  beater.frequency.value = 2600
  beater.gain.value = 1.15
  body.connect(beater)
  beater.connect(dest)
  return body
}

function bakeWheelTick(ctx: AudioContext): AudioBuffer {
  return renderBuffer(ctx, 0.034, (data, sr) => {
    let ping = 0
    let thud = 0
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      ping += (Math.PI * 2 * (1120 - t * 6200)) / sr
      thud += (Math.PI * 2 * (185 - t * 420)) / sr
      const body = Math.sin(ping) * env(t, 0.00022, 0.013)
      const low = Math.sin(thud) * env(t, 0.00035, 0.016) * 0.55
      const detent = (Math.random() * 2 - 1) * env(t, 0.00014, 0.0042) * 0.16
      data[i] = (body * 0.62 + low + detent) * 0.4
    }
  })
}

let wheelTickCtx: AudioContext | null = null
let wheelTickBuffer: AudioBuffer | null = null
let lastWheelTickAt = 0

/** Short mechanical detent for the BPM wheel. Rate-limited so fast scrubs don't explode. */
export function playWheelTick(): void {
  const Ctor = getAudioCtor()
  if (!Ctor) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now - lastWheelTickAt < 48) return
  lastWheelTickAt = now
  try {
    if (!wheelTickCtx || wheelTickCtx.state === 'closed') {
      try {
        wheelTickCtx = createRhythmContext()
      } catch {
        wheelTickCtx = new Ctor()
      }
      wheelTickBuffer = bakeWheelTick(wheelTickCtx)
    }
    const ctx = wheelTickCtx
    const buffer = wheelTickBuffer
    if (!buffer) return
    if (ctx.state === 'suspended') void ctx.resume()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const amp = ctx.createGain()
    amp.gain.value = 0.64
    source.connect(amp)
    amp.connect(ctx.destination)
    source.start(0)
  } catch {
    // Audio can fail before a user gesture; ignore.
  }
}

let sharedKit: RhythmKit | null = null
let lastPreviewPathMs = 0

export function lastDrumPreviewPathMs(): number {
  return lastPreviewPathMs
}

export function getOrCreateRhythmKit(): RhythmKit | null {
  if (sharedKit && sharedKit.ctx.state !== 'closed') return sharedKit
  try {
    sharedKit = new RhythmKit(createRhythmContext())
    void sharedKit.unlock()
    exposeDrumDebug()
    return sharedKit
  } catch {
    return null
  }
}

export function primeRhythmKit(): void {
  const kit = getOrCreateRhythmKit()
  if (!kit) return
  void kit.unlock()
}

function exposeDrumDebug(): void {
  if (typeof window === 'undefined') return
  Object.defineProperty(window, '__OMNICIAN_DRUM__', {
    configurable: true,
    get() {
      const kit = sharedKit
      return {
        previewPathMs: lastPreviewPathMs,
        context: kit?.ctx.state ?? 'none',
        intensity: kit?.intensity ?? null,
        loadedLayers: kit?.loadedLayerCount() ?? 0,
        baseLatencyMs: kit ? Math.round(kit.ctx.baseLatency * 1000) : null,
        outputLatencyMs:
          kit && 'outputLatency' in kit.ctx ? Math.round((kit.ctx.outputLatency as number) * 1000) : null,
        voices: kit ? kit.voiceIds() : [],
      }
    },
  })
}

export class RhythmKit {
  readonly ctx: AudioContext
  intensity: KitIntensity = DEFAULT_KIT_INTENSITY
  private readonly master: GainNode
  private readonly makeup: GainNode
  private readonly kickBus: AudioNode
  private readonly reverbSend: GainNode
  private readonly reverbWet: GainNode
  private drums: Record<VoiceId, AudioBuffer>
  private clicks: Record<ClickSoundId, ClickPair>
  private readonly layers: LayerBank = {}
  private readonly rr = new Map<string, number>()
  private mix: KitMix = { ...DEFAULT_KIT_MIX }
  private openHat: { gain: GainNode; start: number } | null = null
  private closedHat: { gain: GainNode; start: number } | null = null
  private sources: AudioBufferSourceNode[] = []
  private readonly ready: Promise<void>

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = MASTER_GAIN
    const glue = ctx.createDynamicsCompressor()
    glue.threshold.value = -16
    glue.knee.value = 8
    glue.ratio.value = 2.2
    glue.attack.value = 0.005
    glue.release.value = 0.18
    this.makeup = ctx.createGain()
    this.makeup.gain.value = MAKEUP_GAIN
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -1.2
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.002
    limiter.release.value = 0.055
    const wall = makeBrickwall(ctx, LIMITER_CEILING)
    this.master.connect(glue)
    glue.connect(this.makeup)
    this.makeup.connect(limiter)
    limiter.connect(wall)
    wall.connect(ctx.destination)
    this.kickBus = makeKickBus(ctx, this.master)
    const room = makeReverbBus(ctx, this.master)
    this.reverbSend = room.send
    this.reverbWet = room.wet
    this.drums = bakeSynthDrums(ctx)
    this.clicks = bakeClicks(ctx)
    this.ready = Promise.all([
      loadClicks(ctx, this.clicks).then((clicks) => {
        this.clicks = clicks
      }),
      loadCrocellLayers(ctx, this.layers, this.intensity),
    ])
      .then(() => undefined)
      .catch(() => undefined)
  }

  static async create(ctx: AudioContext): Promise<RhythmKit> {
    const kit = new RhythmKit(ctx)
    await kit.ready
    return kit
  }

  voiceIds(): VoiceId[] {
    return Object.keys(this.drums) as VoiceId[]
  }

  loadedLayerCount(): number {
    let count = 0
    for (const tiers of Object.values(this.layers)) {
      if (!tiers) continue
      for (const row of Object.values(tiers)) count += row?.length ?? 0
    }
    return count
  }

  setIntensity(next: KitIntensity): void {
    this.intensity = next
  }

  async unlock(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        // Need a later gesture on iOS.
      }
    }
  }

  click(
    time: number,
    level: 0 | 1 | 2,
    sound: ClickSoundId = 'wood',
    onBeat = true,
  ): void {
    const pair = this.clicks[sound] ?? this.clicks.wood
    // Off/soft share the tick; strong uses the accent one-shot (timbre, not just louder).
    const buffer = level === 2 ? pair.accent : pair.normal
    // Clicks share the loud master bus; keep them full but not hotter than a snare.
    const baseGain = level === 2 ? 0.2 : level === 1 ? 0.15 : 0.085
    const baseRate = level === 1 ? 1.03 : 1
    // Within-beat pulses sit a little higher so they never match a main-beat click.
    const rate = onBeat ? baseRate : baseRate * 1.09
    const gain = onBeat ? baseGain : baseGain * 0.86
    this.fire(buffer, time, gain, rate)
  }

  setMix(mix: KitMix): void {
    this.mix = { ...mix }
  }

  hit(voice: VoiceId, time: number, role: HitRole = 'normal'): void {
    if (CHOKE_HAT_VOICES.has(voice)) {
      this.chokeHats(time)
    }
    if (voice === 'openHat') this.chokeClosed(time)
    const group = KIT_VOICE_GROUP[voice]
    const groupGain = mixFaderToGain(group, this.mix[group] ?? 0)
    const mix = (SAMPLE_GAIN[voice] ?? 1) * groupGain
    const buffer = this.bufferFor(voice, role) ?? this.drums[voice]
    const source = this.fire(buffer, time, mix, 1, voice)
    if (voice === 'openHat' && source) this.openHat = { gain: source, start: time }
    if (voice === 'closedHat' && source) this.closedHat = { gain: source, start: time }
  }

  previewVoice(voice: VoiceId, role: HitRole = 'backbeat'): void {
    const started = performance.now()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.hit(voice, 0, role)
    lastPreviewPathMs = performance.now() - started
  }

  previewClick(sound: ClickSoundId, level: 0 | 1 | 2 = 2, onBeat = true): void {
    const started = performance.now()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.click(0, level, sound, onBeat)
    lastPreviewPathMs = performance.now() - started
  }

  /** Cut every scheduled click and drum the instant Stop is pressed. */
  stopAll(): void {
    const now = this.ctx.currentTime
    for (const source of this.sources) {
      try {
        source.onended = null
        source.stop(now)
      } catch {
        // Already finished or cancelled.
      }
      try {
        source.disconnect()
      } catch {
        // Already disconnected.
      }
    }
    this.sources = []
    this.openHat = null
    this.closedHat = null
    try {
      this.reverbWet.gain.cancelScheduledValues(now)
      this.reverbWet.gain.setValueAtTime(Math.max(0.0001, this.reverbWet.gain.value), now)
      this.reverbWet.gain.linearRampToValueAtTime(0.0001, now + 0.03)
      this.reverbWet.gain.setValueAtTime(REVERB_RETURN, now + 0.05)
    } catch {
      this.reverbWet.gain.setValueAtTime(REVERB_RETURN, now)
    }
    try {
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now)
      this.master.gain.linearRampToValueAtTime(0.0001, now + 0.004)
      this.master.gain.setValueAtTime(MASTER_GAIN, now + 0.008)
    } catch {
      this.master.gain.setValueAtTime(MASTER_GAIN, now)
    }
  }

  private bufferFor(voice: VoiceId, role: HitRole): AudioBuffer | null {
    const intensity = this.intensity
    const tier = resolveTier(intensity, voice === 'snare' ? role : 'normal')
    let piece = VOICE_PIECE[voice]
    if (voice === 'snare' && useRimshotBackbeat(intensity, role)) {
      piece = 'rimshot_snappy_p2'
    }
    return (
      this.nextRoundRobin(piece, tier) ??
      (piece === 'rimshot_snappy_p2' ? this.nextRoundRobin('snare_snappy_p2', tier) : null) ??
      this.drums[voice] ??
      null
    )
  }

  private nextRoundRobin(piece: CrocellPiece, tier: KitIntensity): AudioBuffer | null {
    const rows = this.layers[piece]
    if (!rows) return null
    const available = pickNearestTier(rows, tier)
    if (!available || available.length === 0) return null
    const key = `${piece}:${tier}`
    const index = this.rr.get(key) ?? 0
    this.rr.set(key, index + 1)
    return available[index % available.length] ?? available[0]
  }

  private fire(buffer: AudioBuffer, time: number, gain: number, rate = 1, voice?: VoiceId): GainNode {
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    const when = time <= 0 ? 0 : time
    const gainTime = when === 0 ? this.ctx.currentTime : when
    source.playbackRate.setValueAtTime(rate, gainTime)
    const amp = this.ctx.createGain()
    amp.gain.setValueAtTime(Math.max(0.0001, gain), gainTime)
    source.connect(amp)
    amp.connect(voice === 'kick' ? this.kickBus : this.master)
    const sendAmt = voice ? REVERB_SEND[voice] : 0
    if (sendAmt > 0) {
      const send = this.ctx.createGain()
      send.gain.setValueAtTime(sendAmt, gainTime)
      amp.connect(send)
      send.connect(this.reverbSend)
    }
    source.start(when)
    this.sources.push(source)
    source.onended = () => {
      this.sources = this.sources.filter((item) => item !== source)
    }
    return amp
  }

  private fadeVoice(
    voice: { gain: GainNode; start: number } | null,
    time: number,
    seconds: number,
  ): void {
    if (!voice || time < voice.start - 0.0001) return
    const { gain } = voice
    try {
      gain.gain.cancelScheduledValues(time)
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), time)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + seconds)
    } catch {
      gain.gain.setValueAtTime(0.0001, time)
    }
  }

  private chokeHats(time: number): void {
    if (!this.openHat || time < this.openHat.start - 0.0001) return
    this.fadeVoice(this.openHat, time, 0.055)
    this.openHat = null
  }

  private chokeClosed(time: number): void {
    if (!this.closedHat || time < this.closedHat.start - 0.0001) return
    this.fadeVoice(this.closedHat, time, 0.018)
    this.closedHat = null
  }
}
