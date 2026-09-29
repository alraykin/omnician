import { getSharedAudioContext, resumeSharedAudioContext } from '@/lib/audio-context'

let lastPlayedAt = 0
const COOLDOWN_MS = 900

function getAudio(): AudioContext | null {
  try {
    const shared = getSharedAudioContext()
    void resumeSharedAudioContext()
    return shared
  } catch {
    return null
  }
}

function head(
  audio: AudioContext,
  dest: AudioNode,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  attack = 0.012,
) {
  const oscillator = audio.createOscillator()
  const amp = audio.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, start + duration)
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + attack)
  amp.gain.exponentialRampToValueAtTime(gain * 0.45, start + 0.18)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(amp)
  amp.connect(dest)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

/** One-shot lock chime: warm triad + octave sparkle. */
export function playInTuneChime(): void {
  const nowMs = performance.now()
  if (nowMs - lastPlayedAt < COOLDOWN_MS) return
  lastPlayedAt = nowMs

  const audio = getAudio()
  if (!audio) return

  const start = audio.currentTime + 0.01
  const master = audio.createGain()
  master.gain.value = 1.15
  const filter = audio.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 2600
  filter.Q.value = 0.7
  filter.connect(master)
  master.connect(audio.destination)

  // Soft “lock”: C5 – E5 – G5, then a quiet C6 sparkle.
  head(audio, filter, 523.25, start, 0.92, 'sine', 0.2)
  head(audio, filter, 659.25, start + 0.055, 0.84, 'triangle', 0.13)
  head(audio, filter, 783.99, start + 0.11, 0.78, 'sine', 0.11)
  head(audio, filter, 1046.5, start + 0.16, 0.55, 'sine', 0.07)
  head(audio, filter, 523.25 * 2.01, start + 0.02, 0.7, 'sine', 0.035)
}
