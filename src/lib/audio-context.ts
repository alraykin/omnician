type AudioContextCtor = typeof AudioContext

type SafariAudioState = AudioContextState | 'interrupted'

export type AudioSessionType =
  | 'auto'
  | 'playback'
  | 'transient'
  | 'transient-solo'
  | 'ambient'
  | 'play-and-record'

export type AudioDebugSnapshot = {
  playbackState: string
  playbackRate: number | null
  playbackTime: number
  timeAdvancing: boolean
  captureState: string
  captureRate: number | null
  sessionType: string
  micTracks: number
  micLive: number
  silentUnlock: boolean
  lastRecovery: string
  recoveries: number
}

type AudioSessionApi = { type: string }

let playback: AudioContext | null = null
let capture: AudioContext | null = null
let lifecycleWired = false
let silentEl: HTMLAudioElement | null = null
let lastPlaybackTime = 0
let lastPlaybackCheck = 0
let timeAdvancing = false
let lastRecovery = 'none'
let recoveries = 0
let recovering = false

const liveStreams = new Set<MediaStream>()
const hiddenReleasers = new Set<() => void>()

export function getAudioCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const view = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? view.webkitAudioContext
}

function contextState(ctx: AudioContext | null): SafariAudioState | 'none' {
  if (!ctx) return 'none'
  return ctx.state as SafariAudioState
}

export function contextNeedsResume(ctx: AudioContext): boolean {
  const state = contextState(ctx)
  return state === 'suspended' || state === 'interrupted'
}

function getAudioSession(): AudioSessionApi | null {
  if (typeof navigator === 'undefined') return null
  const session = (navigator as Navigator & { audioSession?: AudioSessionApi }).audioSession
  return session ?? null
}

export function getAudioSessionType(): string {
  return getAudioSession()?.type ?? 'unsupported'
}

export function setAudioSessionType(type: AudioSessionType): void {
  const session = getAudioSession()
  if (!session) return
  try {
    session.type = type
  } catch {
    // older WebKit builds reject unknown types
  }
}

function createContext(): AudioContext {
  const Ctor = getAudioCtor()
  if (!Ctor) throw Object.assign(new Error('NO_AUDIO'), { code: 'unavailable' })
  // Do not force sampleRate — iOS goes silent if the hardware rate changes after mic use.
  try {
    return new Ctor({ latencyHint: 'interactive' })
  } catch {
    return new Ctor()
  }
}

export function syncAudioSession(): void {
  setAudioSessionType(liveStreams.size > 0 ? 'play-and-record' : 'playback')
}

export function stopMediaTracks(stream: MediaStream | null | undefined): void {
  if (!stream) return
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      // already ended
    }
  }
}

export function adoptMicStream(stream: MediaStream): MediaStream {
  liveStreams.add(stream)
  syncAudioSession()
  return stream
}

export function releaseMicStream(stream: MediaStream | null | undefined): void {
  if (!stream) return
  stopMediaTracks(stream)
  liveStreams.delete(stream)
  syncAudioSession()
  if (liveStreams.size === 0) {
    void disposeCaptureContext()
    void resumePlaybackAndRecover(true)
  }
}

export function releaseAllCapture(): void {
  for (const stream of liveStreams) {
    stopMediaTracks(stream)
  }
  liveStreams.clear()
  for (const release of hiddenReleasers) {
    try {
      release()
    } catch {
      // releaser must not throw
    }
  }
  syncAudioSession()
  void disposeCaptureContext()
}

export function onHiddenReleaseCapture(release: () => void): () => void {
  hiddenReleasers.add(release)
  return () => {
    hiddenReleasers.delete(release)
  }
}

async function disposeCaptureContext(): Promise<void> {
  if (liveStreams.size > 0) return
  const ctx = capture
  capture = null
  if (!ctx || contextState(ctx) === 'closed') return
  try {
    await ctx.close()
  } catch {
    // already closed
  }
}

export function getCaptureAudioContext(): AudioContext {
  if (capture && contextState(capture) !== 'closed') return capture
  capture = createContext()
  wireLifecycle()
  return capture
}

export function getPlaybackAudioContext(): AudioContext {
  if (playback && contextState(playback) !== 'closed') return playback
  playback = createContext()
  wireLifecycle()
  return playback
}

/** Playback context only. Never attach a microphone stream to this. */
export function getSharedAudioContext(): AudioContext {
  return getPlaybackAudioContext()
}

