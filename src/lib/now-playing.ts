import { noteAudioEvent } from '@/lib/audio-log'
import { isNativeApp } from '@/lib/native-origin'
import {
  clearNativeNowPlaying,
  listenNativeRemote,
  publishNativeNowPlaying,
} from '@/native/ios-audio-session'

export type NowPlayingTransport = {
  playing: () => boolean
  toggle: () => void
}

export type NowPlayingInfo = {
  title: string
  subtitle: string
  playing: boolean
}

const ARTWORK_PATH = '/brand/omnician-icon-512.png'
const TITLE = 'Omnician'

let transport: NowPlayingTransport | null = null
let current: NowPlayingInfo | null = null
let remoteWired = false
let clearTimer = 0
let ignoreRemoteUntil = 0
const REMOTE_ECHO_MS = 800

function ignoreRemoteEcho(): boolean {
  if (typeof performance === 'undefined') return false
  return performance.now() < ignoreRemoteUntil
}

function markRemoteEchoWindow(): void {
  if (typeof performance === 'undefined') return
  ignoreRemoteUntil = performance.now() + REMOTE_ECHO_MS
}

const DISABLED_REMOTE_ACTIONS = [
  'seekbackward',
  'seekforward',
  'seekto',
  'previoustrack',
  'nexttrack',
  'skipad',
] as const

export function nowPlayingArtworkUrl(): string {
  if (typeof window === 'undefined') return ARTWORK_PATH
  try {
    return new URL(ARTWORK_PATH, window.location.href).href
  } catch {
    return ARTWORK_PATH
  }
}

export function formatNowPlayingSubtitle(opts: {
  mode: 'click' | 'drums'
  bpm: number
  meter?: string
  beatName?: string
}): string {
  const bpm = Number.isFinite(opts.bpm) ? Math.round(opts.bpm) : 120
  if (opts.mode === 'click') {
    const meter = opts.meter && opts.meter.length > 0 ? opts.meter : '4/4'
    return `Click · ${bpm} BPM · ${meter}`
  }
  const beat = opts.beatName?.trim() || 'Drums'
  return `Drums · ${beat} · ${bpm} BPM`
}

export function countDomMediaElements(): number {
  if (typeof document === 'undefined') return 0
  return document.querySelectorAll('audio, video').length
}

export function mediaSessionDebug(): string {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) return 'none'
  const session = navigator.mediaSession
  const title = session.metadata?.title ?? ''
  const artist = session.metadata?.artist ?? ''
  const state = session.playbackState || 'none'
  return `${state} ${title}${artist ? ` / ${artist}` : ''}`.trim()
}

function mediaSession(): MediaSession | null {
  if (typeof navigator === 'undefined') return null
  return navigator.mediaSession ?? null
}

function onRemotePlay(): void {
  if (ignoreRemoteEcho()) {
    noteAudioEvent('remote play ignored echo')
    return
  }
  if (!transport?.playing()) {
    noteAudioEvent('remote play')
    transport?.toggle()
  }
}

function onRemotePause(): void {
  if (ignoreRemoteEcho()) {
    noteAudioEvent('remote pause ignored echo')
    return
  }
  if (transport?.playing()) {
    noteAudioEvent('remote pause')
    transport.toggle()
  }
}

function onRemoteToggle(): void {
  if (ignoreRemoteEcho()) {
    noteAudioEvent('remote toggle ignored echo')
    return
  }
  noteAudioEvent('remote toggle')
  transport?.toggle()
}

function wireMediaSessionHandlers(session: MediaSession): void {
  try {
    session.setActionHandler('play', onRemotePlay)
  } catch {
    /* unsupported */
  }
  try {
    session.setActionHandler('pause', onRemotePause)
  } catch {
    /* unsupported */
  }
  try {
    session.setActionHandler('stop', onRemotePause)
  } catch {
    /* unsupported */
  }
  for (const action of DISABLED_REMOTE_ACTIONS) {
    try {
      session.setActionHandler(action, null)
    } catch {
      /* unsupported action */
    }
  }
}

