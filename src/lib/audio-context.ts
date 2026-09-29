type AudioContextCtor = typeof AudioContext

type SafariAudioState = AudioContextState | 'interrupted'

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
  captureUsed: boolean
}

type AudioSessionType = 'auto' | 'playback' | 'play-and-record' | 'ambient'

let playback: AudioContext | null = null
let capture: AudioContext | null = null
let lifecycleWired = false
let lastPlaybackTime = 0
let lastPlaybackCheck = 0
let timeAdvancing = false
let lastRecovery = 'none'
let recoveries = 0
let lastError = 'none'
let playbackSessionArmed = false
let captureUsedSincePlayback = false

const liveStreams = new Set<MediaStream>()
const hiddenReleasers = new Set<() => void>()
const interruptListeners = new Set<() => void>()
const captureStartListeners = new Set<() => void>()
const playbackRetireListeners = new Set<() => void>()

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

function createContext(): AudioContext {
  const Ctor = getAudioCtor()
  if (!Ctor) throw Object.assign(new Error('NO_AUDIO'), { code: 'unavailable' })
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

export function adoptMicStream(stream: MediaStream): MediaStream {
  liveStreams.add(stream)
  return stream
}

export function releaseMicStream(stream: MediaStream | null | undefined): void {
  if (!stream) return
  stopMediaTracks(stream)
  liveStreams.delete(stream)
  if (liveStreams.size === 0) void disposeCaptureContext()
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
  void disposeCaptureContext()
}

export function onHiddenReleaseCapture(release: () => void): () => void {
  hiddenReleasers.add(release)
  return () => {
    hiddenReleasers.delete(release)
  }
}

export function onPlaybackInterrupted(listener: () => void): () => void {
  interruptListeners.add(listener)
  return () => {
    interruptListeners.delete(listener)
  }
}

export function onCaptureStarting(listener: () => void): () => void {
  captureStartListeners.add(listener)
  return () => {
    captureStartListeners.delete(listener)
  }
}

export function onPlaybackRetiring(listener: () => void): () => void {
  playbackRetireListeners.add(listener)
  return () => {
    playbackRetireListeners.delete(listener)
  }
}

function safariAudioSession(): { type: string } | undefined {
  if (typeof navigator === 'undefined') return undefined
  const session = (navigator as Navigator & { audioSession?: { type?: string } }).audioSession
  if (!session || typeof session !== 'object') return undefined
  return session as { type: string }
}

function setAudioSessionType(type: AudioSessionType): void {
  const session = safariAudioSession()
  if (!session) return
  try {
    session.type = type
  } catch (error) {
    noteAudioError(error, `audioSession.${type}`)
  }
}

/** Silent-switch: iOS 17+ plays Web Audio while the ringer is muted. Once per first playback. */
function armPlaybackSessionOnce(): void {
  if (playbackSessionArmed) return
  playbackSessionArmed = true
  setAudioSessionType('playback')
}

/** Tuner and Listen both set this so the next Play/preview rebuilds playback. */
export function markCaptureUsed(): void {
  captureUsedSincePlayback = true
}

/**
 * Tuner/Listen tap, immediately before getUserMedia. Stops Click/Drums,
 * marks that playback must be rebuilt on the next Play tap, then asks iOS
 * for play-and-record so the mic can open.
 */
export function prepareCaptureFromGesture(): void {
  for (const listener of captureStartListeners) {
    try {
      listener()
    } catch {
      // listener must not throw
    }
  }
  markCaptureUsed()
  setAudioSessionType('play-and-record')
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
  armPlaybackSessionOnce()
  playback = createContext()
  wirePlayback(playback)
  wireLifecycle()
  return playback
}

/** Playback context only. Never attach a microphone stream to this. */
export function getSharedAudioContext(): AudioContext {
  return getPlaybackAudioContext()
}

function wirePlayback(ctx: AudioContext): void {
  ctx.addEventListener('statechange', () => {
    if (ctx !== playback) return
    const state = contextState(ctx)
    if (state !== 'interrupted') return
    // Same flag as Tuner/Listen: resume() on this context stays running with a
    // frozen clock (audioSession auto). Next Play tap rebuilds instead.
    markCaptureUsed()
    lastRecovery = 'interrupted'
    recoveries += 1
    noteAudioError('AudioContext state interrupted', 'statechange')
    for (const listener of interruptListeners) {
      try {
        listener()
      } catch {
        // listener must not throw
      }
    }
  })
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

/** Capture context + resume inside the tap. Does not touch playback. */
export function beginCaptureFromGesture(): AudioContext {
  const ctx = getCaptureAudioContext()
  void ctx.resume().catch((error) => noteAudioError(error, 'capture.resume'))
  return ctx
}

function closeContext(ctx: AudioContext | null): void {
  if (!ctx || contextState(ctx) === 'closed') return
  try {
    void ctx.close()
  } catch (error) {
    noteAudioError(error, 'context.close')
  }
}

/**
 * After Tuner/Listen (or an interrupted context), iOS leaves playback stuck:
 * running, currentTime frozen, audioSession auto. Only on a Play or Listen
 * ½×/1×/2× preview tap: drop the mic, set playback, close the old context,
 * make a new one. Once per mic use / interrupt. Never while the transport runs.
 */
function recoverPlaybackAfterCapture(): AudioContext {
  lastRecovery = 'after-capture'
  recoveries += 1
  for (const listener of playbackRetireListeners) {
    try {
      listener()
    } catch {
      // listener must not throw
    }
  }
  releaseAllCapture()
  setAudioSessionType('playback')
  playbackSessionArmed = true
  const old = playback
  playback = null
  closeContext(old)
  captureUsedSincePlayback = false
  const ctx = getPlaybackAudioContext()
  if (contextNeedsResume(ctx)) {
    void ctx.resume().catch((error) => noteAudioError(error, 'play.resume'))
  }
  return ctx
}

function needsFreshPlayback(): boolean {
  if (captureUsedSincePlayback) return true
  const state = contextState(playback)
  if (state === 'interrupted') return true
  // Screenshot path: interrupt already fired, iOS flipped the context back to
  // "running" with a frozen clock and audioSession auto.
  if (playback && lastRecovery === 'interrupted') return true
  return false
}

/** Play tap: resume the one playback context, or rebuild it once after the mic. */
export function preparePlaybackFromGesture(): AudioContext {
  // iOS resets audioSession to auto after the mic. Re-assert playback on every
  // Play / Listen preview tap, not only the first context create.
  setAudioSessionType('playback')
  if (needsFreshPlayback()) return recoverPlaybackAfterCapture()
  return unlockPlaybackFromGesture()
}

/** Resume (or create) playback. Does not rebuild after mic — Play/Listen preview does that. */
export function unlockPlaybackFromGesture(): AudioContext {
  const ctx = getPlaybackAudioContext()
  if (contextNeedsResume(ctx)) void ctx.resume().catch((error) => noteAudioError(error, 'play.resume'))
  return ctx
}

export function unlockAudioFromGesture(): void {
  unlockPlaybackFromGesture()
}

export async function resumeSharedAudioContext(): Promise<boolean> {
  const ctx = getPlaybackAudioContext()
  return resumeCtx(ctx)
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

export function getAudioSessionType(): string {
  if (typeof navigator === 'undefined') return 'unsupported'
  const session = (navigator as Navigator & { audioSession?: { type?: string } }).audioSession
  return session?.type ?? 'unsupported'
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
    captureUsed: captureUsedSincePlayback,
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
  Object.defineProperty(window, '__OMNICIAN_AUDIO_HOOKS__', {
    configurable: true,
    value: {
      markCaptureUsed,
      preparePlaybackFromGesture,
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

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHidden()
  })
  window.addEventListener('pagehide', onHidden)
}

export function isAudioDebugQuery(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).get('debug') === 'audio'
  } catch {
    return false
  }
}
