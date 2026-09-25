import { createPitchScratch, estimateFromFilled } from '../lib/yin'

const HOP = 256
const MAX_WINDOW = 4096

class PitchProcessor extends AudioWorkletProcessor {
  private readonly ring = new Float32Array(MAX_WINDOW)
  private readonly scratch = createPitchScratch(MAX_WINDOW)
  private readonly view = new Float32Array(MAX_WINDOW)
  private write = 0
  private filled = 0
  private hop = 0
  private prevHz: number | null = null

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (!channel || channel.length === 0) return true

    for (let i = 0; i < channel.length; i += 1) {
      this.ring[this.write] = channel[i]
      this.write = (this.write + 1) % MAX_WINDOW
      if (this.filled < MAX_WINDOW) this.filled += 1
      this.hop += 1
      if (this.hop >= HOP && this.filled >= 2048) {
        this.hop = 0
        this.emit()
      }
    }
    return true
  }

  private emit(): void {
    const window = this.filled
    this.copyWindow(window)
    let rms = 0
    const tail = Math.min(512, window)
    for (let i = window - tail; i < window; i += 1) {
      const s = this.view[i]
      rms += s * s
    }
    rms = Math.sqrt(rms / tail)

    const estimate = estimateFromFilled(
      this.view.subarray(0, window),
      window,
      sampleRate,
      this.scratch,
      this.prevHz,
    )
    if (estimate.frequency > 0 && estimate.clarity >= 0.55) {
      this.prevHz = estimate.frequency
    }

    this.port.postMessage({
      type: 'estimate',
      hz: estimate.frequency,
      clarity: estimate.clarity,
      rms,
      time: currentTime,
    })
  }

  private copyWindow(window: number): void {
    let src = this.write - window
    if (src < 0) src += MAX_WINDOW
    for (let i = 0; i < window; i += 1) {
      this.view[i] = this.ring[(src + i) % MAX_WINDOW]
    }
  }
}

registerProcessor('omnician-pitch', PitchProcessor)
