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
  addListener?: (
    event: string,
    cb: (data: { action?: string; event?: string }) => void,
  ) => Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> }
}

const OmnicianAudio = registerPlugin<NativeAudioPlugin>('OmnicianAudio')

let lastNativeSession: NativeSessionSnapshot | null = null
let lastAskedCategory: 'playback' | 'playAndRecord' | null = null
let sessionListenerWired = false
const sessionListeners = new Set<(event: string) => void>()
let applySeq = 0
let applyChain: Promise<void> = Promise.resolve()
let testPlugin: NativeAudioPlugin | null | undefined

function nativePlugin(): NativeAudioPlugin | null {
  if (testPlugin !== undefined) return testPlugin
  if (typeof window === 'undefined') return null
  if (!Capacitor.isNativePlatform()) return null
  return OmnicianAudio
}

/** Tests inject a fake OmnicianAudio plugin so session writes can be asserted in Node. */
export function installNativeAudioPluginForTests(plugin: NativeAudioPlugin | null | undefined): void {
  testPlugin = plugin
}

/** Resolves after the latest native setSession write (or skip) has finished. */
export async function waitNativeAudioSession(): Promise<void> {
  await applyChain.catch(() => undefined)
}

export async function flushNativeAudioSessionForTests(): Promise<void> {
  await waitNativeAudioSession()
}

/**
 * Talks to the iOS OmnicianAudio plugin when running inside Capacitor.
 * Click/Drums use exclusive `.playback`; tuner mic uses playAndRecord.
 * No-ops in Safari so the live web app is unchanged.
 * Skips the native bridge when the category is already what we asked for —
 * re-setCategory while Web Audio runs interrupts WKWebView.
 */
export function applyNativeAudioSession(kind: 'playback' | 'play-and-record'): boolean {
  const plugin = nativePlugin()
  if (!plugin?.setSession) return false
  const category = kind === 'play-and-record' ? 'playAndRecord' : 'playback'
  // Only skip a confirmed redundant .playback write. Re-setCategory while
  // Click/Drums are live interrupts WKWebView. Never skip playAndRecord:
  // Click may have an in-flight .playback write, and lastNativeSession can
  // still show the previous tuner snapshot.
  if (
    category === 'playback' &&
    lastAskedCategory === 'playback' &&
    lastNativeSession?.category === 'playback'
  ) {
    return true
  }
  lastAskedCategory = category
  const seq = ++applySeq
  applyChain = applyChain.catch(() => undefined).then(async () => {
    if (seq !== applySeq || lastAskedCategory !== category) return
    try {
      const row = await plugin.setSession!({ category })
      if (seq !== applySeq) return
      if (row && typeof row === 'object' && 'category' in row) {
        lastNativeSession = row as NativeSessionSnapshot
      }
    } catch {
      /* Native session is best-effort; Safari audioSession still applies. */
    }
  })
  return true
}

export function peekNativeAudioSession(): NativeSessionSnapshot | null {
  return lastNativeSession
}

export function resetNativeAudioSessionForTests(): void {
  lastNativeSession = null
  lastAskedCategory = null
  sessionListenerWired = false
  sessionListeners.clear()
  applySeq = 0
  applyChain = Promise.resolve()
  testPlugin = undefined
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

export function listenNativeSession(onEvent: (event: string) => void): () => void {
  sessionListeners.add(onEvent)
  wireNativeSessionListener()
  return () => {
    sessionListeners.delete(onEvent)
  }
}

function wireNativeSessionListener(): void {
  if (sessionListenerWired) return
  const plugin = nativePlugin()
  if (!plugin?.addListener) return
  sessionListenerWired = true
  void Promise.resolve(
    plugin.addListener('session', (data) => {
      const event = typeof data?.event === 'string' ? data.event : ''
      if (!event) return
      if (event.startsWith('keepCategory-') || event.startsWith('setCategory-')) {
        const cat = event.slice(event.indexOf('-') + 1)
        if (cat === 'playback' || cat === 'playAndRecord') {
          lastAskedCategory = cat
          if (lastNativeSession) lastNativeSession = { ...lastNativeSession, category: cat }
        }
      }
      for (const listener of sessionListeners) listener(event)
    }),
  ).catch(() => {
    sessionListenerWired = false
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
