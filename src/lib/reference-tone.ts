import { getSharedAudioContext, resumeSharedAudioContext } from '@/lib/audio-context'
import type { FamilyId } from '@/lib/presets'
import { familyTone } from '@/lib/headstock'

export type ToneAction = 'start' | 'switch' | 'stop'

export function nextToneAction(playingId: string | null, tappedId: string): ToneAction {
  if (!tappedId) return 'stop'
  if (playingId === tappedId) return 'stop'
  if (playingId) return 'switch'
  return 'start'
}

/** True when a detected pitch is almost certainly speaker bleed from the fork. */
export function isReferenceToneLeak(hz: number, rejectHz: number | null, signal: number): boolean {
  if (!rejectHz || rejectHz < 20 || !(hz > 0) || !Number.isFinite(hz)) return false
  const cents = 1200 * Math.log2(hz / rejectHz)
  const nearFund = Math.abs(cents) < 10
  const nearOctave = Math.abs(Math.abs(cents) - 1200) < 10
  if (!nearFund && !nearOctave) return false
  return signal < 0.035
}

type Playing = {
  id: string
  hz: number
  family: FamilyId
  master: GainNode
  osc: OscillatorNode[]
}

let playing: Playing | null = null
const listeners = new Set<(id: string | null) => void>()
const hzListeners = new Set<(hz: number | null) => void>()

function emit(): void {
  const id = playing?.id ?? null
  const hz = playing?.hz ?? null
  for (const listener of listeners) listener(id)
  for (const listener of hzListeners) listener(hz)
}

export function getPlayingToneId(): string | null {
  return playing?.id ?? null
}

export function getPlayingToneHz(): number | null {
  return playing?.hz ?? null
}

export function subscribePlayingTone(listener: (id: string | null) => void): () => void {
  listeners.add(listener)
  listener(playing?.id ?? null)
  return () => {
    listeners.delete(listener)
  }
}

export function onReferenceToneChange(listener: (hz: number | null) => void): () => void {
  hzListeners.add(listener)
  listener(playing?.hz ?? null)
  return () => {
    hzListeners.delete(listener)
  }
}

function fadeOut(voice: Playing, audio: AudioContext): void {
  const now = audio.currentTime
  try {
    voice.master.gain.cancelScheduledValues(now)
    voice.master.gain.setValueAtTime(Math.max(0.0001, voice.master.gain.value), now)
    voice.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
  } catch {
    // already gone
  }
  window.setTimeout(() => {
    for (const osc of voice.osc) {
      try {
        osc.stop()
      } catch {
        // already stopped
      }
      try {
        osc.disconnect()
      } catch {
        // already gone
      }
    }
    try {
      voice.master.disconnect()
    } catch {
      // already gone
    }
  }, 180)
}

function startVoice(id: string, frequency: number, family: FamilyId): void {
  let audio: AudioContext
  try {
    audio = getSharedAudioContext()
  } catch {
    return
  }
  void resumeSharedAudioContext()

  if (playing) {
    fadeOut(playing, audio)
    playing = null
  }

  if (!(frequency > 20) || !Number.isFinite(frequency)) return

  const tone = familyTone(family)
  const now = audio.currentTime + 0.008
  const peak = tone === 'bass' ? 0.16 : tone === 'ukulele' ? 0.13 : 0.14

  const master = audio.createGain()
  master.gain.setValueAtTime(0.0001, now)
  master.gain.exponentialRampToValueAtTime(peak, now + 0.09)
  master.connect(audio.destination)

  const filter = audio.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = tone === 'bass' ? 720 : tone === 'ukulele' ? 2600 : 1800
  filter.Q.value = 0.7
  filter.connect(master)

  const fundamental = audio.createOscillator()
  const fundGain = audio.createGain()
  fundamental.type = 'sine'
  fundamental.frequency.setValueAtTime(frequency, now)
  fundGain.gain.value = tone === 'bass' ? 0.86 : 0.78
  fundamental.connect(fundGain)
  fundGain.connect(filter)
  fundamental.start(now)

  const partial = audio.createOscillator()
  const partGain = audio.createGain()
  partial.type = 'sine'
  partial.frequency.setValueAtTime(frequency * 2, now)
  partGain.gain.value = tone === 'ukulele' ? 0.1 : 0.07
  partial.connect(partGain)
  partGain.connect(filter)
  partial.start(now)

  playing = { id, hz: frequency, family, master, osc: [fundamental, partial] }
  emit()
}

export function stopReferenceTone(): void {
  if (!playing) return
  try {
    fadeOut(playing, getSharedAudioContext())
  } catch {
    // context already gone
  }
  playing = null
  emit()
}

export function retunePlayingTone(frequency: number): void {
  if (!playing || !(frequency > 20) || !Number.isFinite(frequency)) return
  playing.hz = frequency
  try {
    const audio = getSharedAudioContext()
    const now = audio.currentTime
    playing.osc[0]?.frequency.setTargetAtTime(frequency, now, 0.02)
    playing.osc[1]?.frequency.setTargetAtTime(frequency * 2, now, 0.02)
  } catch {
    // ignore
  }
  emit()
}

export function toggleReferenceTone(opts: {
  id: string
  frequency: number
  family: FamilyId
}): ToneAction {
  const action = nextToneAction(playing?.id ?? null, opts.id)
  if (action === 'stop') {
    stopReferenceTone()
    return action
  }
  startVoice(opts.id, opts.frequency, opts.family)
  return action
}

/** Start or switch to this pitch. Same-id taps still restart (legacy one-shot callers). */
export function playReferenceTone(frequency: number, family: FamilyId, id = 'legacy'): void {
  startVoice(id, frequency, family)
}
