import { getSharedAudioContext, onPlaybackRetiring, resumeSharedAudioContext } from '@/lib/audio-context'
import {
  DEFAULT_INTENSITY_STYLE,
  DEFAULT_KIT_INTENSITY,
  dynamicsFor,
  playOptsForRole,
  resolveTier,
  type CrocellTier,
  type HitRole,
  type KitIntensity,
} from '@/lib/kit-intensity'
import { realizeDrumBar } from '@/lib/kit-intensity-play'
import {
  DEFAULT_KIT_MIX,
  KIT_MIX_MAX_DB,
  KIT_VOICE_GROUP,
  mixFaderToGain,
  type KitMix,
} from '@/lib/kit-mix'
import { CLICK_SOUNDS, hitTimeInBar, VOICES, type ClickSoundId, type VoiceId } from '@/lib/rhythm'
import { barsForPreset, findPreset, type RhythmStyleId } from '@/lib/rhythm-presets'
import { clampSbPct, MAX_SB_PCT, MIN_SB_PCT } from '@/lib/speed-builder'
import { HAT_CHOKE_SEC, nextHatChokeTime } from '@/lib/hat-choke'

export type DrumPlayOpts = {
  tier?: CrocellTier
  blendTier?: CrocellTier
  blendMix?: number
  vel?: number
  rimshot?: boolean
}

export { getAudioCtor } from '@/lib/audio-context'

