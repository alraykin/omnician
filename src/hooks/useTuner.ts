import { useCallback, useEffect, useRef, useState } from 'react'

import { TUNER_FEEL } from '@/lib/feel'
import { A4_HZ, analyzeFrequency, rms, type DetectedNote } from '@/lib/notes'
import {
  createPitchDetector,
  estimatePitch,
  PITCH_BUFFER_SIZE,
} from '@/lib/pitch-detector'

const MIN_HZ = 30
const MAX_HZ = 1400
const LOW_BAND_HZ = 80
const RUMBLE_HZ = 52
const AGC_TARGET = 0.06
const AGC_MIN = 1.1
const AGC_MAX = 10

export type TunerStatus =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'denied'
  | 'unavailable'
  | 'error'

export type TunerReading = DetectedNote & {
  clarity: number
}

type AudioContextCtor = typeof AudioContext

function getAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const view = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? view.webkitAudioContext
}

async function requestMic(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error('NO_MIC_API'), { code: 'unavailable' })
  }

  const detailed: MediaStreamConstraints = {
    audio: {
      echoCancellation: false,
      autoGainControl: true,
      noiseSuppression: false,
      channelCount: 1,
    },
    video: false,
  }

  try {
    return await navigator.mediaDevices.getUserMedia(detailed)
  } catch (error) {
    if (isPermissionError(error)) throw error
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  }
}

function isPermissionError(error: unknown): boolean {
  if (!(error instanceof DOMException) && !(error instanceof Error)) return false
  return (
    error.name === 'NotAllowedError' ||
    error.name === 'PermissionDeniedError' ||
    error.name === 'SecurityError'
  )
}

function isUnavailableError(error: unknown): boolean {
  if (!(error instanceof DOMException) && !(error instanceof Error)) return false
  return (
    error.name === 'NotFoundError' ||
    error.name === 'DevicesNotFoundError' ||
    error.name === 'NotReadableError' ||
    error.name === 'OverconstrainedError' ||
    (error instanceof Error && error.message === 'NO_MIC_API')
  )
}