function wireNativeRemote(): void {
  if (remoteWired) return
  remoteWired = true
  listenNativeRemote((action) => {
    if (action === 'play') onRemotePlay()
    else if (action === 'pause' || action === 'stop') onRemotePause()
    else onRemoteToggle()
  })
}

function writeMediaSession(info: NowPlayingInfo): void {
  const session = mediaSession()
  if (!session) return
  try {
    session.metadata = new MediaMetadata({
      title: info.title,
      artist: info.subtitle,
      album: TITLE,
      artwork: [{ src: nowPlayingArtworkUrl(), sizes: '512x512', type: 'image/png' }],
    })
  } catch {
    try {
      session.metadata = new MediaMetadata({ title: info.title, artist: info.subtitle })
    } catch {
      /* WebView without MediaMetadata */
    }
  }
  // Native: never write playbackState or JS pause handlers. WebKit treats
  // that as a pause command and echoes it back, which Stop's the transport.
  // Dynamic Island remotes go through MPRemoteCommandCenter instead.
  if (isNativeApp()) return
  try {
    session.playbackState = info.playing ? 'playing' : 'paused'
  } catch {
    /* playbackState optional */
  }
  wireMediaSessionHandlers(session)
}

function wipeMediaSession(): void {
  const session = mediaSession()
  if (!session) return
  try {
    session.metadata = null
  } catch {
    /* ignore */
  }
  if (isNativeApp()) return
  try {
    session.playbackState = 'none'
  } catch {
    /* ignore */
  }
  for (const action of ['play', 'pause', 'stop', ...DISABLED_REMOTE_ACTIONS] as const) {
    try {
      session.setActionHandler(action, null)
    } catch {
      /* unsupported */
    }
  }
}

/** Title only — so WebKit never falls back to the webview origin. */
export function primeNowPlayingMetadata(): void {
  const session = mediaSession()
  if (!session) return
  if (session.metadata?.title === TITLE) return
  try {
    session.metadata = new MediaMetadata({
      title: TITLE,
      artist: '',
      album: TITLE,
      artwork: [{ src: nowPlayingArtworkUrl(), sizes: '512x512', type: 'image/png' }],
    })
  } catch {
    try {
      session.metadata = new MediaMetadata({ title: TITLE })
    } catch {
      /* WebView without MediaMetadata */
    }
  }
}

export function publishNowPlaying(info: NowPlayingInfo): void {
  if (clearTimer) {
    window.clearTimeout(clearTimer)
    clearTimer = 0
  }
  markRemoteEchoWindow()
  current = { ...info, title: TITLE }
  writeMediaSession(current)
  noteAudioEvent(`nowplaying ${current.subtitle}`)
  if (isNativeApp()) {
    wireNativeRemote()
    publishNativeNowPlaying({
      title: TITLE,
      subtitle: current.subtitle,
      playing: current.playing,
      artworkUrl: nowPlayingArtworkUrl(),
    })
  }
}

export function clearNowPlaying(): void {
  current = null
  wipeMediaSession()
  if (isNativeApp()) clearNativeNowPlaying()
  if (typeof window === 'undefined') return
  if (clearTimer) window.clearTimeout(clearTimer)
  clearTimer = window.setTimeout(() => {
    clearTimer = 0
    wipeMediaSession()
    if (isNativeApp()) clearNativeNowPlaying()
  }, 1200)
}

export function bindNowPlayingTransport(next: NowPlayingTransport): () => void {
  transport = next
  if (isNativeApp()) wireNativeRemote()
  return () => {
    if (transport === next) transport = null
  }
}

export function peekNowPlaying(): NowPlayingInfo | null {
  return current
}

export function resetNowPlayingForTests(): void {
  transport = null
  current = null
  remoteWired = false
  ignoreRemoteUntil = 0
  if (clearTimer) {
    try {
      window.clearTimeout(clearTimer)
    } catch {
      /* node */
    }
    clearTimer = 0
  }
  wipeMediaSession()
}
