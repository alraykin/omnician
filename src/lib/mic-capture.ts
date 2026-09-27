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

function errorName(error: unknown): string {
  if (!error || typeof error !== 'object' || !('name' in error)) return ''
  return String(error.name)
}

function errorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error)) return ''
  return String(error.message)
}

export function isPermissionError(error: unknown): boolean {
  const name = errorName(error)
  return (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError'
  )
}

export function isUnavailableError(error: unknown): boolean {
  const name = errorName(error)
  return (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    name === 'NotReadableError' ||
    name === 'OverconstrainedError' ||
    errorMessage(error) === 'NO_MIC_API'
  )
}

export function createTunerContextSync(): AudioContext {
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) throw Object.assign(new Error('NO_AUDIO'), { code: 'unavailable' })

  // Use the hardware rate. Forcing 48 kHz leaves Safari/iOS MediaStream
  // sources silent, so the tuner looks "on" but never hears a note.
  try {
    return new Ctor({ latencyHint: 'interactive' })
  } catch {
    return new Ctor()
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

  // Chrome will process a worklet/analyser that is only an input sink.
  // Safari and iOS WebKit skip those nodes unless the graph reaches destination.
  // Keep the tap silent so the mic is never routed to the speakers.
  const silent = audio.createGain()
  silent.gain.value = 0
  dest.connect(silent)
  silent.connect(audio.destination)
  return makeup
}
