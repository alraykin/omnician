import { audioEventLog, noteAudioEvent, resetAudioEventsForTests } from '@/lib/audio-log'
import { isNativeApp } from '@/lib/native-origin'
import {
  applyNativeAudioSession,
  listenNativeSession,
  pullNativeAudioSession,
  resetNativeAudioSessionForTests,
} from '@/native/ios-audio-session'
import { clearNowPlaying, primeNowPlayingMetadata } from '@/lib/now-playing'

type AudioContextCtor = typeof AudioContext

type SafariAudioState = AudioContextState | 'interrupted'

export type AudioSessionKind = 'playback' | 'play-and-record'

export type SilentHtmlState = 'none' | 'starting' | 'playing' | 'blocked'

export type AudioDebugSnapshot = {
  playbackState: string
  playbackRate: number | null
  playbackTime: number
  timeAdvancing: boolean
  captureState: string
  captureRate: number | null
  sessionType: string
  wantedSession: AudioSessionKind
  sessionWrite: string
  silentHtml: SilentHtmlState
  micTracks: number
  micLive: number
  lastRecovery: string
  recoveries: number
  lastError: string
  captureUsed: boolean
  lastStop: string
  lastStopStack: string
  events: string[]
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
let wantedSession: AudioSessionKind = 'playback'
let lastSessionWrite = 'none'
let silentHtml: HTMLAudioElement | null = null
let silentHtmlState: SilentHtmlState = 'none'
let holdPlaybackSuspended = false
let keepAlive: { source: ConstantSourceNode; gain: GainNode } | null = null

type SafariAudioSession = { type: string }

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
  noteAudioEvent(`stop ${reason}`)
  if (typeof console !== 'undefined') {
    console.warn(`[omnician stop] ${reason}`, stack)
  }
  suspendPlaybackAfterStop()
}

function safariAudioSession(): SafariAudioSession | null {
  if (typeof navigator === 'undefined') return null
  const session = (navigator as Navigator & { audioSession?: SafariAudioSession }).audioSession
  if (!session || typeof session !== 'object') return null
  return session
}

export function hasSafariAudioSession(): boolean {
  return safariAudioSession() !== null
}

export function getWantedAudioSession(): AudioSessionKind {
  return wantedSession
}

export function getSilentHtmlState(): SilentHtmlState {
  if (silentHtml && !silentHtml.paused) return 'playing'
  return silentHtmlState
}

/** 0.25s of 8 kHz 16-bit mono PCM silence. Loops without a click. */
export function silentWavDataUrl(): string {
  const sampleRate = 8000
  const samples = sampleRate / 4
  const dataSize = samples * 2
  const bytes = new Uint8Array(44 + dataSize)
  const view = new DataView(bytes.buffer)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i)
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, dataSize, true)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0)
  return `data:audio/wav;base64,${btoa(binary)}`
}

function writeAudioSession(type: AudioSessionKind): boolean {
  const native = applyNativeAudioSession(type)
  const session = safariAudioSession()
  if (!session) {
    lastSessionWrite = native ? `${type}:native` : `${type}:unsupported`
    return native
  }
  if (session.type === type) {
    lastSessionWrite = `${type}:already`
    return true
  }
  // Changing navigator.audioSession.type while Web Audio is running
  // interrupts WKWebView after one or two hits.
  if (playback && contextState(playback) === 'running') {
    lastSessionWrite = `${type}:deferred`
    noteAudioEvent(`session ${type} deferred (ctx running)`)
    return native || true
  }
  try {
    session.type = type
    lastSessionWrite = `${type}:set`
    noteAudioEvent(`session ${type}`)
    return true
  } catch (error) {
    noteAudioError(error, `audioSession.${type}`)
    lastSessionWrite = `${type}:error`
    noteAudioEvent(`session ${type} error`)
    return false
  }
}

function stopSilentHtmlAudio(): void {
  if (!silentHtml) {
    silentHtmlState = 'none'
    return
  }
  try {
    silentHtml.pause()
  } catch {
    /* already detached */
  }
  try {
    silentHtml.remove()
  } catch {
    /* already detached */
  }
  silentHtml = null
  silentHtmlState = 'none'
}

/**
 * Older iOS Safari only: a looping silent <audio playsinline> started in the
 * first tap puts the page in the media-playback category so Web Audio is not
 * ringer-muted. Never run this in the native app — iOS publishes that element
 * as Now Playing titled "localhost".
 */
