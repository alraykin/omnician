import { Capacitor, registerPlugin } from '@capacitor/core'

export type NativeDecodedSample = {
  sampleRate: number
  numberOfChannels: number
  length: number
  pcmBase64: string
}

export type NativeSessionSnapshot = {
  category: string
  options: string
  otherAudioPlaying: boolean
  nowPlaying?: boolean
}

type NativeAudioPlugin = {
  setSession?: (options: { category: 'playback' | 'playAndRecord' }) => Promise<NativeSessionSnapshot | unknown>
  getSession?: () => Promise<NativeSessionSnapshot>
  setNowPlaying?: (options: { title: string; subtitle: string; playing: boolean; artworkUrl?: string }) => Promise<unknown>
  clearNowPlaying?: () => Promise<unknown>
  decodeSample?: (options: { base64: string; ext?: string }) => Promise<NativeDecodedSample>
  addListener?: (event: string, cb: (data: { action?: string }) => void) => Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> }
}

const OmnicianAudio = registerPlugin<NativeAudioPlugin>('OmnicianAudio')

function nativePlugin(): NativeAudioPlugin | null {
  if (typeof window === 'undefined') return null
  if (!Capacitor.isNativePlatform()) return null
  return OmnicianAudio
}

let lastNativeSession: NativeSessionSnapshot | null = null

/**
 * Talks to the iOS OmnicianAudio plugin when running inside Capacitor.
 * Click/Drums use exclusive `.playback`; tuner mic uses playAndRecord.
 * No-ops in Safari so the live web app is unchanged.
 */
export function applyNativeAudioSession(kind: 'playback' | 'play-and-record'): boolean {
  const plugin = nativePlugin()
  if (!plugin?.setSession) return false
  const category = kind === 'play-and-record' ? 'playAndRecord' : 'playback'
  void plugin.setSession({ category }).then((row) => {
    if (row && typeof row === 'object' && 'category' in row) {
      lastNativeSession = row as NativeSessionSnapshot
    }
  }).catch(() => {
    /* Native session is best-effort; Safari audioSession still applies. */
  })
  return true
}

export function peekNativeAudioSession(): NativeSessionSnapshot | null {
  return lastNativeSession
}

export function pullNativeAudioSession(): void {
  const plugin = nativePlugin()
  if (!plugin?.getSession) return
  void plugin.getSession().then((row) => {
    if (row && typeof row === 'object') lastNativeSession = row
  }).catch(() => {
    /* overlay only */
  })
}

export function publishNativeNowPlaying(info: {
  title: string
  subtitle: string
  playing: boolean
  artworkUrl?: string
}): void {
  const plugin = nativePlugin()
  if (!plugin?.setNowPlaying) return
  void plugin.setNowPlaying(info).catch(() => {
    /* JS MediaSession still applies */
  })
}

export function clearNativeNowPlaying(): void {
  const plugin = nativePlugin()
  if (!plugin?.clearNowPlaying) return
  void plugin.clearNowPlaying().catch(() => {
    /* ignore */
  })
}

export function listenNativeRemote(onAction: (action: string) => void): () => void {
  const plugin = nativePlugin()
  if (!plugin?.addListener) return () => {}
  let removed = false
  let handle: { remove: () => Promise<void> } | null = null
  void Promise.resolve(plugin.addListener('remote', (data) => {
    const action = typeof data?.action === 'string' ? data.action : 'toggle'
    onAction(action)
  })).then((next) => {
    if (removed) {
      void next?.remove?.()
      return
    }
    handle = next
  }).catch(() => {
    /* no native plugin */
  })
  return () => {
    removed = true
    void handle?.remove?.()
  }
}

/** Decode licensed sample bytes with AVAudioFile when WKWebView decodeAudioData fails. */
export async function decodeSampleNative(data: ArrayBuffer, ext: string): Promise<NativeDecodedSample | null> {
  const plugin = nativePlugin()
  if (!plugin?.decodeSample) return null
  try {
    return await plugin.decodeSample({ base64: arrayBufferToBase64(data), ext })
  } catch {
    return null
  }
}

export function nativePcmToAudioBuffer(ctx: BaseAudioContext, decoded: NativeDecodedSample): AudioBuffer {
  const bytes = base64ToBytes(decoded.pcmBase64)
  const aligned = bytes.byteOffset % 4 === 0 ? bytes : bytes.slice()
  const interleaved = new Float32Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / 4)
  const channels = Math.max(1, Math.floor(decoded.numberOfChannels) || 1)
  const length = Math.max(1, Math.floor(decoded.length) || Math.floor(interleaved.length / channels))
  const rate = decoded.sampleRate > 0 ? decoded.sampleRate : ctx.sampleRate
  const buffer = ctx.createBuffer(channels, length, rate)
  for (let c = 0; c < channels; c += 1) {
    const dest = buffer.getChannelData(c)
    for (let i = 0; i < length; i += 1) {
      dest[i] = interleaved[i * channels + c] ?? 0
    }
  }
  return buffer
}

function arrayBufferToBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}
