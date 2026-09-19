import { useCallback, useEffect, useRef, useState } from 'react'

import { analyzeFrequency, rms, type DetectedNote } from '@/lib/notes'
import {
  createPitchDetector,
  estimatePitch,
  PITCH_BUFFER_SIZE,
} from '@/lib/pitch-detector'
import { SENSITIVITY, type Sensitivity } from '@/lib/sensitivity'

const MIN_HZ = 20
const MAX_HZ = 2000

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
      autoGainControl: false,
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

export function useTuner(sensitivity: Sensitivity) {
  const [status, setStatus] = useState<TunerStatus>('idle')
  const [reading, setReading] = useState<TunerReading | null>(null)
  const [level, setLevel] = useState(0)

  const statusRef = useRef(status)
  const audioRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const oscRef = useRef<OscillatorNode | null>(null)
  const rafRef = useRef<number>(0)
  const lastHeardRef = useRef(0)
  const smoothHzRef = useRef<number | null>(null)
  const sessionRef = useRef(0)
  const sensitivityRef = useRef(sensitivity)

  statusRef.current = status
  sensitivityRef.current = sensitivity

  const stop = useCallback(() => {
    sessionRef.current += 1
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    lastHeardRef.current = 0
    smoothHzRef.current = null

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
    setLevel(0)
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
      gain.gain.value = 0.25
      oscillator.type = 'sine'
      oscillator.frequency.value = demoHz
      oscillator.connect(gain)
      gain.connect(analyser)
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

      audio.createMediaStreamSource(stream).connect(analyser)
      streamRef.current = stream
    }

    const detector = createPitchDetector()
    const buffer = new Float32Array(PITCH_BUFFER_SIZE)

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
      const signal = rms(buffer)
      setLevel(Math.min(1, signal * 12))

      const { frequency, clarity } = estimatePitch(
        detector,
        buffer,
        audio.sampleRate,
      )
      const now = performance.now()
      const feel = SENSITIVITY[sensitivityRef.current]
      const strong =
        Number.isFinite(frequency) &&
        frequency >= MIN_HZ &&
        frequency <= MAX_HZ &&
        clarity >= feel.minClarity &&
        signal >= feel.minRms

      if (strong) {
        const previous = smoothHzRef.current
        const next =
          previous &&
          Math.abs(12 * Math.log2(frequency / previous)) < feel.jumpSemitones
            ? previous * feel.smoothPrev + frequency * feel.smoothNext
            : frequency
        smoothHzRef.current = next
        lastHeardRef.current = now
        const note = analyzeFrequency(next)
        setReading({ ...note, clarity })
      } else if (now - lastHeardRef.current > feel.holdMs) {
        smoothHzRef.current = null
        setReading(null)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => () => stop(), [stop])

  return { status, reading, level, start, stop }
}