function startSilentHtmlAudioFromGesture(): void {
  if (typeof document === 'undefined') return
  if (silentHtml && !silentHtml.paused) {
    silentHtmlState = 'playing'
    return
  }
  if (!silentHtml) {
    const el = document.createElement('audio')
    el.setAttribute('playsinline', '')
    el.setAttribute('webkit-playsinline', '')
    ;(el as HTMLAudioElement & { playsInline: boolean }).playsInline = true
    el.loop = true
    el.preload = 'auto'
    el.controls = false
    el.defaultMuted = false
    el.muted = false
    el.volume = 1
    el.setAttribute('aria-hidden', 'true')
    el.style.cssText =
      'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;bottom:0'
    el.src = silentWavDataUrl()
    document.documentElement.appendChild(el)
    silentHtml = el
  }
  silentHtmlState = 'starting'
  try {
    const pending = silentHtml.play()
    void pending
      .then(() => {
        silentHtmlState = silentHtml && !silentHtml.paused ? 'playing' : silentHtmlState
      })
      .catch((error) => {
        silentHtmlState = 'blocked'
        noteAudioError(error, 'silent-html.play')
      })
  } catch (error) {
    silentHtmlState = 'blocked'
    noteAudioError(error, 'silent-html.play')
  }
}

/**
 * /lab/silent step 1: write playback in the user-gesture stack, THEN create or
 * resume the AudioContext. Changing the session after clicks are already
 * running still fades Web Audio after one or two hits — do not do that.
 * Older iOS Safari without navigator.audioSession gets the silent HTML loop.
 * The native app must not: AVAudioSession + HTMLAudioElement became Now Playing.
 */
export function claimPlaybackSessionFromGesture(): void {
  wantedSession = countLiveMicTracks().live > 0 ? 'play-and-record' : 'playback'
  primeNowPlayingMetadata()
  const wrote = writeAudioSession(wantedSession)
  if (isNativeApp()) {
    stopSilentHtmlAudio()
    return
  }
  if (!safariAudioSession() || !wrote) startSilentHtmlAudioFromGesture()
}

export function claimPlayAndRecordSessionFromGesture(): void {
  wantedSession = 'play-and-record'
  writeAudioSession('play-and-record')
  if (isNativeApp()) stopSilentHtmlAudio()
}

export function restorePlaybackSessionAfterMic(): void {
  if (countLiveMicTracks().live > 0) return
  wantedSession = 'playback'
  writeAudioSession('playback')
}

export function resetAudioSessionForTests(): void {
  wantedSession = 'playback'
  lastSessionWrite = 'none'
  silentHtmlState = 'none'
  holdPlaybackSuspended = false
  resetAudioEventsForTests()
  resetNativeAudioSessionForTests()
  releasePlaybackGraph()
  if (silentHtml) {
    try {
      silentHtml.pause()
    } catch {
      // test mock
    }
    try {
      silentHtml.remove()
    } catch {
      // test mock
    }
  }
  silentHtml = null
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
  for (const track of stream.getTracks()) {
    liveTracks.delete(track)
  }
  stopMediaTracks(stream)
  liveStreams.delete(stream)
  restorePlaybackSessionAfterMic()
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
  restorePlaybackSessionAfterMic()
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
  closeCaptureContext()
}

export function releaseAllCapture(): void {
  endLiveMicSessions()
  closeCaptureContext()
}

/** Stop tracks and close capture. Use from Listen finish/cancel/close — not from a Play tap. */
export function disposeCaptureIfIdle(): void {
  stopMicTracks()
  closeCaptureContext()
}

/** Close the capture AudioContext. Does not touch playback. */
export function closeCaptureContext(): void {
  const ctx = capture
  capture = null
  if (!ctx || contextState(ctx) === 'closed') return
  lastRecovery = 'capture-closed'
  try {
    void ctx.close()
  } catch {
    // already closed
  }
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
 * marks that the next Play tap should resume playback after the mic. Writes
 * play-and-record in this gesture so the mic and fork tones share one session.
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
  claimPlayAndRecordSessionFromGesture()
}

export function getCaptureAudioContext(): AudioContext {
  if (capture && contextState(capture) !== 'closed') return capture
  claimPlayAndRecordSessionFromGesture()
  capture = createContext()
  wireLifecycle()
  return capture
}

