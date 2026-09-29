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
  lastRecovery: string
  recoveries: number
  lastError: string
}

type AudioSessionApi = { type: string }

let playback: AudioContext | null = null
let capture: AudioContext | null = null
let lifecycleWired = false
let lastPlaybackTime = 0
let lastPlaybackCheck = 0
let timeAdvancing = false
let lastRecovery = 'none'
let recoveries = 0
let lastError = 'none'
let lastSetSession: AudioSessionType | null = null

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

export function formatAudioError(error: unknown): string {
  if (error instanceof Error) {
    const extra = 'code' in error ? ` [${String((error as Error & { code?: unknown }).code)}]` : ''
    return `${error.name}: ${error.message}${extra}`
  }
  return String(error)
}

export function noteAudioError(error: unknown, where: string): string {
  lastError = `${where}: ${formatAudioError(error)}`
  return lastError
}

export function setAudioSessionType(type: AudioSessionType): void {
  const session = getAudioSession()
  if (!session) return
  if (lastSetSession === type) return
  try {
    session.type = type
    lastSetSession = type
  } catch (error) {
    noteAudioError(error, 'audioSession')
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

function discardPlaybackSync(reason: string): void {
  lastRecovery = reason
  recoveries += 1
  const old = playback
  playback = null
  if (old && contextState(old) !== 'closed') {
    try {
      void old.close()
    } catch {
      // already closed
    }
  }
}

function restorePlaybackSessionAfterMic(): void {
  setAudioSessionType('playback')
  void disposeCaptureContext()
  // Recreate playback AFTER the session is playback, never before.
  // The old context is usually interrupted from play-and-record.
  if (playback) discardPlaybackSync('after-mic')
}

export function adoptMicStream(stream: MediaStream): MediaStream {
  liveStreams.add(stream)
  setAudioSessionType('play-and-record')
  return stream
}

export function releaseMicStream(stream: MediaStream | null | undefined): void {
  if (!stream) return
  stopMediaTracks(stream)
  liveStreams.delete(stream)
  if (liveStreams.size === 0) restorePlaybackSessionAfterMic()
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
  restorePlaybackSessionAfterMic()
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

async function resumeCtx(ctx: AudioContext): Promise<boolean> {
  if (contextState(ctx) === 'closed') return false
  if (!contextNeedsResume(ctx)) return true
  try {
    await ctx.resume()
  } catch (error) {
    noteAudioError(error, 'resume')
    return false
  }
  return !contextNeedsResume(ctx)
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function playbackLooksFrozen(ctx: AudioContext): boolean {
  const state = contextState(ctx)
  if (state === 'closed') return true
  if (state === 'interrupted') return true
  if (state === 'running' && !timeAdvancing && ctx.currentTime > 0.05) return true
  return false
}

/** Capture: set play-and-record and open the capture context inside the tap. */
export function beginCaptureFromGesture(): AudioContext {
  wireLifecycle()
  setAudioSessionType('play-and-record')
  const ctx = getCaptureAudioContext()
  void ctx.resume().catch((error) => noteAudioError(error, 'capture.resume'))
  return ctx
}

/**
 * Play tap: create/resume playback in the gesture. Rebuild now if the previous
 * context is interrupted or its clock was frozen. No HTMLAudioElement unlock.
 */
export function unlockPlaybackFromGesture(): AudioContext {
  wireLifecycle()
  if (liveStreams.size === 0) setAudioSessionType('playback')
  const old = playback
  if (old && playbackLooksFrozen(old)) {
    discardPlaybackSync(`${contextState(old)}:frozen@${Math.round(old.sampleRate)}`)
  }
  const ctx = getPlaybackAudioContext()
  void ctx.resume().catch((error) => noteAudioError(error, 'play.resume'))
  return ctx
}

/** First-gesture playback prime. Does not switch session if the mic is live. */
export function unlockAudioFromGesture(): void {
  if (liveStreams.size > 0) return
  unlockPlaybackFromGesture()
}

export async function waitForPlaybackClock(): Promise<boolean> {
  const ctx = getPlaybackAudioContext()
  await resumeCtx(ctx)
  const a = ctx.currentTime
  await nextFrame()
  await nextFrame()
  const advancing = ctx.currentTime > a + 1e-4
  timeAdvancing = advancing
  lastPlaybackTime = ctx.currentTime
  lastPlaybackCheck = performance.now()
  if (!advancing) noteAudioError(`state ${contextState(ctx)} t=${ctx.currentTime.toFixed(3)}`, 'clock')
  return advancing && contextState(ctx) === 'running'
}

export async function resumePlaybackAndRecover(_forceCheck = false): Promise<boolean> {
  if (liveStreams.size === 0) setAudioSessionType('playback')
  const ctx = getPlaybackAudioContext()
  const ok = await resumeCtx(ctx)
  timeAdvancing = ok && contextState(ctx) === 'running'
  return timeAdvancing
}

export async function resumeSharedAudioContext(): Promise<boolean> {
  return resumePlaybackAndRecover(false)
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
    lastRecovery,
    recoveries,
    lastError,
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
    if (liveStreams.size > 0) return
    setAudioSessionType('playback')
    if (playback && contextState(playback) !== 'closed') void resumeCtx(playback)
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHidden()
    else onVisible()
  })
  window.addEventListener('pagehide', onHidden)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) onVisible()
    else if (playback) void resumeCtx(playback)
  })
  window.addEventListener('focus', () => {
    if (playback && liveStreams.size === 0) void resumeCtx(playback)
  })
}

export function isAudioDebugQuery(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).get('debug') === 'audio'
  } catch {
    return false
  }
}
