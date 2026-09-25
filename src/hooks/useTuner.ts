import { useCallback, useEffect, useRef, useState } from 'react'

import { analyzeFrequency, A4_HZ, rms } from '@/lib/notes'
import {
  connectRawInput,
  createTunerContext,
  isPermissionError,
  isUnavailableError,
  logCapture,
  requestRawMic,
} from '@/lib/mic-capture'
import { createSmoothState, pushEstimate, type SmoothState } from '@/lib/pitch-smooth'
import { createPitchScratch, estimateFromFilled } from '@/lib/yin'

const AGC_TARGET = 0.055
const AGC_MIN = 1.05
const AGC_MAX = 8
const UI_PERIOD_MS = 16

export type TunerStatus =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'denied'
  | 'unavailable'
  | 'error'

export type TunerReading = ReturnType<typeof analyzeFrequency> & {
  clarity: number
}

type EstimateMsg = {
  type: 'estimate'
  hz: number
  clarity: number
  rms: number
  time: number
}

async function loadPitchWorklet(audio: AudioContext): Promise<boolean> {
  if (!audio.audioWorklet) return false
  try {
    await audio.audioWorklet.addModule(`${import.meta.env.BASE_URL}tuner/pitch-processor.js`)
    return true
  } catch {
    return false
  }
}

export function useTuner(a4Hz = A4_HZ) {
  const [status, setStatus] = useState<TunerStatus>('idle')
  const [reading, setReading] = useState<TunerReading | null>(null)

  const statusRef = useRef(status)
  const readingRef = useRef(reading)
  const audioRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const oscRef = useRef<OscillatorNode | null>(null)
  const workletRef = useRef<AudioWorkletNode | null>(null)
  const makeupRef = useRef<GainNode | null>(null)
  const rafRef = useRef(0)
  const sessionRef = useRef(0)
  const a4Ref = useRef(a4Hz)
  const smoothRef = useRef<SmoothState>(createSmoothState())
  const lastPublishRef = useRef(0)
  const lastTickRef = useRef(0)
  const agcRef = useRef(2.4)

  statusRef.current = status
  readingRef.current = reading
  a4Ref.current = a4Hz

  const applyEstimate = useCallback((hz: number, clarity: number, signal: number, now: number) => {
    const prev = lastTickRef.current || now
    lastTickRef.current = now
    const dt = Math.min(0.05, Math.max(0.003, (now - prev) / 1000))
    const next = pushEstimate(smoothRef.current, hz, clarity, signal, now, dt)

    if (next.hz === null) {
      if (readingRef.current !== null && now - lastPublishRef.current > 32) {
        lastPublishRef.current = now
        setReading(null)
      }
      return
    }

    const due = next.snapped || now - lastPublishRef.current >= UI_PERIOD_MS
    if (!due) return
    lastPublishRef.current = now
    const note = analyzeFrequency(next.hz, a4Ref.current)
    setReading({ ...note, clarity })
  }, [])

  const stop = useCallback(() => {
    sessionRef.current += 1
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    lastPublishRef.current = 0
    lastTickRef.current = 0
    smoothRef.current = createSmoothState()
    makeupRef.current = null
    agcRef.current = 2.4

    const worklet = workletRef.current
    workletRef.current = null
    try {
      worklet?.port.close()
      worklet?.disconnect()
    } catch {
      // already gone
    }

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

    if (!window.isSecureContext) {
      setStatus('unavailable')
      return
    }

    setStatus('starting')
    setReading(null)
    smoothRef.current = createSmoothState()

    const session = sessionRef.current + 1
    sessionRef.current = session

    let audio: AudioContext
    try {
      audio = await createTunerContext()
    } catch {
      if (sessionRef.current === session) setStatus('unavailable')
      return
    }

    if (sessionRef.current !== session) {
      await audio.close()
      return
    }

    const demoHz = Number(new URLSearchParams(window.location.search).get('demo'))
    const useDemo = Number.isFinite(demoHz) && demoHz > 20 && demoHz < 4000

    let source: AudioNode
    if (useDemo) {
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      gain.gain.value = 0.22
      oscillator.type = 'sawtooth'
      oscillator.frequency.value = demoHz
      oscillator.connect(gain)
      oscillator.start()
      oscRef.current = oscillator
      source = gain
    } else {
      let stream: MediaStream
      try {
        stream = await requestRawMic()
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

      streamRef.current = stream
      const track = stream.getAudioTracks()[0]
      if (track) {
        logCapture({
          settings: track.getSettings(),
          constraints: track.getConstraints(),
          contextSampleRate: audio.sampleRate,
          baseLatency: audio.baseLatency,
          outputLatency: 'outputLatency' in audio ? audio.outputLatency : null,
        })
      }
      source = audio.createMediaStreamSource(stream)
    }

    if (audio.state === 'suspended') {
      try {
        await audio.resume()
      } catch {
        // iOS can reject a late resume; start() itself is the gesture.
      }
    }

    const workletOk = await loadPitchWorklet(audio)
    if (sessionRef.current !== session) {
      streamRef.current?.getTracks().forEach((item) => item.stop())
      await audio.close()
      return
    }

    audioRef.current = audio

    const onEstimate = (hz: number, clarity: number, signal: number) => {
      if (sessionRef.current !== session) return
      if (signal > 0.0012) {
        const desired = Math.min(AGC_MAX, Math.max(AGC_MIN, AGC_TARGET / signal))
        agcRef.current = agcRef.current * 0.88 + desired * 0.12
      } else {
        agcRef.current = agcRef.current * 0.96 + AGC_MIN * 0.04
      }
      const makeup = makeupRef.current
      if (makeup) {
        const nextGain = Math.min(6.2, 1.15 + agcRef.current * 0.32)
        makeup.gain.setTargetAtTime(nextGain, audio.currentTime, 0.03)
      }
      applyEstimate(hz, clarity, signal * agcRef.current, performance.now())
    }

    if (workletOk) {
      const node = new AudioWorkletNode(audio, 'omnician-pitch', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      })
      node.port.onmessage = (event: MessageEvent<EstimateMsg>) => {
        if (event.data?.type !== 'estimate') return
        onEstimate(event.data.hz, event.data.clarity, event.data.rms)
      }
      makeupRef.current = connectRawInput(audio, source, node)
      workletRef.current = node
    } else {
      const analyser = audio.createAnalyser()
      analyser.fftSize = 4096
      analyser.smoothingTimeConstant = 0
      makeupRef.current = connectRawInput(audio, source, analyser)
      const scratch = createPitchScratch(4096)
      const buffer = new Float32Array(4096)
      let prevHz: number | null = null
      const tick = () => {
        if (sessionRef.current !== session) return
        analyser.getFloatTimeDomainData(buffer)
        const signal = rms(buffer.subarray(buffer.length - 512))
        const estimate = estimateFromFilled(buffer, buffer.length, audio.sampleRate, scratch, prevHz)
        if (estimate.frequency > 0 && estimate.clarity >= 0.55) prevHz = estimate.frequency
        onEstimate(estimate.frequency, estimate.clarity, signal)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    setStatus('listening')
  }, [applyEstimate])

  useEffect(() => {
    const resume = () => {
      const audio = audioRef.current
      if (audio && audio.state === 'suspended') void audio.resume()
    }
    window.addEventListener('pointerdown', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      window.removeEventListener('pointerdown', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [])

  useEffect(() => () => stop(), [stop])

  return { status, reading, start, stop }
}