export function getPlaybackAudioContext(): AudioContext {
  if (playback && contextState(playback) !== 'closed') return playback
  claimPlaybackSessionFromGesture()
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
    noteAudioEvent(`ctx ${state}`)
    if (typeof console !== 'undefined') {
      console.warn(`[omnician] playback ${state}`, stack)
    }
    if (holdPlaybackSuspended && state === 'suspended') return
    // After mic teardown iOS often marks this context interrupted ~0.5s in.
    // Treating that as Stop was killing the Play button. Resume instead.
    if (state !== 'interrupted' && state !== 'suspended') return
    lastRecovery = `${state}-resume`
    recoveries += 1
    noteAudioError(`AudioContext ${state}; resume, transport kept running`, 'statechange')
    noteAudioEvent(`ctx ${state} → resume`)
    resumeFromGesture(ctx)
  })
}

/** Keep the Web Audio graph alive in the background so sparse clicks stay Now Playing. */
export function holdPlaybackGraph(): void {
  const ctx = getPlaybackAudioContext()
  if (keepAlive) return
  try {
    const gain = ctx.createGain()
    gain.gain.value = 0
    const source = ctx.createConstantSource()
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start()
    keepAlive = { source, gain }
  } catch {
    /* ConstantSourceNode missing on old WebKit */
  }
}

export function releasePlaybackGraph(): void {
  if (!keepAlive) return
  try {
    keepAlive.source.stop()
  } catch {
    /* already stopped */
  }
  try {
    keepAlive.source.disconnect()
    keepAlive.gain.disconnect()
  } catch {
    /* already detached */
  }
  keepAlive = null
}

export function suspendPlaybackAfterStop(): void {
  holdPlaybackSuspended = true
  releasePlaybackGraph()
  clearNowPlaying()
  stopSilentHtmlAudio()
  const ctx = playback
  if (ctx && contextState(ctx) === 'running') {
    try {
      void ctx.suspend()
    } catch {
      /* already closed */
    }
  }
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
  claimPlayAndRecordSessionFromGesture()
  const ctx = getCaptureAudioContext()
  void ctx.resume().catch((error) => noteAudioError(error, 'capture.resume'))
  return ctx
}

/**
 * Stop leftover mic hardware, write playback (or keep play-and-record if the
 * mic is still live), then resume() the SAME playback context in this tap.
 * Session is claimed before create/resume — never after clicks are running.
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
  holdPlaybackSuspended = false
  claimPlaybackSessionFromGesture()
  const ctx = getPlaybackAudioContext()
  resumeFromGesture(ctx)
  holdPlaybackGraph()
  return ctx
}

export function unlockAudioFromGesture(): void {
  unlockPlaybackFromGesture()
}

export async function resumeSharedAudioContext(): Promise<boolean> {
  claimPlaybackSessionFromGesture()
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
  const session = safariAudioSession()
  if (!session) return 'unsupported'
  const type = session.type
  return type == null || type === '' ? 'unset' : String(type)
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
    wantedSession,
    sessionWrite: lastSessionWrite,
    silentHtml: getSilentHtmlState(),
    micTracks: mics.total,
    micLive: mics.live,
    lastRecovery,
    recoveries,
    lastError,
    captureUsed: captureUsedSincePlayback,
    lastStop,
    lastStopStack,
    events: audioEventLog(),
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
      onAppBackgrounded: releaseAllCapture,
    },
  })
}

function resumeAfterNativeInterruption(event: string): void {
  noteAudioEvent(`av ${event}`)
  if (event !== 'interrupt-ended' && event !== 'interrupt-resume') return
  if (holdPlaybackSuspended) return
  if (!playback) return
  noteAudioEvent('ctx resume after interrupt')
  resumeFromGesture(playback)
}

function wireLifecycle(): void {
  if (lifecycleWired || typeof window === 'undefined') return
  lifecycleWired = true
  exposeAudioDebug()
  pullNativeAudioSession()
  listenNativeSession(resumeAfterNativeInterruption)

  const onHidden = () => {
    noteAudioEvent(`page ${document.visibilityState}`)
    releaseAllCapture()
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHidden()
    else {
      noteAudioEvent('page visible')
      if (!holdPlaybackSuspended && playback && contextNeedsResume(playback)) {
        resumeFromGesture(playback)
      }
    }
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
