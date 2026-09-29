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
  lastStop: string
  lastStopStack: string
}

let playback: AudioContext | null = null
let capture: AudioContext | null = null
let lifecycleWired = false
let lastPlaybackTime = 0
let lastPlaybackCheck = 0
let timeAdvancing = false
let lastRecovery = 'none'
let recoveries = 0
let lastError = 'none'
let captureUsedSincePlayback = false
let lastStop = 'none'
let lastStopStack = ''

const liveStreams = new Set<MediaStream>()
const liveTracks = new Set<MediaStreamTrack>()
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

function truncateStack(stack: string | undefined, max = 280): string {
  if (!stack) return ''
  const compact = stack
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(' · ')
  return compact.length > max ? `${compact.slice(0, max)}…` : compact
}

/** Real transport stop only. Interrupted/suspended must resume, not call this. */
export function noteTransportStop(reason: string): void {
  const stack = new Error(`stop: ${reason}`).stack
  lastStop = reason
  lastStopStack = truncateStack(stack)
  lastError = `stop: ${reason}`
  if (typeof console !== 'undefined') {
    console.warn(`[omnician stop] ${reason}`, stack)
  }
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
      track.enabled = false
    } catch {
      // already ended
    }
    try {
      track.stop()
    } catch {
      // already ended
    }
    try {
      stream.removeTrack(track)
    } catch {
      // already detached
    }
  }
}

export function adoptMicStream(stream: MediaStream): MediaStream {
  liveStreams.add(stream)
  for (const track of stream.getTracks()) {
    liveTracks.add(track)
  }
  return stream
}

export function releaseMicStream(stream: MediaStream | null | undefined): void {
  if (!stream) return
  stopMediaTracks(stream)
  liveStreams.delete(stream)
}

/** Stop every adopted getUserMedia stream and track. Does not close capture. */
export function stopMicTracks(): void {
  for (const track of liveTracks) {
    try {
      track.enabled = false
    } catch {
      // already ended
    }
    try {
      track.stop()
    } catch {
      // already ended
    }
  }
  liveTracks.clear()
  for (const stream of liveStreams) {
    stopMediaTracks(stream)
  }
  liveStreams.clear()
}

/** Listen/Tuner graph teardown + track.stop(). Do not close capture during a Play tap. */
export function endLiveMicSessions(): void {
  for (const release of hiddenReleasers) {
    try {
      release()
    } catch {
      // releaser must not throw
    }
  }
  stopMicTracks()
}

export function stopCaptureHardware(): void {
  stopMicTracks()
  void disposeCaptureContext()
}

export function releaseAllCapture(): void {
  endLiveMicSessions()
  void disposeCaptureContext()
}

/** Close capture after Listen/Tuner. Never close it while Play is running. */
export function disposeCaptureIfIdle(): void {
  stopMicTracks()
  if (playback && contextState(playback) === 'running') return
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

/** Tuner and Listen set this so the overlay shows "need recover" until Play resumes. */
export function markCaptureUsed(): void {
  captureUsedSincePlayback = true
}

/**
 * Tuner/Listen tap, immediately before getUserMedia. Stops Click/Drums and
 * marks that the next Play tap should resume playback after the mic. Does not write
 * audioSession — iOS picks play-and-record itself when the mic opens.
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
}

/** After capture, do not write audioSession. Lab A was heard without that write;
 *  setting auto or playback during Play fades iOS Web Audio after the first
 *  precount clicks (session category change). */

async function disposeCaptureContext(): Promise<void> {
  if (playback && contextState(playback) === 'running') return
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
    const stack = truncateStack(new Error(`statechange ${state}`).stack)
    if (typeof console !== 'undefined') {
      console.warn(`[omnician] playback ${state}`, stack)
    }
    // After mic teardown iOS often marks this context interrupted ~0.5s in.
    // Treating that as Stop was killing the Play button. Resume instead.
    if (state !== 'interrupted' && state !== 'suspended') return
    lastRecovery = `${state}-resume`
    recoveries += 1
    noteAudioError(`AudioContext ${state}; resume, transport kept running`, 'statechange')
    resumeFromGesture(ctx)
  })
}

function noteIfStillSuspended(ctx: AudioContext): void {
  if (ctx !== playback) return
  const state = contextState(ctx)
  if (state === 'suspended' || state === 'interrupted') {
    noteAudioError(`AudioContext still ${state} after resume`, 'resume')
  }
}

/** Call resume() in the user-gesture stack. Nothing may await before this. */
function resumeFromGesture(ctx: AudioContext): void {
  if (contextState(ctx) === 'closed') return
  let pending: Promise<void>
  try {
    pending = ctx.resume()
  } catch (error) {
    noteAudioError(error, 'play.resume')
    return
  }
  void pending.then(() => noteIfStillSuspended(ctx)).catch((error) => {
    noteAudioError(error, 'play.resume')
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
  noteIfStillSuspended(ctx)
  return !contextNeedsResume(ctx)
}

/** Capture context + resume inside the tap. Does not touch playback. */
export function beginCaptureFromGesture(): AudioContext {
  const ctx = getCaptureAudioContext()
  void ctx.resume().catch((error) => noteAudioError(error, 'capture.resume'))
  return ctx
}

/**
 * Lab A/C/H: stop leftover mic hardware, resume() the SAME playback context
 * in this tap. Never close playback after the mic, and never write
 * audioSession — that fade is what killed Play after one or two precount clicks.
 */
export function preparePlaybackFromGesture(): AudioContext {
  endLiveMicSessions()
  // Tracks + Listen/Tuner graphs. Closing capture on this tap still interrupts
  // iOS ~0.5s later — Listen finishMic closes it earlier, while Play is idle.
  if (captureUsedSincePlayback) {
    lastRecovery = 'after-mic-resume'
    recoveries += 1
    captureUsedSincePlayback = false
  }
  return unlockPlaybackFromGesture()
}

/** Resume (or create) playback. Does not rebuild after mic. */
export function unlockPlaybackFromGesture(): AudioContext {
  const ctx = getPlaybackAudioContext()
  resumeFromGesture(ctx)
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
  const seen = new Set<MediaStreamTrack>()
  for (const stream of liveStreams) {
    for (const track of stream.getAudioTracks()) {
      seen.add(track)
      total += 1
      if (track.readyState === 'live') live += 1
    }
  }
  for (const track of liveTracks) {
    if (seen.has(track) || track.kind !== 'audio') continue
    total += 1
    if (track.readyState === 'live') live += 1
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
    lastStop,
    lastStopStack,
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