function passesConfidence(
  frequency: number,
  clarity: number,
  signal: number,
): boolean {
  if (!Number.isFinite(frequency) || frequency < MIN_HZ || frequency > MAX_HZ) {
    return false
  }

  let clarityFloor = TUNER_FEEL.minClarity
  let rmsFloor = TUNER_FEEL.minRms

  if (frequency < RUMBLE_HZ) {
    clarityFloor = Math.max(clarityFloor, 0.9)
    rmsFloor = Math.max(rmsFloor, 0.012)
  } else if (frequency < LOW_BAND_HZ) {
    clarityFloor = Math.max(clarityFloor, 0.84)
    rmsFloor = Math.max(rmsFloor, 0.006)
  }

  return clarity >= clarityFloor && signal >= rmsFloor
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function connectInput(audio: AudioContext, source: AudioNode, analyser: AnalyserNode) {
  const highpass = audio.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 40
  highpass.Q.value = 0.65

  const compressor = audio.createDynamicsCompressor()
  compressor.threshold.value = -36
  compressor.knee.value = 24
  compressor.ratio.value = 8
  compressor.attack.value = 0.005
  compressor.release.value = 0.2

  const makeup = audio.createGain()
  makeup.gain.value = 2.6

  source.connect(highpass)
  highpass.connect(compressor)
  compressor.connect(makeup)
  makeup.connect(analyser)

  return makeup
}

export function useTuner(a4Hz = A4_HZ) {
  const [status, setStatus] = useState<TunerStatus>('idle')
  const [reading, setReading] = useState<TunerReading | null>(null)

  const statusRef = useRef(status)
  const audioRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const oscRef = useRef<OscillatorNode | null>(null)
  const makeupRef = useRef<GainNode | null>(null)
  const rafRef = useRef(0)
  const lastHeardRef = useRef(0)
  const lastPublishRef = useRef(0)
  const smoothHzRef = useRef<number | null>(null)
  const pendingHzRef = useRef<number | null>(null)
  const pendingCountRef = useRef(0)
  const medianRef = useRef<number[]>([])
  const agcRef = useRef(3)
  const sessionRef = useRef(0)
  const a4Ref = useRef(a4Hz)

  statusRef.current = status
  a4Ref.current = a4Hz

  const stop = useCallback(() => {
    sessionRef.current += 1
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    lastHeardRef.current = 0
    lastPublishRef.current = 0
    smoothHzRef.current = null
    pendingHzRef.current = null
    pendingCountRef.current = 0
    medianRef.current = []
    makeupRef.current = null
    agcRef.current = 3

    const stream = streamRef.current
    streamRef.current = null
    stream?.getTracks().forEach((track) => track.stop())

    const oscillator = oscRef.current
    oscRef.current = null
    try {
      oscillator?.stop()
    } catch {
      // already stopped
    }

    const audio = audioRef.current
    audioRef.current = null
    if (audio && audio.state !== 'closed') {
      void audio.close()
    }

    setReading(null)
    setStatus('idle')
  }, [])

  const start = useCallback(async () => {
    if (statusRef.current === 'starting' || statusRef.current === 'listening') {
      return
    }

    const AudioContextCtor = getAudioContextCtor()
    if (!AudioContextCtor) {
      setStatus('unavailable')
      return
    }

    if (!window.isSecureContext) {
      setStatus('unavailable')
      return
    }

    setStatus('starting')
    setReading(null)

    const session = sessionRef.current + 1
    sessionRef.current = session

    const audio = new AudioContextCtor({ latencyHint: 'interactive' })
    try {
      if (audio.state === 'suspended') {
        await audio.resume()
      }
    } catch {
      await audio.close()
      if (sessionRef.current === session) setStatus('error')
      return
    }

    if (sessionRef.current !== session) {
      await audio.close()
      return
    }

    const analyser = audio.createAnalyser()
    analyser.fftSize = PITCH_BUFFER_SIZE
    analyser.smoothingTimeConstant = 0

    const demoHz = Number(
      new URLSearchParams(window.location.search).get('demo'),
    )
    const useDemo = Number.isFinite(demoHz) && demoHz > 20 && demoHz < 4000

    if (useDemo) {
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      gain.gain.value = 0.22
      oscillator.type = 'sine'
      oscillator.frequency.value = demoHz
      oscillator.connect(gain)
      makeupRef.current = connectInput(audio, gain, analyser)
      oscillator.start()
      oscRef.current = oscillator
    } else {
      let stream: MediaStream
      try {
        stream = await requestMic()
      } catch (error) {
        await audio.close()
        if (isPermissionError(error)) {
          if (sessionRef.current === session) setStatus('denied')
          return
        }
        if (isUnavailableError(error)) {
          if (sessionRef.current === session) setStatus('unavailable')
          return
        }
        if (sessionRef.current === session) setStatus('error')
        return
      }

      if (sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop())
        await audio.close()
        return
      }

      makeupRef.current = connectInput(
        audio,
        audio.createMediaStreamSource(stream),
        analyser,
      )
      streamRef.current = stream
    }

    const detector = createPitchDetector()
    const buffer = new Float32Array(PITCH_BUFFER_SIZE)
    const boosted = new Float32Array(PITCH_BUFFER_SIZE)

    audioRef.current = audio

    if (sessionRef.current !== session) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      try {
        oscRef.current?.stop()
      } catch {
        // already stopped
      }
      oscRef.current = null
      if (audio.state !== 'closed') void audio.close()
      return
    }

    setStatus('listening')

    const tick = () => {
      if (sessionRef.current !== session) return
      analyser.getFloatTimeDomainData(buffer)
      const raw = rms(buffer)
      if (raw > 0.0012) {
        const desired = Math.min(AGC_MAX, Math.max(AGC_MIN, AGC_TARGET / raw))
        agcRef.current = agcRef.current * 0.94 + desired * 0.06
      } else {
        agcRef.current = agcRef.current * 0.97 + AGC_MIN * 0.03
      }
      const agc = agcRef.current
      const makeup = makeupRef.current
      if (makeup) {
        const nextGain = Math.min(7, 1.3 + agc * 0.28)
        makeup.gain.value = makeup.gain.value * 0.9 + nextGain * 0.1
      }

      for (let i = 0; i < buffer.length; i += 1) {
        const sample = buffer[i] * agc
        boosted[i] = Math.max(-1, Math.min(1, sample))
      }
      const signal = rms(boosted)

      const { frequency, clarity } = estimatePitch(
        detector,
        boosted,
        audio.sampleRate,
      )
      const now = performance.now()
      const strong = passesConfidence(frequency, clarity, signal)

      if (strong) {
        const pending = pendingHzRef.current
        const samePitch =
          pending !== null &&
          Math.abs(12 * Math.log2(frequency / pending)) < 0.22

        if (samePitch && pending !== null) {
          pendingHzRef.current = pending * 0.65 + frequency * 0.35
          pendingCountRef.current += 1
        } else {
          pendingHzRef.current = frequency
          pendingCountRef.current = 1
        }

        const needed =
          frequency < RUMBLE_HZ ? TUNER_FEEL.lockFrames + 1 : TUNER_FEEL.lockFrames
        if (pendingCountRef.current >= needed) {
          const accepted = pendingHzRef.current ?? frequency
          const window = medianRef.current
          window.push(accepted)
          if (window.length > TUNER_FEEL.medianSize) window.shift()
          const mid = window.length >= 3 ? median(window) : accepted
          const previous = smoothHzRef.current
          const jump =
            previous === null
              ? 0
              : Math.abs(12 * Math.log2(mid / previous))
          let next = mid
          if (previous && jump < TUNER_FEEL.jumpSemitones) {
            const centsOff = jump * 100
            if (centsOff < 8) {
              next = previous * 0.965 + mid * 0.035
            } else if (centsOff < 18) {
              next = previous * 0.9 + mid * 0.1
            } else {
              next = previous * TUNER_FEEL.smoothPrev + mid * TUNER_FEEL.smoothNext
            }
          } else if (previous && jump >= TUNER_FEEL.jumpSemitones) {
            next = previous
            pendingCountRef.current = Math.min(pendingCountRef.current, 1)
          }
          smoothHzRef.current = next
          lastHeardRef.current = now
          if (now - lastPublishRef.current > 50) {
            lastPublishRef.current = now
            const note = analyzeFrequency(next, a4Ref.current)
            setReading({ ...note, clarity })
          }
        }
      } else {
        pendingCountRef.current = Math.max(0, pendingCountRef.current - 1)
        if (pendingCountRef.current === 0) {
          pendingHzRef.current = null
          medianRef.current = []
        }
        if (now - lastHeardRef.current > TUNER_FEEL.holdMs) {
          smoothHzRef.current = null
          setReading(null)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => () => stop(), [stop])

  return { status, reading, start, stop }
}
