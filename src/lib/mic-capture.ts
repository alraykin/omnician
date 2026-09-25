type ChromeAudioTrack = MediaTrackConstraints & {
  googEchoCancellation?: boolean
  googNoiseSuppression?: boolean
  googAutoGainControl?: boolean
  googHighpassFilter?: boolean
  googTypingNoiseDetection?: boolean
  latency?: number
}

const RAW_AUDIO = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
  sampleRate: 48000,
  latency: 0.01,
  googEchoCancellation: false,
  googNoiseSuppression: false,
  googAutoGainControl: false,
  googHighpassFilter: false,
  googTypingNoiseDetection: false,
} as ChromeAudioTrack

export type CaptureReport = {
  settings: MediaTrackSettings
  constraints: MediaTrackConstraints
  contextSampleRate: number
  baseLatency: number
  outputLatency: number | null
}

export function logCapture(report: CaptureReport): void {
  if (!import.meta.env.DEV) return
  console.info('[omnician tuner] capture', {
    applied: report.settings,
    requested: report.constraints,
    contextSampleRate: report.contextSampleRate,
    baseLatencyMs: Math.round(report.baseLatency * 1000),
    outputLatencyMs:
      report.outputLatency === null ? null : Math.round(report.outputLatency * 1000),
  })
}

export async function requestRawMic(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error('NO_MIC_API'), { code: 'unavailable' })
  }

  const attempts: MediaStreamConstraints[] = [
    { audio: RAW_AUDIO, video: false },
    {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
      video: false,
    },
    { audio: true, video: false },
  ]

  let lastError: unknown
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      lastError = error
      if (isPermissionError(error)) throw error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('MIC_FAILED')
}

export function isPermissionError(error: unknown): boolean {
  if (!(error instanceof DOMException) && !(error instanceof Error)) return false
  return (
    error.name === 'NotAllowedError' ||
    error.name === 'PermissionDeniedError' ||
    error.name === 'SecurityError'
  )
}

export function isUnavailableError(error: unknown): boolean {
  if (!(error instanceof DOMException) && !(error instanceof Error)) return false
  return (
    error.name === 'NotFoundError' ||
    error.name === 'DevicesNotFoundError' ||
    error.name === 'NotReadableError' ||
    error.name === 'OverconstrainedError' ||
    (error instanceof Error && error.message === 'NO_MIC_API')
  )
}

export function createTunerContextSync(): AudioContext {
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) throw Object.assign(new Error('NO_AUDIO'), { code: 'unavailable' })

  try {
    return new Ctor({ latencyHint: 'interactive', sampleRate: 48000 })
  } catch {
    return new Ctor({ latencyHint: 'interactive' })
  }
}

export async function createTunerContext(): Promise<AudioContext> {
  const audio = createTunerContextSync()
  if (audio.state === 'suspended') {
    await audio.resume()
  }
  return audio
}

/** High-pass + mild compression after raw capture so AGC never lives in the OS. */
export function connectRawInput(audio: AudioContext, source: AudioNode, dest: AudioNode): GainNode {
  const highpass = audio.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 28
  highpass.Q.value = 0.55

  const compressor = audio.createDynamicsCompressor()
  compressor.threshold.value = -32
  compressor.knee.value = 18
  compressor.ratio.value = 4
  compressor.attack.value = 0.001
  compressor.release.value = 0.12

  const makeup = audio.createGain()
  makeup.gain.value = 2.1

  source.connect(highpass)
  highpass.connect(compressor)
  compressor.connect(makeup)
  makeup.connect(dest)
  return makeup
}
