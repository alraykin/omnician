import type { VoiceId } from '@/lib/rhythm'

type AudioContextCtor = typeof AudioContext

export function getAudioCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const view = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? view.webkitAudioContext
}

function makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

export class RhythmKit {
  readonly ctx: AudioContext
  private readonly master: GainNode
  private readonly noise: AudioBuffer
  private openHat: GainNode | null = null

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.82
    this.master.connect(ctx.destination)
    this.noise = makeNoise(ctx, 2)
  }

  async unlock(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume()
  }

  click(time: number, accent: boolean): void {
    const freq = accent ? 1480 : 880
    const osc = this.ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, time)
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(freq, time)
    filter.Q.value = accent ? 1.1 : 1.6
    const gain = this.ctx.createGain()
    const peak = accent ? 0.22 : 0.12
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (accent ? 0.07 : 0.045))
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    osc.start(time)
    osc.stop(time + 0.09)

    const tick = this.ctx.createOscillator()
    tick.type = 'sine'
    tick.frequency.setValueAtTime(accent ? 2200 : 1600, time)
    const tickGain = this.ctx.createGain()
    tickGain.gain.setValueAtTime(accent ? 0.08 : 0.04, time)
    tickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.018)
    tick.connect(tickGain)
    tickGain.connect(this.master)
    tick.start(time)
    tick.stop(time + 0.03)
  }

  hit(voice: VoiceId, time: number, accent: boolean): void {
    const lift = accent ? 1.12 : 1
    if (voice === 'kick') this.kick(time, lift)
    else if (voice === 'snare') this.snare(time, lift)
    else if (voice === 'closedHat') this.hat(time, false, lift)
    else if (voice === 'openHat') this.hat(time, true, lift)
    else this.crash(time, lift)
  }

  private kick(time: number, lift: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(148, time)
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.09)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(0.9 * lift, time + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.28)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(time)
    osc.stop(time + 0.3)

    const click = this.ctx.createOscillator()
    click.type = 'square'
    click.frequency.setValueAtTime(980, time)
    const clickGain = this.ctx.createGain()
    clickGain.gain.setValueAtTime(0.16 * lift, time)
    clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02)
    const clickFilter = this.ctx.createBiquadFilter()
    clickFilter.type = 'highpass'
    clickFilter.frequency.value = 700
    click.connect(clickFilter)
    clickFilter.connect(clickGain)
    clickGain.connect(this.master)
    click.start(time)
    click.stop(time + 0.03)
  }

  private snare(time: number, lift: number): void {
    const body = this.ctx.createOscillator()
    body.type = 'triangle'
    body.frequency.setValueAtTime(188, time)
    body.frequency.exponentialRampToValueAtTime(140, time + 0.08)
    const bodyGain = this.ctx.createGain()
    bodyGain.gain.setValueAtTime(0.28 * lift, time)
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14)
    body.connect(bodyGain)
    bodyGain.connect(this.master)
    body.start(time)
    body.stop(time + 0.16)

    const noise = this.ctx.createBufferSource()
    noise.buffer = this.noise
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(2100, time)
    filter.Q.value = 1.1
    const noiseGain = this.ctx.createGain()
    noiseGain.gain.setValueAtTime(0.42 * lift, time)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18)
    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(this.master)
    noise.start(time)
    noise.stop(time + 0.2)
  }

  private hat(time: number, open: boolean, lift: number): void {
    if (open) this.chokeOpen(time)
    else this.chokeOpen(time)

    const noise = this.ctx.createBufferSource()
    noise.buffer = this.noise
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = open ? 6200 : 7800
    filter.Q.value = 0.7
    const gain = this.ctx.createGain()
    const peak = (open ? 0.22 : 0.16) * lift
    const decay = open ? 0.38 : 0.048
    gain.gain.setValueAtTime(peak, time)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay)
    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    noise.start(time)
    noise.stop(time + decay + 0.02)
    if (open) this.openHat = gain
    else this.openHat = null
  }

  private crash(time: number, lift: number): void {
    this.chokeOpen(time)
    const noise = this.ctx.createBufferSource()
    noise.buffer = this.noise
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(4200, time)
    filter.frequency.exponentialRampToValueAtTime(1800, time + 0.55)
    filter.Q.value = 0.55
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.28 * lift, time)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.85)
    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    noise.start(time)
    noise.stop(time + 0.9)
  }

  private chokeOpen(time: number): void {
    if (!this.openHat) return
    const gain = this.openHat
    try {
      gain.gain.cancelScheduledValues(time)
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), time)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02)
    } catch {
      gain.gain.setValueAtTime(0.0001, time)
    }
    this.openHat = null
  }
}
