import { useCallback, useEffect, useRef, useState } from 'react'

import { A4_HZ, analyzeFrequency, rms, type DetectedNote } from '@/lib/notes'
import {
  createPitchDetector,
  estimatePitch,
  PITCH_BUFFER_SIZE,
} from '@/lib/pitch-detector'
import { SENSITIVITY, type Sensitivity } from '@/lib/sensitivity'

const MIN_HZ = 28
const MAX_HZ = 2000
const LOW_BAND_HZ = 80
const RUMBLE_HZ = 50

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

function passesConfidence(
  frequency: number,
  clarity: number,
  signal: number,
  minClarity: number,
  minRms: number,
): boolean {
  if (!Number.isFinite(frequency) || frequency < MIN_HZ || frequency > MAX_HZ) {
    return false
  }

  let clarityFloor = minClarity
  let rmsFloor = minRms

  if (frequency < RUMBLE_HZ) {
    clarityFloor = Math.max(clarityFloor, 0.93)
    rmsFloor = Math.max(rmsFloor, 0.018)
  } else if (frequency < LOW_BAND_HZ) {
    clarityFloor = Math.max(clarityFloor, 0.89)
    rmsFloor = Math.max(rmsFloor, 0.012)
  }

  return clarity >= clarityFloor && signal >= rmsFloor
}

export function useTuner(sensitivity: Sensitivity, a4Hz = A4_HZ) {
  const [status, setStatus] = useState<TunerStatus>('idle')
  const [reading, setReading] = useState<TunerReading | null>(null)
  const [level, setLevel] = useState(0)

  const statusRef = useRef(status)
  const audioRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const oscRef = useRef<OscillatorNode | null>(null)
  const rafRef = useRef(0)
  const lastHeardRef = useRef(0)
  const smoothHzRef = useRef<number | null>(null)
  const pendingHzRef = useRef<number | null>(null)
  const pendingCountRef = useRef(0)
  const sessionRef = useRef(0)
  const sensitivityRef = useRef(sensitivity)
  const a4Ref = useRef(a4Hz)

  statusRef.current = status
  sensitivityRef.current = sensitivity
  a4Ref.current = a4Hz

  const stop = useCallback(() => {
    sessionRef.current += 1
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    lastHeardRef.current = 0
    smoothHzRef.current = null
    pendingHzRef.current = null
    pendingCountRef.current = 0

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
      const strong = passesConfidence(
        frequency,
        clarity,
        signal,
        feel.minClarity,
        feel.minRms,
      )

      if (strong) {
        const pending = pendingHzRef.current
        const samePitch =
          pending !== null &&
          Math.abs(12 * Math.log2(frequency / pending)) < 0.32

        if (samePitch && pending !== null) {
          pendingHzRef.current = pending * 0.55 + frequency * 0.45
          pendingCountRef.current += 1
        } else {
          pendingHzRef.current = frequency
          pendingCountRef.current = 1
        }

        const needed = frequency < LOW_BAND_HZ ? 3 : 2
        if (pendingCountRef.current >= needed) {
          const accepted = pendingHzRef.current ?? frequency
          const previous = smoothHzRef.current
          const next =
            previous &&
            Math.abs(12 * Math.log2(accepted / previous)) < feel.jumpSemitones
              ? previous * feel.smoothPrev + accepted * feel.smoothNext
              : accepted
          smoothHzRef.current = next
          lastHeardRef.current = now
          const note = analyzeFrequency(next, a4Ref.current)
          setReading({ ...note, clarity })
        }
      } else {
        pendingCountRef.current = Math.max(0, pendingCountRef.current - 1)
        if (pendingCountRef.current === 0) pendingHzRef.current = null
        if (now - lastHeardRef.current > feel.holdMs) {
          smoothHzRef.current = null
          setReading(null)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => () => stop(), [stop])

  return { status, reading, level, start, stop }
}
