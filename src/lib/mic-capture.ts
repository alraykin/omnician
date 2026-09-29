import { getSharedAudioContext, resumeSharedAudioContext } from '@/lib/audio-context'

type ChromeAudioTrack = MediaTrackConstraints & {
  googEchoCancellation?: boolean
  googNoiseSuppression?: boolean
  googAutoGainControl?: boolean
  googHighpassFilter?: boolean
  googTypingNoiseDetection?: boolean
  latency?: number
}

const INPUT_KEY = 'omnician.tuner-input.v1'

function rawAudio(deviceId?: string | null): ChromeAudioTrack {
  const constraints: ChromeAudioTrack = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 2, max: 2 },
    latency: 0.01,
    googEchoCancellation: false,
    googNoiseSuppression: false,
    googAutoGainControl: false,
    googHighpassFilter: false,
    googTypingNoiseDetection: false,
  }
  if (deviceId) {
    ;(constraints as MediaTrackConstraints).deviceId = { exact: deviceId }
  }
  return constraints
}

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

export function loadInputDeviceId(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(INPUT_KEY)
    return raw && raw.length > 0 ? raw : null
  } catch {
    return null
  }
}

export function saveInputDeviceId(id: string | null): void {
  if (typeof localStorage === 'undefined') return
  if (!id) localStorage.removeItem(INPUT_KEY)
  else localStorage.setItem(INPUT_KEY, id)
}

export async function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((item) => item.kind === 'audioinput')
  } catch {
    return []
  }
}

export async function requestRawMic(deviceId?: string | null): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error('NO_MIC_API'), { code: 'unavailable' })
  }

  const preferred = deviceId ?? loadInputDeviceId()
  const attempts: MediaStreamConstraints[] = [
    { audio: rawAudio(preferred), video: false },
    {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        ...(preferred ? { deviceId: { exact: preferred } } : {}),
      },
      video: false,
    },
    {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
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

export function captureSampleRate(stream: MediaStream): number | null {
  const rate = stream.getAudioTracks()[0]?.getSettings()?.sampleRate
  return typeof rate === 'number' && rate >= 8000 && rate <= 192000 ? rate : null
}

export function captureChannelCount(stream: MediaStream): number | null {
  const count = stream.getAudioTracks()[0]?.getSettings()?.channelCount
  return typeof count === 'number' && count > 0 ? count : null
}

export function captureDeviceLabel(stream: MediaStream): string {
  const track = stream.getAudioTracks()[0]
  return track?.label || 'Default input'
}

export function createTunerContextSync(_sampleRate?: number | null): AudioContext {
  return getSharedAudioContext()
}

export async function createTunerContext(): Promise<AudioContext> {
  const audio = getSharedAudioContext()
  await resumeSharedAudioContext()
  return audio
}

/** Mono downmix + 25 Hz high-pass + 1.5 kHz low-pass. No compressor or AGC. */
export function connectRawInput(audio: AudioContext, source: AudioNode, dest: AudioNode): GainNode {
  const mono = audio.createGain()
  mono.channelCount = 1
  mono.channelCountMode = 'explicit'
  mono.channelInterpretation = 'speakers'

  const highpass = audio.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 25
  highpass.Q.value = 0.707

  const lowpass = audio.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 1500
  lowpass.Q.value = 0.707

  source.connect(mono)
  mono.connect(highpass)
  highpass.connect(lowpass)
  lowpass.connect(dest)

  // Safari/WebKit skip worklets that never reach destination.
  const silent = audio.createGain()
  silent.gain.value = 0
  dest.connect(silent)
  silent.connect(audio.destination)
  return mono
}
