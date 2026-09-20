import type { FamilyId } from '@/lib/presets'
import { familyTone } from '@/lib/headstock'

type AudioContextCtor = typeof AudioContext

function getCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const view = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? view.webkitAudioContext
}

export function playReferenceTone(frequency: number, family: FamilyId): void {
  const AudioContextCtor = getCtor()
  if (!AudioContextCtor || !Number.isFinite(frequency) || frequency < 20) return

  const audio = new AudioContextCtor()
  const tone = familyTone(family)
  const now = audio.currentTime + 0.01
  const duration = tone === 'bass' ? 0.85 : tone === 'ukulele' ? 0.38 : 0.55

  const master = audio.createGain()
  master.gain.setValueAtTime(0.0001, now)
  master.gain.exponentialRampToValueAtTime(tone === 'bass' ? 0.22 : 0.16, now + 0.02)
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  master.connect(audio.destination)

  const filter = audio.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value =
    tone === 'bass' ? 900 : tone === 'ukulele' ? 4200 : tone === 'folk' ? 2800 : 2200
  filter.Q.value = 0.9
  filter.connect(master)

  const fundamental = audio.createOscillator()
  const fundGain = audio.createGain()
  fundamental.type = tone === 'bass' ? 'sine' : 'triangle'
  fundamental.frequency.value = frequency
  fundGain.gain.value = tone === 'bass' ? 0.7 : 0.45
  fundamental.connect(fundGain)
  fundGain.connect(filter)
  fundamental.start(now)
  fundamental.stop(now + duration)

  const partial = audio.createOscillator()
  const partGain = audio.createGain()
  partial.type = 'sine'
  partial.frequency.value = frequency * (tone === 'bass' ? 2 : 2.01)
  partGain.gain.value = tone === 'ukulele' ? 0.22 : 0.12
  partial.connect(partGain)
  partGain.connect(filter)
  partial.start(now)
  partial.stop(now + duration)

  const noise = audio.createBufferSource()
  const noiseBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.05), audio.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  }
  noise.buffer = noiseBuffer
  const noiseGain = audio.createGain()
  noiseGain.gain.setValueAtTime(tone === 'bass' ? 0.08 : 0.18, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
  const noiseFilter = audio.createBiquadFilter()
  noiseFilter.type = 'bandpass'
  noiseFilter.frequency.value = frequency
  noiseFilter.Q.value = 6
  noise.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(filter)
  noise.start(now)
  noise.stop(now + 0.06)

  window.setTimeout(() => {
    void audio.close()
  }, duration * 1000 + 120)
}
