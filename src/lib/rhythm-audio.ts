import type { ClickSoundId, VoiceId } from '@/lib/rhythm'

type AudioContextCtor = typeof AudioContext

export function getAudioCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const view = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? view.webkitAudioContext
}

const SAMPLE_FILES: Record<VoiceId, string> = {
  kick: '/rhythm/drums/kick.wav',
  snare: '/rhythm/drums/snare.wav',
  closedHat: '/rhythm/drums/closed-hat.wav',
  openHat: '/rhythm/drums/open-hat.wav',
  highTom: '/rhythm/drums/high-tom.wav',
  midTom: '/rhythm/drums/mid-tom.wav',
  floorTom: '/rhythm/drums/floor-tom.wav',
  ride: '/rhythm/drums/ride.wav',
  crash: '/rhythm/drums/crash.wav',
}

/** Per-voice mix so hats sit under kick/snare and the crash is splashy, not huge. */
const SAMPLE_GAIN: Record<VoiceId, number> = {
  kick: 1,
  snare: 0.92,
  closedHat: 0.72,
  openHat: 0.62,
  highTom: 0.88,
  midTom: 0.9,
  floorTom: 0.94,
  ride: 0.7,
  crash: 0.78,
}

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
  const seconds = open ? 0.55 : 0.09
  const freqs = [318, 347, 412, 449, 483, 523, 612, 687]
  return renderBuffer(ctx, seconds, (data, sr) => {
    const phases = freqs.map(() => 0)
    const decay = open ? 0.18 : 0.028
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      let metal = 0
      for (let f = 0; f < freqs.length; f += 1) {
        phases[f] += (Math.PI * 2 * freqs[f] * (open ? 1 : 1.04)) / sr
        const square = Math.sin(phases[f]) > 0 ? 1 : -1
        metal += square / freqs.length
      }
      const hiss = (Math.random() * 2 - 1) * 0.35
      const tone = (metal * 0.75 + hiss) * env(t, 0.0004, decay)
      data[i] = tanh(tone * 1.8) * (open ? 0.55 : 0.48)
    }
  })
}

