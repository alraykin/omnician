import type { AudioDebugSnapshot } from '@/lib/audio-context'

export type LabStrategy = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'L' | 'S'

export type LabPhase = 'idle' | 'mic' | 'ready' | 'playing' | 'mark'

export type LabVerdict = 'heard' | 'silent'

export type LabLogRow = {
  at: string
  strategy: LabStrategy
  verdict: LabVerdict
  note: string
}

type SafariState = AudioContextState | 'interrupted'

type Listener = () => void

const listeners = new Set<Listener>()

let playback: AudioContext | null = null
let capture: AudioContext | null = null
let stream: MediaStream | null = null
let sourceNode: MediaStreamAudioSourceNode | null = null
let silent: GainNode | null = null
let htmlAudio: HTMLAudioElement | null = null
let htmlUrl: string | null = null
let clickTimer = 0
let micTimer = 0
let lookaheadTimer = 0
let session = 0
let longClick: AudioBuffer | null = null
let longAccent: AudioBuffer | null = null
let longKick: AudioBuffer | null = null
let longSnare: AudioBuffer | null = null

let phase: LabPhase = 'idle'
let strategy: LabStrategy | null = null
let status = 'Pick a strategy. The mic starts on that tap.'
let lastRecovery = 'none'
let recoveries = 0
let lastError = 'none'
let lastPlaybackTime = 0
let lastPlaybackCheck = 0
let timeAdvancing = false
const log: LabLogRow[] = []

function emit(): void {
  for (const fn of listeners) fn()
}

export function subscribeLab(fn: Listener): () => void {
  listeners.add(fn)
  fn()
  return () => listeners.delete(fn)
}

function audioCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  const view = window as Window & { webkitAudioContext?: typeof AudioContext }
  return window.AudioContext ?? view.webkitAudioContext
}

function ctxState(ctx: AudioContext | null): SafariState | 'none' {
  if (!ctx) return 'none'
  return ctx.state as SafariState
}

function noteError(error: unknown, where: string): void {
  lastError =
    error instanceof Error ? `${where}: ${error.name}: ${error.message}` : `${where}: ${String(error)}`
}

function createCtx(): AudioContext {
  const Ctor = audioCtor()
  if (!Ctor) throw Object.assign(new Error('NO_AUDIO'), { code: 'unavailable' })
  try {
    return new Ctor({ latencyHint: 'interactive' })
  } catch {
    return new Ctor()
  }
}

function safariSession(): { type: string } | undefined {
  if (typeof navigator === 'undefined') return undefined
  const sessionApi = (navigator as Navigator & { audioSession?: { type?: string } }).audioSession
  if (!sessionApi || typeof sessionApi !== 'object') return undefined
  return sessionApi as { type: string }
}

function setSessionType(type: 'auto' | 'playback' | 'play-and-record'): void {
  const sessionApi = safariSession()
  if (!sessionApi) return
  try {
    sessionApi.type = type
  } catch (error) {
    noteError(error, `audioSession.${type}`)
  }
}

function resumeNow(ctx: AudioContext): void {
  if (ctxState(ctx) === 'closed') return
  try {
    void ctx.resume().then(() => {
      if (ctxState(ctx) === 'suspended' || ctxState(ctx) === 'interrupted') {
        noteError(`AudioContext still ${ctxState(ctx)} after resume`, 'resume')
        emit()
      }
    }).catch((error) => {
      noteError(error, 'resume')
      emit()
    })
  } catch (error) {
    noteError(error, 'resume')
  }
}

function closeCtx(ctx: AudioContext | null): void {
  if (!ctx || ctxState(ctx) === 'closed') return
  try {
    void ctx.close()
  } catch (error) {
    noteError(error, 'close')
  }
}

function stopTracks(target: MediaStream | null, hard: boolean): void {
  if (!target) return
  for (const track of target.getTracks()) {
    try {
      if (hard) track.stop()
      else track.enabled = false
    } catch {
      // already ended
    }
  }
}

function disconnectCaptureGraph(): void {
  try {
    sourceNode?.disconnect()
  } catch {
    /* gone */
  }
  sourceNode = null
  try {
    silent?.disconnect()
  } catch {
    /* gone */
  }
  silent = null
}

function countMic(): { total: number; live: number } {
  if (!stream) return { total: 0, live: 0 }
  const tracks = stream.getAudioTracks()
  return {
    total: tracks.length,
    live: tracks.filter((track) => track.readyState === 'live' && track.enabled).length,
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytes = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(bytes)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let o = 44
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    o += 2
  }
  return new Blob([bytes], { type: 'audio/wav' })
}