function armSilentUnlock(): void {
  if (typeof document === 'undefined') return
  if (!silentEl) {
    const el = document.createElement('audio')
    el.src = '/audio/silence.mp3'
    el.loop = true
    el.preload = 'auto'
    el.setAttribute('playsinline', 'true')
    el.setAttribute('webkit-playsinline', 'true')
    ;(el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true
    el.volume = 0.0001
    el.setAttribute('aria-hidden', 'true')
    el.style.display = 'none'
    document.body.appendChild(el)
    silentEl = el
  }
  void silentEl.play().catch(() => undefined)
}

async function resumeCtx(ctx: AudioContext): Promise<boolean> {
  if (contextState(ctx) === 'closed') return false
  if (!contextNeedsResume(ctx)) return true
  try {
    await ctx.resume()
  } catch {
    return false
  }
  return !contextNeedsResume(ctx)
}

async function waitUntilRunning(ctx: AudioContext, ms: number): Promise<boolean> {
  const started = performance.now()
  while (performance.now() - started < ms) {
    if (contextState(ctx) === 'running') return true
    await resumeCtx(ctx)
    await new Promise((resolve) => window.setTimeout(resolve, 40))
  }
  return contextState(ctx) === 'running'
}

async function measureAdvancing(ctx: AudioContext): Promise<boolean> {
  if (contextState(ctx) !== 'running') return false
  const a = ctx.currentTime
  await new Promise((resolve) => window.setTimeout(resolve, 50))
  return ctx.currentTime > a + 0.01
}

async function recreatePlayback(reason: string): Promise<void> {
  if (recovering) return
  recovering = true
  lastRecovery = reason
  recoveries += 1
  const old = playback
  playback = null
  if (old && contextState(old) !== 'closed') {
    try {
      await old.close()
    } catch {
      // already closed
    }
  }
  playback = createContext()
  recovering = false
}

export async function resumePlaybackAndRecover(forceCheck = false): Promise<boolean> {
  if (liveStreams.size === 0) setAudioSessionType('playback')
  const ctx = getPlaybackAudioContext()
  const resumed = await resumeCtx(ctx)
  if (!forceCheck && resumed && contextState(ctx) === 'running') {
    timeAdvancing = true
    return true
  }
  const running = await waitUntilRunning(ctx, 300)
  const advancing = running ? await measureAdvancing(ctx) : false
  timeAdvancing = advancing
  if (running && advancing) return true
  await recreatePlayback(
    `${contextState(ctx)}${advancing ? '' : ':frozen'}@${Math.round(ctx.sampleRate)}`,
  )
  const next = getPlaybackAudioContext()
  const ok = await resumeCtx(next)
  timeAdvancing = ok
  return ok
}

export async function resumeSharedAudioContext(): Promise<boolean> {
  return resumePlaybackAndRecover(false)
}

/** Call from a click/pointer handler before any await so iOS unlocks playback. */
export function unlockAudioFromGesture(): void {
  armSilentUnlock()
  syncAudioSession()
  void resumeSharedAudioContext()
}

/** Play tap: resume, and recreate the playback context if iOS left it interrupted. */
export function unlockPlaybackFromGesture(): void {
  armSilentUnlock()
  if (liveStreams.size === 0) setAudioSessionType('playback')
  void resumePlaybackAndRecover(true)
}

export function countLiveMicTracks(): { total: number; live: number } {
  let total = 0
  let live = 0
  for (const stream of liveStreams) {
    for (const track of stream.getAudioTracks()) {
      total += 1
      if (track.readyState === 'live') live += 1
    }
  }
  return { total, live }
}

export function getAudioDebugSnapshot(): AudioDebugSnapshot {
  exposeAudioDebug()
  const play = playback && contextState(playback) !== 'closed' ? playback : null
  const cap = capture && contextState(capture) !== 'closed' ? capture : null
  const now = performance.now()
  if (play && now - lastPlaybackCheck > 200) {
    const t = play.currentTime
    timeAdvancing = t > lastPlaybackTime + 0.01
    lastPlaybackTime = t
    lastPlaybackCheck = now
  }
  const mics = countLiveMicTracks()
  return {
    playbackState: contextState(play),
    playbackRate: play?.sampleRate ?? null,
    playbackTime: play?.currentTime ?? 0,
    timeAdvancing,
    captureState: contextState(cap),
    captureRate: cap?.sampleRate ?? null,
    sessionType: getAudioSessionType(),
    micTracks: mics.total,
    micLive: mics.live,
    silentUnlock: Boolean(silentEl && !silentEl.paused),
    lastRecovery,
    recoveries,
  }
}

let debugExposed = false

function exposeAudioDebug(): void {
  if (typeof window === 'undefined' || debugExposed) return
  debugExposed = true
  Object.defineProperty(window, '__OMNICIAN_AUDIO__', {
    configurable: true,
    get() {
      return getAudioDebugSnapshot()
    },
  })
}

function wireLifecycle(): void {
  if (lifecycleWired || typeof window === 'undefined') return
  lifecycleWired = true
  exposeAudioDebug()

  const onHidden = () => {
    releaseAllCapture()
  }

  const onVisible = () => {
    setAudioSessionType('playback')
    void resumePlaybackAndRecover(true)
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHidden()
    else onVisible()
  })
  window.addEventListener('pagehide', onHidden)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) onVisible()
    else void resumePlaybackAndRecover(false)
  })
  window.addEventListener('focus', () => {
    void resumePlaybackAndRecover(false)
  })
  window.addEventListener('pointerdown', () => unlockAudioFromGesture(), { capture: true })
  window.addEventListener('touchstart', () => unlockAudioFromGesture(), { capture: true, passive: true })
}