function bakeCrash(ctx: AudioContext): AudioBuffer {
  const freqs = [420, 487, 533, 611, 673, 754, 812, 901, 1040, 1188]
  return renderBuffer(ctx, 1.6, (data, sr) => {
    const phases = freqs.map(() => Math.random() * Math.PI * 2)
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      let metal = 0
      for (let f = 0; f < freqs.length; f += 1) {
        phases[f] += (Math.PI * 2 * freqs[f] * (1 + t * 0.015)) / sr
        metal += Math.sin(phases[f]) / freqs.length
      }
      const wash = (Math.random() * 2 - 1) * env(t, 0.002, 0.55)
      data[i] = tanh(metal * env(t, 0.003, 0.62) * 1.3 + wash * 0.45) * 0.7
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
  const freqs = [380, 512, 647, 801, 934, 1102, 1288]
  return renderBuffer(ctx, 1.35, (data, sr) => {
    const phases = freqs.map(() => Math.random() * Math.PI * 2)
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      let metal = 0
      for (let f = 0; f < freqs.length; f += 1) {
        phases[f] += (Math.PI * 2 * freqs[f]) / sr
        metal += Math.sin(phases[f]) / freqs.length
      }
      const ping = metal * env(t, 0.001, 0.55)
      const wash = (Math.random() * 2 - 1) * env(t, 0.001, 0.42) * 0.28
      data[i] = tanh(ping * 1.15 + wash) * 0.55
    }
  })
}

function bakeSynthDrums(ctx: AudioContext): Record<VoiceId, AudioBuffer> {
  return {
    kick: bakeKick(ctx),
    snare: bakeSnare(ctx),
    closedHat: bakeHat(ctx, false),
    openHat: bakeHat(ctx, true),
    highTom: bakeTom(ctx, 196, 0.55),
    midTom: bakeTom(ctx, 147, 0.62),
    floorTom: bakeTom(ctx, 98, 0.72),
    ride: bakeRide(ctx),
    crash: bakeCrash(ctx),
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

async function loadDrums(ctx: AudioContext): Promise<Record<VoiceId, AudioBuffer>> {
  const drums = bakeSynthDrums(ctx)
  await Promise.all(
    (Object.keys(SAMPLE_FILES) as VoiceId[]).map(async (voice) => {
      try {
        drums[voice] = await loadSample(ctx, SAMPLE_FILES[voice])
      } catch {
        // Keep the synthesized one-shot for this lane.
      }
    }),
  )
  return drums
}

const CLICK_SAMPLE_FILES: Partial<Record<ClickSoundId, { normal: string; accent: string }>> = {
  cowbell: {
    normal: '/rhythm/clicks/cowbell.wav',
    accent: '/rhythm/clicks/cowbell-accent.wav',
  },
}

async function loadClickSamples(
  ctx: AudioContext,
  baked: Record<ClickSoundId, ClickPair>,
): Promise<Record<ClickSoundId, ClickPair>> {
  const clicks = { ...baked }
  await Promise.all(
    (Object.keys(CLICK_SAMPLE_FILES) as ClickSoundId[]).map(async (id) => {
      const files = CLICK_SAMPLE_FILES[id]
      if (!files) return
      try {
        const [normal, accent] = await Promise.all([
          loadSample(ctx, files.normal),
          loadSample(ctx, files.accent),
        ])
        clicks[id] = { normal, accent }
      } catch {
        // Keep the synthesized click if the WAV is missing.
      }
    }),
  )
  return clicks
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
  return {
    woodblock: bakeClick(ctx, (data, sr, accent) => {
      const f0 = accent ? 980 : 740
      let p = 0
      let p2 = 0
      for (let i = 0; i < data.length; i += 1) {
        const t = i / sr
        p += (Math.PI * 2 * f0) / sr
        p2 += (Math.PI * 2 * f0 * 2.15) / sr
        const tone =
          (Math.sin(p) + Math.sin(p2) * 0.28) * env(t, 0.0006, accent ? 0.055 : 0.038)
        const knock = (Math.random() * 2 - 1) * env(t, 0.0002, 0.012) * 0.2
        data[i] = tanh(tone * 1.4 + knock) * (accent ? 0.85 : 0.55)
      }
    }),
    clave: bakeClick(ctx, (data, sr, accent) => {
      const f0 = accent ? 2450 : 2050
      let p = 0
      for (let i = 0; i < data.length; i += 1) {
        const t = i / sr
        p += (Math.PI * 2 * (f0 - t * 900)) / sr
        data[i] =
          Math.sin(p) * env(t, 0.0003, accent ? 0.028 : 0.018) * (accent ? 0.8 : 0.5)
      }
    }),
    digital: bakeClick(ctx, (data, sr, accent) => {
      const f0 = accent ? 1560 : 1040
      let p = 0
      for (let i = 0; i < data.length; i += 1) {
        const t = i / sr
        p += (Math.PI * 2 * f0) / sr
        const square = Math.sin(p) > 0 ? 1 : -1
        data[i] = square * env(t, 0.0004, accent ? 0.04 : 0.025) * (accent ? 0.42 : 0.28)
      }
    }),
    rim: bakeClick(ctx, (data, sr, accent) => {
      let p = 0
      for (let i = 0; i < data.length; i += 1) {
        const t = i / sr
        p += (Math.PI * 2 * (accent ? 420 : 340)) / sr
        const stick = Math.sin(p) * env(t, 0.0004, 0.03)
        const crack = (Math.random() * 2 - 1) * env(t, 0.0002, 0.016)
        data[i] = tanh(stick * 0.7 + crack * 0.85) * (accent ? 0.8 : 0.52)
      }
    }),
    cowbell: bakeClick(ctx, (data, sr, accent) => {
      // Fallback if the CC0 sample is missing: C#5 / G#5 sines, not square+clip.
      const a = accent ? 1.05 : 1
      let p1 = 0
      let p2 = 0
      let p3 = 0
      let p4 = 0
      let p5 = 0
      for (let i = 0; i < data.length; i += 1) {
        const t = i / sr
        p1 += (Math.PI * 2 * 554 * a) / sr
        p2 += (Math.PI * 2 * 830 * a) / sr
        p3 += (Math.PI * 2 * 1108 * a) / sr
        p4 += (Math.PI * 2 * 1661 * a) / sr
        p5 += (Math.PI * 2 * 2217 * a) / sr
        const body =
          Math.sin(p1) * 0.4 +
          Math.sin(p2) * 0.36 +
          Math.sin(p3) * 0.16 +
          Math.sin(p4) * 0.1 +
          Math.sin(p5) * 0.06
        const knock = (Math.random() * 2 - 1) * env(t, 0.00015, 0.007) * 0.16
        data[i] =
          (body * env(t, 0.0005, accent ? 0.13 : 0.1) + knock) * (accent ? 0.7 : 0.56)
      }
    }),
    tick: bakeClick(ctx, (data, sr, accent) => {
      let p = 0
      for (let i = 0; i < data.length; i += 1) {
        const t = i / sr
        p += (Math.PI * 2 * (accent ? 2100 : 1650)) / sr
        const tone = Math.sin(p) * env(t, 0.0004, 0.014)
        const air = (Math.random() * 2 - 1) * env(t, 0.0002, 0.01) * 0.35
        data[i] = (tone * 0.55 + air) * (accent ? 0.55 : 0.32)
      }
    }),
  }
}

function bakeWheelTick(ctx: AudioContext): AudioBuffer {
  return renderBuffer(ctx, 0.024, (data, sr) => {
    let ping = 0
    for (let i = 0; i < data.length; i += 1) {
      const t = i / sr
      ping += (Math.PI * 2 * (2100 - t * 16000)) / sr
      const body = Math.sin(ping) * env(t, 0.00014, 0.009)
      const detent = (Math.random() * 2 - 1) * env(t, 0.0001, 0.0055)
      data[i] = (body * 0.9 + detent * 0.42) * 0.4
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
  if (now - lastWheelTickAt < 42) return
  lastWheelTickAt = now
  try {
    if (!wheelTickCtx || wheelTickCtx.state === 'closed') {
      wheelTickCtx = new Ctor()
      wheelTickBuffer = bakeWheelTick(wheelTickCtx)
    }
    const ctx = wheelTickCtx
    const buffer = wheelTickBuffer
    if (!buffer) return
    if (ctx.state === 'suspended') void ctx.resume()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const amp = ctx.createGain()
    amp.gain.value = 0.72
    source.connect(amp)
    amp.connect(ctx.destination)
    source.start()
  } catch {
    // Audio can fail before a user gesture; ignore.
  }
}

export class RhythmKit {
  readonly ctx: AudioContext
  private readonly master: GainNode
  private drums: Record<VoiceId, AudioBuffer>
  private clicks: Record<ClickSoundId, ClickPair>
  private openHat: GainNode | null = null
  private readonly ready: Promise<void>

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 10
    comp.ratio.value = 3.2
    comp.attack.value = 0.003
    comp.release.value = 0.14
    this.master.connect(comp)
    comp.connect(ctx.destination)
    this.drums = bakeSynthDrums(ctx)
    this.clicks = bakeClicks(ctx)
    this.ready = Promise.all([
      loadDrums(ctx).then((drums) => {
        this.drums = drums
      }),
      loadClickSamples(ctx, this.clicks).then((clicks) => {
        this.clicks = clicks
      }),
    ])
      .then(() => undefined)
      .catch(() => {
        // Keep synthesized one-shots if WAV fetch/decode fails.
      })
  }

  static async create(ctx: AudioContext): Promise<RhythmKit> {
    const kit = new RhythmKit(ctx)
    await kit.ready
    return kit
  }

  async unlock(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    await this.ready
  }

  click(
    time: number,
    accent: boolean,
    sound: ClickSoundId = 'woodblock',
    gain = 1,
  ): void {
    const pair = this.clicks[sound] ?? this.clicks.woodblock
    this.fire(accent ? pair.accent : pair.normal, time, gain)
  }

  hit(voice: VoiceId, time: number, accent: boolean): void {
    if (voice === 'closedHat' || voice === 'openHat' || voice === 'crash') {
      this.chokeHats(time)
    }
    const mix = SAMPLE_GAIN[voice] ?? 1
    const source = this.fire(this.drums[voice], time, (accent ? 1.12 : 1) * mix)
    if (voice === 'openHat' && source) this.openHat = source
  }

  previewClick(sound: ClickSoundId, accent = true): void {
    this.click(this.ctx.currentTime + 0.01, accent, sound, 1)
  }

  private fire(buffer: AudioBuffer, time: number, gain: number): GainNode {
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    const amp = this.ctx.createGain()
    amp.gain.setValueAtTime(Math.max(0.0001, gain), time)
    source.connect(amp)
    amp.connect(this.master)
    source.start(time)
    return amp
  }

  private chokeHats(time: number): void {
    if (!this.openHat) return
    const gain = this.openHat
    try {
      gain.gain.cancelScheduledValues(time)
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), time)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03)
    } catch {
      gain.gain.setValueAtTime(0.0001, time)
    }
    this.openHat = null
  }
}