export function createRhythmContext(): AudioContext {
  return getSharedAudioContext()
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

const VOICE_PIECE: Record<VoiceId, CrocellPiece> = {
  kick: 'kick',
  snare: 'snare_snappy_p2',
  rim: 'sidestick',
  highTom: 'tom_high',
  midTom: 'tom_mid',
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
  tier: CrocellTier
  rr: number
  file: string
}

type LayerBank = Partial<Record<CrocellPiece, Partial<Record<CrocellTier, AudioBuffer[]>>>>

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

/** Hidden per-lane trims under the 75% / 0 dB fader rest. Kick+snare lead.
 *  Rim (sidestick) is matched to ~85% of snare by peak×RMS of the rendered Crocell hits. */
const SAMPLE_GAIN: Record<VoiceId, number> = {
  kick: 1.2,
  snare: 1.28,
  rim: 11.5,
  highTom: 1.22,
  midTom: 1.2,
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

/**
 * Device volume is the user control. Master is a fixed makeup gain into a
 * peak limiter + brickwall so Intense + faders-up + accented clicks sit as
 * loud as possible without going above MASTER_CEILING_DB.
 */
export const MASTER_CEILING_DB = -0.3
export const MASTER_GAIN_DB = 6.5
const MASTER_GAIN = Math.pow(10, MASTER_GAIN_DB / 20)
const MASTER_CEILING = Math.pow(10, MASTER_CEILING_DB / 20)

/** Medium room after the dry clipper so the tail is never ducked. */
const REVERB_DECAY = 1.35
const REVERB_IR_SECONDS = 1.65
const REVERB_PREDELAY = 0.015
const REVERB_HP_HZ = 240
/** ~1% wet vs dry (−40 dB), after the same static gain as the dry path. */
const REVERB_RETURN = 0.01
const REVERB_SEND: Record<VoiceId, number> = {
  kick: 0.7,
  snare: 1,
  rim: 1,
  highTom: 1,
  midTom: 1,
  floorTom: 1,
  closedHat: 1,
  openHat: 1,
  ride: 1,
  rideBell: 1,
  crash: 1,
  stack: 1,
  splash: 1,
  china: 1,
}

type HatVoice = { gain: GainNode; start: number; mix: number }

function renderBuffer(
  ctx: BaseAudioContext,
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

function bakeKick(ctx: BaseAudioContext): AudioBuffer {
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

function bakeSnare(ctx: BaseAudioContext): AudioBuffer {
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

function bakeHat(ctx: BaseAudioContext, open: boolean): AudioBuffer {
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

function bakeCrash(ctx: BaseAudioContext): AudioBuffer {
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

function bakeTom(ctx: BaseAudioContext, freq: number, seconds: number): AudioBuffer {
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

function bakeRide(ctx: BaseAudioContext): AudioBuffer {
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

function bakeRideBell(ctx: BaseAudioContext): AudioBuffer {
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

function bakeStack(ctx: BaseAudioContext): AudioBuffer {
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

function bakeSplash(ctx: BaseAudioContext): AudioBuffer {
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

function bakeChina(ctx: BaseAudioContext): AudioBuffer {
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

function bakeRim(ctx: BaseAudioContext): AudioBuffer {
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

function bakeSynthDrums(ctx: BaseAudioContext): Record<VoiceId, AudioBuffer> {
  return {
    kick: bakeKick(ctx),
    snare: bakeSnare(ctx),
    rim: bakeRim(ctx),
    highTom: bakeTom(ctx, 196, 0.55),
    midTom: bakeTom(ctx, 147, 0.62),
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

const decodedCache = new Map<string, AudioBuffer>()

function decodeAudio(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
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

async function loadSample(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  const hit = decodedCache.get(url)
  if (hit) return hit
  const response = await fetch(url, { cache: 'force-cache' })
  if (!response.ok) throw new Error(`Failed to load ${url} (${response.status})`)
  const data = await response.arrayBuffer()
  const buffer = await decodeAudio(ctx, data)
  decodedCache.set(url, buffer)
  return buffer
}

function crocellUrl(file: string): string {
  return `${import.meta.env.BASE_URL}rhythm/drums/crocell/${file}`
}

function announceUrl(pct: number): string {
  return `${import.meta.env.BASE_URL}rhythm/announce/af_heart/${String(clampSbPct(pct)).padStart(3, '0')}.mp3`
}

async function loadCrocellManifest(): Promise<CrocellFile[]> {
  const response = await fetch(crocellUrl('manifest.json'), { cache: 'force-cache' })
  if (!response.ok) throw new Error('crocell manifest')
  const data = (await response.json()) as { files?: CrocellFile[] }
  return Array.isArray(data.files) ? data.files : []
}

function storeLayer(bank: LayerBank, piece: CrocellPiece, tier: CrocellTier, buffer: AudioBuffer): void {
  const tiers = bank[piece] ?? (bank[piece] = {})
  const row = tiers[tier] ?? (tiers[tier] = [])
  row.push(buffer)
}

function filePriority(tier: CrocellTier, focus: CrocellTier): number {
  return Math.abs(tier - focus)
}

function pickNearestTier(
  rows: Partial<Record<CrocellTier, AudioBuffer[]>>,
  tier: CrocellTier,
): AudioBuffer[] | undefined {
  if (rows[tier]?.length) return rows[tier]
  for (const delta of [1, -1, 2, -2, 3, -3, 4, -4]) {
    const next = (tier + delta) as CrocellTier
    if (next < 1 || next > 5) continue
    if (rows[next]?.length) return rows[next]
  }
  return undefined
}

async function loadCrocellLayers(
  ctx: BaseAudioContext,
  bank: LayerBank,
  focus: CrocellTier,
): Promise<void> {
  const used = new Set(Object.values(VOICE_PIECE))
  const files = (await loadCrocellManifest()).filter((row) => used.has(row.piece))
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
  ctx: BaseAudioContext,
  fill: (data: Float32Array, sr: number, accent: boolean) => void,
): ClickPair {
  const seconds = 0.22
  return {
    normal: renderBuffer(ctx, seconds, (data, sr) => fill(data, sr, false)),
    accent: renderBuffer(ctx, seconds, (data, sr) => fill(data, sr, true)),
  }
}

/** Count-in pip — not one of the playable click samples. */
function bakePrecount(ctx: BaseAudioContext): ClickPair {
  return bakeClick(ctx, (data, sr, accent) => {
    const f0 = accent ? 1860 : 1180
    let p = 0
    let p2 = 0
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      p += (Math.PI * 2 * (f0 - t * 420)) / sr
      p2 += (Math.PI * 2 * f0 * 2.15) / sr
      const tone = Math.sin(p) * env(t, 0.0002, accent ? 0.028 : 0.018)
      const air = Math.sin(p2) * env(t, 0.00016, 0.01) * 0.18
      data[i] = tanh(tone * 1.35 + air) * (accent ? 0.7 : 0.48)
    }
  })
}

function bakeClicks(ctx: BaseAudioContext): Record<ClickSoundId, ClickPair> {
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
  ctx: BaseAudioContext,
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

function makeBrickwall(ctx: BaseAudioContext, ceiling: number): WaveShaperNode {
  const curve = new Float32Array(4096)
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.max(-ceiling, Math.min(ceiling, x))
  }
  const shaper = ctx.createWaveShaper()
  shaper.curve = curve
  // No oversample: interpolation can ring above the ceiling.
  shaper.oversample = 'none'
  return shaper
}

/** Fast peak limiter just under the brickwall so stacked hits aren't hard-clipped raw. */
function makePeakLimiter(ctx: BaseAudioContext): DynamicsCompressorNode {
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -1.2
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.001
  limiter.release.value = 0.06
  return limiter
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

/** Medium room / plate IR: predelay, dense early field, smooth damped tail. */
function bakeRoomIR(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate
  const n = Math.max(1, Math.floor(sr * REVERB_IR_SECONDS))
  const ir = ctx.createBuffer(2, n, sr)
  const left = ir.getChannelData(0)
  const right = ir.getChannelData(1)
  const rand = mulberry32(0xc0ce11)
  const tau = REVERB_DECAY / Math.log(1000)
  const early: ReadonlyArray<{ t: number; g: number; pan: number }> = [
    { t: 0.015, g: 0.42, pan: -0.32 },
    { t: 0.0195, g: 0.36, pan: 0.4 },
    { t: 0.025, g: 0.3, pan: -0.18 },
    { t: 0.032, g: 0.24, pan: 0.48 },
    { t: 0.041, g: 0.2, pan: -0.44 },
    { t: 0.053, g: 0.16, pan: 0.22 },
    { t: 0.068, g: 0.12, pan: -0.26 },
    { t: 0.086, g: 0.09, pan: 0.34 },
  ]
  for (const tap of early) {
    const i = Math.min(n - 1, Math.floor(tap.t * sr))
    left[i] += tap.g * (0.5 - tap.pan * 0.5)
    right[i] += tap.g * (0.5 + tap.pan * 0.5)
  }
  let lpL = 0
  let lpR = 0
  const start = Math.floor(REVERB_PREDELAY * sr)
  for (let i = start; i < n; i += 1) {
    const t = i / sr - REVERB_PREDELAY
    const decay = Math.exp(-t / tau)
    const bright = Math.exp(-t * 2.6)
    const coeff = 0.14 + 0.55 * (1 - bright)
    lpL += coeff * (rand() * 2 - 1 - lpL)
    lpR += coeff * (rand() * 2 - 1 - lpR)
    const tail = decay * 0.18
    left[i] += lpL * tail
    right[i] += lpR * tail
  }
  let peak = 0
  for (let i = 0; i < n; i += 1) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
  }
  const trim = peak > 0 ? 0.9 / peak : 1
  for (let i = 0; i < n; i += 1) {
    left[i] *= trim
    right[i] *= trim
  }
  return ir
}

function makeReverbBus(ctx: BaseAudioContext, dest: AudioNode): { send: GainNode; wet: GainNode } {
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

function makeKickBus(ctx: BaseAudioContext, dest: AudioNode): AudioNode {
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

function bakeWheelTick(ctx: BaseAudioContext): AudioBuffer {
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
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now - lastWheelTickAt < 48) return
  lastWheelTickAt = now
  try {
    const ctx = getSharedAudioContext()
    if (!wheelTickBuffer || wheelTickCtx !== ctx) {
      wheelTickCtx = ctx
      wheelTickBuffer = bakeWheelTick(ctx)
    }
    const buffer = wheelTickBuffer
    if (!buffer) return
    void resumeSharedAudioContext()
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

onPlaybackRetiring(() => {
  try {
    sharedKit?.stopAll()
  } catch {
    // old graph may already be gone
  }
})

export function lastDrumPreviewPathMs(): number {
  return lastPreviewPathMs
}

export function getOrCreateRhythmKit(): RhythmKit | null {
  const ctx = getSharedAudioContext()
  if (sharedKit && sharedKit.ctx === ctx && sharedKit.ctx.state !== 'closed') return sharedKit
  const previous = sharedKit
  try {
    previous?.stopAll()
  } catch {
    // old graph may already be gone
  }
  try {
    sharedKit = new RhythmKit(ctx)
    if (previous) {
      sharedKit.setMix(previous.getMix())
      sharedKit.setPerformance(previous.styleId, previous.intensity)
    }
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
        now: kit?.ctx.currentTime ?? 0,
        intensity: kit?.intensity ?? null,
        style: kit?.styleId ?? null,
        brightnessDb: kit?.brightnessDb ?? null,
        loadedLayers: kit?.loadedLayerCount() ?? 0,
        scheduled: kit?.scheduledVoices() ?? [],
        baseLatencyMs:
          kit && 'baseLatency' in kit.ctx ? Math.round((kit.ctx.baseLatency as number) * 1000) : null,
        outputLatencyMs:
          kit && 'outputLatency' in kit.ctx ? Math.round((kit.ctx.outputLatency as number) * 1000) : null,
        voices: kit ? kit.voiceIds() : [],
        probeMasterPeaks,
      }
    },
  })
}

export class RhythmKit {
  readonly ctx: BaseAudioContext
  intensity: KitIntensity = DEFAULT_KIT_INTENSITY
  styleId: RhythmStyleId = DEFAULT_INTENSITY_STYLE
  brightnessDb = 0
  private readonly master: GainNode
  private readonly color: BiquadFilterNode
  private readonly kickBus: AudioNode
  private readonly reverbSend: GainNode
  private readonly reverbWet: GainNode
  private drums: Record<VoiceId, AudioBuffer>
  private clicks: Record<ClickSoundId, ClickPair>
  private precountPair: ClickPair
  private readonly layers: LayerBank = {}
  private readonly rr = new Map<string, number>()
  private mix: KitMix = { ...DEFAULT_KIT_MIX }
  private openHats: HatVoice[] = []
  private closedHat: HatVoice | null = null
  private closedHatTimes: number[] = []
  private sources: Array<{ node: AudioBufferSourceNode; when: number; kind: 'drum' | 'click' | 'other' }> = []
  private readonly announceBuffers = new Map<number, AudioBuffer>()
  private readonly announceLoads = new Map<number, Promise<AudioBuffer | null>>()
  private announceWarmed = false
  private gainRestoreTimer = 0
  private readonly ready: Promise<void>

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = MASTER_GAIN
    const limiter = makePeakLimiter(ctx)
    const wall = makeBrickwall(ctx, MASTER_CEILING)
    this.master.connect(limiter)
    limiter.connect(wall)
    wall.connect(ctx.destination)
    this.color = ctx.createBiquadFilter()
    this.color.type = 'highshelf'
    this.color.frequency.value = 3800
    this.color.Q.value = 0.65
    this.color.gain.value = 0
    this.color.connect(this.master)
    this.kickBus = makeKickBus(ctx, this.color)
    const room = makeReverbBus(ctx, limiter)
    this.reverbSend = room.send
    this.reverbSend.gain.value = MASTER_GAIN
    this.reverbWet = room.wet
    this.drums = bakeSynthDrums(ctx)
    this.clicks = bakeClicks(ctx)
    this.precountPair = bakePrecount(ctx)
    this.ready = Promise.all([
      loadClicks(ctx, this.clicks).then((clicks) => {
        this.clicks = clicks
      }),
      loadCrocellLayers(ctx, this.layers, dynamicsFor(this.intensity).accentTier),
    ])
      .then(() => undefined)
      .catch(() => undefined)
  }

  static async create(ctx: BaseAudioContext): Promise<RhythmKit> {
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
    this.setPerformance(this.styleId, next)
  }

  setPerformance(styleId: RhythmStyleId, intensity: KitIntensity): void {
    this.styleId = styleId
    this.intensity = intensity
    this.setBrightness(0)
  }

  setBrightness(db: number): void {
    this.brightnessDb = db
    const now = this.ctx.currentTime
    try {
      this.color.gain.cancelScheduledValues(now)
      this.color.gain.setValueAtTime(this.color.gain.value, now)
      this.color.gain.linearRampToValueAtTime(db, now + 0.04)
    } catch {
      this.color.gain.value = db
    }
  }

  whenReady(): Promise<void> {
    return this.ready
  }

  async unlock(): Promise<void> {
    if (typeof OfflineAudioContext !== 'undefined' && this.ctx instanceof OfflineAudioContext) return
    await resumeSharedAudioContext()
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
    // Clicks stay dry (no send) through the static master + clipper.
    const baseGain = level === 2 ? 0.55 : level === 1 ? 0.4 : 0.22
    const baseRate = level === 1 ? 1.03 : 1
    // Within-beat pulses sit a little higher so they never match a main-beat click.
    const rate = onBeat ? baseRate : baseRate * 1.09
    const gain = onBeat ? baseGain : baseGain * 0.86
    this.fire(buffer, time, gain, rate, undefined, 'click')
  }

  /** One-bar count-in: dry synth pip, not the selected click sample. */
  precount(time: number, strong: boolean): void {
    const buffer = strong ? this.precountPair.accent : this.precountPair.normal
    this.fire(buffer, time, strong ? 0.58 : 0.36, 1, undefined, 'click')
  }

  /** Spoken percent through the dry master. Does not move the beat clock. */
  announce(time: number, pct: number): void {
    const n = clampSbPct(pct)
    const buffer = this.announceBuffers.get(n)
    if (buffer) {
      this.fire(buffer, time, 0.46, 1)
      return
    }
    // Never speechSynthesis here — iOS fades Web Audio when the system voice
    // starts, right after the first precount clicks.
    void this.ensureAnnounce(n).then((ready) => {
      if (!ready) return
      if (time > this.ctx.currentTime + 0.012) this.fire(ready, time, 0.46, 1)
    })
  }

  preloadAnnounce(): void {
    if (this.announceWarmed) return
    this.announceWarmed = true
    for (let n = MIN_SB_PCT; n <= MAX_SB_PCT; n += 1) {
      void this.ensureAnnounce(n)
    }
  }

  async ensureAnnounce(pct: number): Promise<AudioBuffer | null> {
    const n = clampSbPct(pct)
    const hit = this.announceBuffers.get(n)
    if (hit) return hit
    const pending = this.announceLoads.get(n)
    if (pending) return pending
    const load = loadSample(this.ctx, announceUrl(n))
      .then((buffer) => {
        this.announceBuffers.set(n, buffer)
        return buffer
      })
      .catch(() => null)
    this.announceLoads.set(n, load)
    return load
  }

  setMix(mix: KitMix): void {
    this.mix = { ...mix }
  }

  getMix(): KitMix {
    return { ...this.mix }
  }

  hit(voice: VoiceId, time: number, role: HitRole = 'normal', play: DrumPlayOpts = {}): void {
    const when = time <= 0 ? this.ctx.currentTime : time
    if (voice === 'closedHat' || voice === 'openHat') this.chokeOpenHats(when)
    if (voice === 'openHat') this.chokeClosed(when)
    const derived = playOptsForRole(this.intensity, role)
    const vel = play.vel ?? derived.vel
    const group = KIT_VOICE_GROUP[voice]
    const groupGain = mixFaderToGain(group, this.mix[group] ?? 0)
    const mix = (SAMPLE_GAIN[voice] ?? 1) * groupGain * Math.max(0.05, vel)
    const layers = this.layerBuffers(voice, role, play)
    const source = this.fireLayers(layers, when, mix, voice)
    if (voice === 'openHat' && source) {
      const hat: HatVoice = { gain: source, start: when, mix }
      const laterClosed = nextHatChokeTime(when, this.closedHatTimes)
      if (laterClosed != null) this.fadeVoice(hat, laterClosed, HAT_CHOKE_SEC)
      else this.openHats.push(hat)
    }
    if (voice === 'closedHat') {
      this.closedHatTimes.push(when)
      this.pruneHatState(when)
      if (source) this.closedHat = { gain: source, start: when, mix }
    }
  }

  previewVoice(voice: VoiceId, role: HitRole = 'backbeat'): void {
    const started = performance.now()
    void resumeSharedAudioContext()
    this.hit(voice, 0, role)
    lastPreviewPathMs = performance.now() - started
  }

  previewClick(sound: ClickSoundId, level: 0 | 1 | 2 = 2, onBeat = true): void {
    const started = performance.now()
    void resumeSharedAudioContext()
    this.click(0, level, sound, onBeat)
    lastPreviewPathMs = performance.now() - started
  }

  scheduledVoices(): Array<{ when: number; kind: 'drum' | 'click' | 'other' }> {
    return this.sources.map(({ when, kind }) => ({ when, kind }))
  }

  /** Drop not-yet-started voices so intensity or tempo can re-pick them. Announce stays. */
  cancelFuture(after: number, kind?: 'drum' | 'click'): void {
    const keep: typeof this.sources = []
    for (const item of this.sources) {
      const match = kind ? item.kind === kind : item.kind === 'drum' || item.kind === 'click'
      if (match && item.when > after) {
        try {
          item.node.onended = null
          // iOS ignores a bare stop() on some not-yet-started buffers.
          item.node.stop(this.ctx.currentTime)
        } catch {
          try {
            item.node.stop()
          } catch {
            // Already finished or cancelled.
          }
        }
        try {
          item.node.disconnect()
        } catch {
          // Already disconnected.
        }
      } else {
        keep.push(item)
      }
    }
    this.sources = keep
    this.openHats = this.openHats.filter((hat) => hat.start <= after)
    this.closedHatTimes = this.closedHatTimes.filter((time) => time <= after)
    if (this.closedHat && this.closedHat.start > after) this.closedHat = null
  }

  /** Cut every scheduled click and drum the instant Stop is pressed.
   *  Do not ramp master toward 0 — a duck on this shared node, or a late
   *  preview stopAll, fades the next Play about half a second in on iOS. */
  stopAll(): void {
    const now = this.ctx.currentTime
    if (this.gainRestoreTimer) {
      window.clearTimeout(this.gainRestoreTimer)
      this.gainRestoreTimer = 0
    }
    for (const item of this.sources) {
      try {
        item.node.onended = null
        item.node.stop(now)
      } catch {
        // Already finished or cancelled.
      }
      try {
        item.node.disconnect()
      } catch {
        // Already disconnected.
      }
    }
    this.sources = []
    this.openHats = []
    this.closedHat = null
    this.closedHatTimes = []
    const restore = MASTER_GAIN
    try {
      this.reverbWet.gain.cancelScheduledValues(now)
      this.reverbWet.gain.setValueAtTime(REVERB_RETURN, now)
    } catch {
      this.reverbWet.gain.value = REVERB_RETURN
    }
    try {
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setValueAtTime(restore, now)
    } catch {
      this.master.gain.value = restore
    }
  }

  private layerBuffers(
    voice: VoiceId,
    role: HitRole,
    play: DrumPlayOpts = {},
  ): Array<{ buffer: AudioBuffer; weight: number }> {
    const derived = playOptsForRole(this.intensity, role)
    const tier = play.tier ?? derived.tier ?? resolveTier(this.intensity, voice === 'snare' ? role : 'normal')
    const blendTier = play.blendTier ?? derived.blendTier
    const blendMix = play.blendMix ?? derived.blendMix ?? 0
    let piece = VOICE_PIECE[voice]
    if (voice === 'snare' && play.rimshot) {
      piece = 'rimshot_snappy_p2'
    }
    const primary =
      this.nextRoundRobin(piece, tier) ??
      (piece === 'rimshot_snappy_p2' ? this.nextRoundRobin('snare_snappy_p2', tier) : null) ??
      this.drums[voice] ??
      null
    if (!primary) return []
    if (!blendTier || blendMix <= 0.001 || blendMix >= 0.999) {
      return [{ buffer: primary, weight: 1 }]
    }
    const secondary =
      this.nextRoundRobin(piece, blendTier) ??
      (piece === 'rimshot_snappy_p2' ? this.nextRoundRobin('snare_snappy_p2', blendTier) : null)
    if (!secondary) return [{ buffer: primary, weight: 1 }]
    return [
      { buffer: primary, weight: 1 - blendMix },
      { buffer: secondary, weight: blendMix },
    ]
  }

  private fireLayers(
    layers: Array<{ buffer: AudioBuffer; weight: number }>,
    time: number,
    mix: number,
    voice: VoiceId,
  ): GainNode | null {
    if (layers.length === 0) {
      const fallback = this.drums[voice]
      return fallback ? this.fire(fallback, time, mix, 1, voice, 'drum') : null
    }
    if (layers.length === 1) {
      const only = layers[0]
      return only ? this.fire(only.buffer, time, mix, 1, voice, 'drum') : null
    }
    const when = time <= 0 ? 0 : time
    const gainTime = when === 0 ? this.ctx.currentTime : when
    const bus = this.ctx.createGain()
    bus.gain.setValueAtTime(Math.max(0.0001, mix), gainTime)
    bus.connect(voice === 'kick' ? this.kickBus : this.color)
    const sendAmt = REVERB_SEND[voice] ?? 0
    if (sendAmt > 0) {
      const send = this.ctx.createGain()
      send.gain.setValueAtTime(sendAmt, gainTime)
      bus.connect(send)
      send.connect(this.reverbSend)
    }
    for (const layer of layers) {
      const source = this.ctx.createBufferSource()
      source.buffer = layer.buffer
      source.playbackRate.setValueAtTime(1, gainTime)
      const amp = this.ctx.createGain()
      amp.gain.setValueAtTime(Math.max(0.0001, layer.weight), gainTime)
      source.connect(amp)
      amp.connect(bus)
      source.start(when)
      const startAt = when === 0 ? this.ctx.currentTime : when
      this.sources.push({ node: source, when: startAt, kind: 'drum' })
      source.onended = () => {
        this.sources = this.sources.filter((item) => item.node !== source)
      }
    }
    return bus
  }

  private nextRoundRobin(piece: CrocellPiece, tier: CrocellTier): AudioBuffer | null {
    const rows = this.layers[piece]
    if (!rows) return null
    const available = pickNearestTier(rows, tier)
    if (!available || available.length === 0) return null
    const key = `${piece}:${tier}`
    const index = this.rr.get(key) ?? 0
    this.rr.set(key, index + 1)
    return available[index % available.length] ?? available[0]
  }

  private fire(
    buffer: AudioBuffer,
    time: number,
    gain: number,
    rate = 1,
    voice?: VoiceId,
    kind: 'drum' | 'click' | 'other' = 'other',
  ): GainNode {
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    const when = time <= 0 ? 0 : time
    const gainTime = when === 0 ? this.ctx.currentTime : when
    source.playbackRate.setValueAtTime(rate, gainTime)
    const amp = this.ctx.createGain()
    amp.gain.setValueAtTime(Math.max(0.0001, gain), gainTime)
    source.connect(amp)
    amp.connect(voice === 'kick' ? this.kickBus : voice ? this.color : this.master)
    const sendAmt = voice ? REVERB_SEND[voice] : 0
    if (sendAmt > 0) {
      const send = this.ctx.createGain()
      send.gain.setValueAtTime(sendAmt, gainTime)
      amp.connect(send)
      send.connect(this.reverbSend)
    }
    source.start(when)
    const startAt = when === 0 ? this.ctx.currentTime : when
    this.sources.push({ node: source, when: startAt, kind })
    source.onended = () => {
      this.sources = this.sources.filter((item) => item.node !== source)
    }
    return amp
  }

  private fadeVoice(voice: HatVoice | null, time: number, seconds: number): void {
    if (!voice || time < voice.start - 0.0001) return
    const at = Math.max(time, this.ctx.currentTime)
    const { gain } = voice
    const from = Math.max(0.0001, voice.mix)
    try {
      gain.gain.cancelScheduledValues(at)
      gain.gain.setValueAtTime(from, at)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
    } catch {
      gain.gain.setValueAtTime(0.0001, at)
    }
  }

  private chokeOpenHats(time: number): void {
    const keep: HatVoice[] = []
    for (const hat of this.openHats) {
      if (time < hat.start - 0.0001) keep.push(hat)
      else this.fadeVoice(hat, time, HAT_CHOKE_SEC)
    }
    this.openHats = keep
  }

  private chokeClosed(time: number): void {
    if (!this.closedHat || time < this.closedHat.start - 0.0001) return
    this.fadeVoice(this.closedHat, time, HAT_CHOKE_SEC)
    this.closedHat = null
  }

  private pruneHatState(now: number): void {
    this.closedHatTimes = this.closedHatTimes.filter((time) => time > now - 16)
  }
}

function peakDbFromBuffer(buffer: AudioBuffer): number {
  let peak = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i += 1) {
      const abs = Math.abs(data[i] ?? 0)
      if (abs > peak) peak = abs
    }
  }
  if (peak <= 1e-9) return -120
  return 20 * Math.log10(peak)
}

const MAX_MIX: KitMix = {
  kick: KIT_MIX_MAX_DB,
  snare: KIT_MIX_MAX_DB,
  cymbals: KIT_MIX_MAX_DB,
  toms: KIT_MIX_MAX_DB,
}

async function renderOfflinePeak(seconds: number, run: (kit: RhythmKit) => void): Promise<number> {
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(48000 * seconds)), 48000)
  const kit = new RhythmKit(ctx)
  await kit.whenReady()
  kit.setPerformance('rock', 'high')
  kit.setMix(MAX_MIX)
  run(kit)
  return peakDbFromBuffer(await ctx.startRendering())
}

export type MasterPeakReport = {
  ceilingDb: number
  stackedDrumsDb: number
  rockIntenseDb: number
  clicks: Record<ClickSoundId, number>
  maxDb: number
}

/** Offline render of Intense + faders-up drums and accented clicks through the live master chain. */
export async function probeMasterPeaks(): Promise<MasterPeakReport> {
  const stackedDrumsDb = await renderOfflinePeak(2.2, (kit) => {
    const when = 0.04
    for (const voice of VOICES) {
      kit.hit(voice, when, voice === 'snare' ? 'backbeat' : 'normal')
    }
  })

  const rockIntenseDb = await renderOfflinePeak(3.2, (kit) => {
    const preset = findPreset('rock-44')
    const bar = preset ? barsForPreset(preset)[0] : undefined
    if (!bar) return
    const realized = realizeDrumBar(bar, 'high')
    for (const ev of realized.hits) {
      const when = 0.04 + hitTimeInBar(ev.hit, 120, bar.beatUnit)
      kit.hit(ev.voice, when, ev.role, {
        vel: ev.vel,
        tier: ev.tier,
        blendTier: ev.blendTier,
        blendMix: ev.blendMix,
      })
    }
  })

  const clicks = {} as Record<ClickSoundId, number>
  for (const sound of CLICK_SOUNDS) {
    clicks[sound] = await renderOfflinePeak(1.1, (kit) => {
      kit.click(0.04, 2, sound, true)
    })
  }

  const maxDb = Math.max(stackedDrumsDb, rockIntenseDb, ...Object.values(clicks))
  return { ceilingDb: MASTER_CEILING_DB, stackedDrumsDb, rockIntenseDb, clicks, maxDb }
}