function clickSamples(sampleRate: number, count: number, bpm: number): Float32Array {
  const gap = 60 / bpm
  const n = Math.ceil(sampleRate * (count * gap + 0.08))
  const out = new Float32Array(n)
  for (let c = 0; c < count; c += 1) {
    const start = Math.floor(c * gap * sampleRate)
    const len = Math.floor(0.028 * sampleRate)
    for (let i = 0; i < len; i += 1) {
      const t = i / sampleRate
      const env = Math.exp(-t * 90)
      out[start + i] = env * (Math.sin(2 * Math.PI * 1180 * t) * 0.72 + (Math.random() * 2 - 1) * 0.12)
    }
  }
  return out
}

function htmlClickUrl(): string {
  if (htmlUrl) return htmlUrl
  htmlUrl = URL.createObjectURL(encodeWav(clickSamples(44100, 8, 120), 44100))
  return htmlUrl
}

function fireBuffer(ctx: AudioContext, buffer: AudioBuffer, time: number, gain: number): void {
  const src = ctx.createBufferSource()
  const amp = ctx.createGain()
  src.buffer = buffer
  amp.gain.value = gain
  src.connect(amp)
  amp.connect(ctx.destination)
  src.start(time)
}

async function decodeUrl(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} ${response.status}`)
  const data = await response.arrayBuffer()
  return ctx.decodeAudioData(data.slice(0))
}

async function preloadLongKit(ctx: AudioContext): Promise<void> {
  try {
    const [click, accent, kick, snare] = await Promise.all([
      decodeUrl(ctx, '/rhythm/clicks/wood-soft-tick.wav'),
      decodeUrl(ctx, '/rhythm/clicks/wood-soft-accent.wav'),
      decodeUrl(ctx, '/rhythm/drums/crocell/kick/t1_rr1.m4a'),
      decodeUrl(ctx, '/rhythm/drums/crocell/snare_snappy_p2/t1_rr1.m4a'),
    ])
    longClick = click
    longAccent = accent
    longKick = kick
    longSnare = snare
  } catch (error) {
    noteError(error, 'A-long.preload')
  }
}

function scheduleLongKit(ctx: AudioContext): void {
  if (lookaheadTimer) window.clearInterval(lookaheadTimer)
  const click = longClick
  const accent = longAccent
  const kick = longKick
  const snare = longSnare
  if (!click || !kick) {
    status = 'Drum samples were not ready — falling back to oscillator clicks.'
    scheduleWebClicks(ctx)
    emit()
    return
  }
  const beat = 0.5
  const horizon = 5
  let next = ctx.currentTime + 0.05
  const end = next + horizon
  let beatIndex = 0
  const ahead = 0.14
  const tick = () => {
    const now = ctx.currentTime
    while (next < now + ahead && next < end) {
      const onOne = beatIndex % 4 === 0
      const onThree = beatIndex % 4 === 2
      fireBuffer(ctx, onOne && accent ? accent : click, next, onOne ? 0.72 : 0.38)
      if (onOne) fireBuffer(ctx, kick, next, 0.95)
      if (onThree && snare) fireBuffer(ctx, snare, next, 0.78)
      next += beat
      beatIndex += 1
    }
    if (now >= end - 0.02) {
      window.clearInterval(lookaheadTimer)
      lookaheadTimer = 0
      phase = 'mark'
      status = 'Did you hear about 5 seconds of wood click plus kick/snare? Mark Heard or Silent.'
      emit()
    }
  }
  tick()
  lookaheadTimer = window.setInterval(tick, 25)
}

function scheduleWebClicks(ctx: AudioContext): void {
  if (clickTimer) window.clearTimeout(clickTimer)
  const start = ctx.currentTime + 0.04
  const gap = 0.5
  for (let i = 0; i < 8; i += 1) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 1180
    const t = start + i * gap
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.7, t + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.04)
  }
  clickTimer = window.setTimeout(() => {
    phase = 'mark'
    status = 'Did you hear 8 clicks? Mark Heard or Silent.'
    emit()
  }, 8 * gap * 1000 + 120)
}

function playHtmlClicks(): void {
  try {
    htmlAudio?.pause()
  } catch {
    /* ignore */
  }
  const el = new Audio(htmlClickUrl())
  el.preload = 'auto'
  htmlAudio = el
  const play = el.play()
  void play.then(() => {
    phase = 'playing'
    status = 'HTML audio is playing 8 clicks. Mark Heard or Silent when it finishes (or if it is silent).'
    emit()
  }).catch((error) => {
    noteError(error, 'html.play')
    phase = 'mark'
    status = 'HTML audio play() failed. Mark Silent unless you heard clicks.'
    emit()
  })
  el.onended = () => {
    phase = 'mark'
    status = 'Did you hear 8 clicks? Mark Heard or Silent.'
    emit()
  }
}

function ensurePlayback(): AudioContext {
  if (playback && ctxState(playback) !== 'closed') return playback
  playback = createCtx()
  return playback
}

function ensureCapture(): AudioContext {
  if (capture && ctxState(capture) !== 'closed') return capture
  capture = createCtx()
  return capture
}

function newPlaybackImmediate(): AudioContext {
  const old = playback
  playback = null
  closeCtx(old)
  recoveries += 1
  lastRecovery = 'new-playback'
  const ctx = ensurePlayback()
  resumeNow(ctx)
  return ctx
}

function wireMic(ctx: AudioContext, next: MediaStream): void {
  stream = next
  const src = ctx.createMediaStreamSource(next)
  sourceNode = src
  const mute = ctx.createGain()
  mute.gain.value = 0
  silent = mute
  src.connect(mute)
  mute.connect(ctx.destination)
}

async function waitInterrupted(ctx: AudioContext): Promise<AudioContext> {
  const begun = performance.now()
  let current = ctx
  let recreated = false
  resumeNow(current)

  const until = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

  while (performance.now() - begun < 1500) {
    if (ctxState(current) === 'running') return current
    if (!recreated && performance.now() - begun >= 800) {
      lastRecovery = 'B-recreate@800ms'
      current = newPlaybackImmediate()
      recreated = true
    } else {
      resumeNow(current)
    }
    await until(250)
  }
  if (ctxState(current) !== 'running') {
    noteError(`still ${ctxState(current)} after 1500ms`, 'B.wait')
  }
  return current
}

async function requestMic(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error('NO_MIC_API'), { code: 'unavailable' })
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    video: false,
  })
}

function finishMicStop(id: number, chosen: LabStrategy): void {
  if (id !== session) return
  disconnectCaptureGraph()

  if (chosen === 'C') {
    stopTracks(stream, true)
    stream = null
    status = 'Tracks stopped. Capture context still open. Tap Play test click (resume same playback).'
  } else if (chosen === 'E') {
    stopTracks(stream, true)
    stream = null
    status = 'Tracks stopped. Shared context kept. Tap Play test click.'
  } else if (chosen === 'G') {
    stopTracks(stream, false)
    status = 'Mic tracks muted (indicator may stay on). Tap Play test click.'
  } else if (chosen === 'D') {
    stopTracks(stream, true)
    stream = null
    closeCtx(capture)
    capture = null
    setSessionType('playback')
    lastRecovery = 'D-session-playback'
    status = 'Mic stopped, audioSession set to playback. Tap Play test click (new context).'
  } else {
    stopTracks(stream, true)
    stream = null
    closeCtx(capture)
    capture = null
    status = 'Mic stopped and capture closed. Tap Play test click.'
  }

  phase = 'ready'
  emit()
}

async function runAfterMic(id: number, chosen: LabStrategy, pending: Promise<MediaStream>): Promise<void> {
  try {
    if (chosen === 'E') {
      const ctx = ensurePlayback()
      resumeNow(ctx)
      capture = ctx
    } else {
      const play = ensurePlayback()
      resumeNow(play)
      const cap = ensureCapture()
      resumeNow(cap)
    }

    const next = await pending
    if (id !== session) {
      for (const track of next.getTracks()) track.stop()
      return
    }

    const micCtx = chosen === 'E' ? ensurePlayback() : ensureCapture()
    wireMic(micCtx, next)
    if (chosen === 'L') void preloadLongKit(ensurePlayback())
    if (chosen === 'H') {
      phase = 'ready'
      status =
        'Mic is still live. Tap Play test click NOW — this checks whether Web Audio can play during capture.'
      emit()
      return
    }
    phase = 'mic'
    status = 'Mic is live for about 3 seconds…'
    emit()

    micTimer = window.setTimeout(() => finishMicStop(id, chosen), 3000)
  } catch (error) {
    if (id !== session) return
    noteError(error, 'mic')
    phase = 'idle'
    status = 'Microphone failed. Allow the mic for this site, then try the strategy again.'
    emit()
  }
}

export function beginStrategyFromTap(chosen: LabStrategy): void {
  hardReset(false)
  session += 1
  const id = session
  strategy = chosen
  lastError = 'none'
  lastRecovery = 'none'
  phase = 'mic'
  status = 'Opening the mic…'

  const pending = requestMic()
  void runAfterMic(id, chosen, pending)
  emit()
}

export function beginSilentSwitchFromTap(): void {
  hardReset(false)
  session += 1
  strategy = 'S'
  lastError = 'none'
  lastRecovery = 'S-session-playback'
  setSessionType('playback')
  const ctx = ensurePlayback()
  resumeNow(ctx)
  phase = 'playing'
  status = 'audioSession set to playback. Playing 8 Web Audio clicks. Mark Heard or Silent.'
  scheduleWebClicks(ctx)
  emit()
}

export function playTestClickFromTap(): void {
  if (phase !== 'ready' && phase !== 'mark') return
  const chosen = strategy
  if (!chosen || chosen === 'S') return
  lastError = 'none'
  phase = 'playing'
  status =
    chosen === 'H'
      ? 'Playing 8 clicks WHILE the mic is still live…'
      : 'Playing 8 clicks…'
  emit()

  if (chosen === 'F') {
    playHtmlClicks()
    return
  }

  if (chosen === 'A' || chosen === 'C' || chosen === 'E' || chosen === 'G' || chosen === 'H' || chosen === 'L') {
    const ctx = chosen === 'E' ? ensurePlayback() : playback && ctxState(playback) !== 'closed' ? playback : ensurePlayback()
    resumeNow(ctx)
    if (chosen === 'L') {
      status = 'Playing ~5s of wood click + kick/snare on a lookahead scheduler…'
      scheduleLongKit(ctx)
      emit()
      return
    }
    scheduleWebClicks(ctx)
    return
  }

  const fresh = newPlaybackImmediate()
  if (chosen === 'B') {
    void waitInterrupted(fresh).then((ctx) => {
      scheduleWebClicks(ctx)
      emit()
    })
    return
  }

  scheduleWebClicks(fresh)
}

export function markVerdict(verdict: LabVerdict): void {
  if (!strategy) return
  const snap = getLabAudioSnapshot()
  log.unshift({
    at: new Date().toLocaleTimeString(),
    strategy,
    verdict,
    note: `playback ${snap.playbackState} t=${snap.playbackTime.toFixed(3)} moving ${snap.timeAdvancing ? 'yes' : 'NO'} · session ${snap.sessionType} · recover ${snap.lastRecovery} · rec ${snap.recoveries} · ${snap.lastError}`,
  })
  phase = 'idle'
  status =
    strategy === 'G' || strategy === 'H'
      ? `${strategy} marked ${verdict === 'heard' ? 'Heard' : 'Silent'}. Tap Reset to turn the mic off, then pick the next letter.`
      : verdict === 'heard'
        ? `${strategy} marked Heard. Reset if you want a clean run, then pick the next letter.`
        : `${strategy} marked Silent. Reset if overlay stays interrupted, then try the next letter.`
  emit()
}

export function hardReset(announce = true): void {
  session += 1
  if (micTimer) window.clearTimeout(micTimer)
  micTimer = 0
  if (clickTimer) window.clearTimeout(clickTimer)
  clickTimer = 0
  if (lookaheadTimer) window.clearInterval(lookaheadTimer)
  lookaheadTimer = 0
  disconnectCaptureGraph()
  stopTracks(stream, true)
  stream = null
  if (capture && capture !== playback) closeCtx(capture)
  capture = null
  closeCtx(playback)
  playback = null
  try {
    htmlAudio?.pause()
  } catch {
    /* ignore */
  }
  htmlAudio = null
  const sessionApi = safariSession()
  if (sessionApi && (sessionApi.type === 'playback' || sessionApi.type === 'play-and-record')) {
    setSessionType('auto')
  }
  phase = 'idle'
  if (announce) {
    strategy = null
    status = 'Lab reset. Pick a strategy.'
  }
  emit()
}

export function clearLabLog(): void {
  log.length = 0
  emit()
}

export function labLogText(): string {
  if (log.length === 0) return 'No results yet.'
  return log
    .map((row) => `${row.at}  ${row.strategy}  ${row.verdict.toUpperCase()}  ${row.note}`)
    .join('\n')
}

export function getLabView(): {
  phase: LabPhase
  strategy: LabStrategy | null
  status: string
  log: LabLogRow[]
  canPlay: boolean
  canMark: boolean
} {
  return {
    phase,
    strategy,
    status,
    log: [...log],
    canPlay: phase === 'ready' || phase === 'mark',
    canMark: phase === 'playing' || phase === 'mark',
  }
}

export function getLabAudioSnapshot(): AudioDebugSnapshot {
  const play = playback && ctxState(playback) !== 'closed' ? playback : null
  const cap = capture && ctxState(capture) !== 'closed' ? capture : null
  const now = performance.now()
  if (play && now - lastPlaybackCheck > 200) {
    const t = play.currentTime
    timeAdvancing = t > lastPlaybackTime + 0.01
    lastPlaybackTime = t
    lastPlaybackCheck = now
  }
  const mics = countMic()
  const sessionApi = safariSession()
  return {
    playbackState: ctxState(play),
    playbackRate: play?.sampleRate ?? null,
    playbackTime: play?.currentTime ?? 0,
    timeAdvancing,
    captureState: ctxState(cap),
    captureRate: cap?.sampleRate ?? null,
    sessionType: sessionApi?.type ?? 'unsupported',
    micTracks: mics.total,
    micLive: mics.live,
    lastRecovery,
    recoveries,
    lastError,
    captureUsed: mics.live > 0 || phase === 'mic' || (strategy === 'G' && !!stream),
  }
}
