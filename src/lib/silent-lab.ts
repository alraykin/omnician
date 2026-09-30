/**
 * Isolated iOS silent-switch lab. Owns its own AudioContext + RhythmKit.
 * Does not write navigator.audioSession from the main Click/Drums/Tuner path,
 * and does not use the shared playback singleton.
 */
import { RhythmKit } from '@/lib/rhythm-audio'

type SessionApi = { type: string }
type LabListener = () => void

export type SilentLabSnapshot = {
  sessionExists: boolean
  sessionType: string
  contextState: string
  currentTime: number
  timeAdvancing: boolean
  sampleRate: number | null
  micLive: number
  looping: boolean
  loopLeftSec: number
  lastStep: string
  log: string[]
}

const listeners = new Set<LabListener>()
const logLines: string[] = []

let ctx: AudioContext | null = null
let kit: RhythmKit | null = null
let micStream: MediaStream | null = null
let lastStep = 'Ready. Silent switch ON, then try 1–4.'
let lastHeardTime = 0
let timeAdvancing = false
let loopUntil = 0
let loopTimer = 0
let probeTimer = 0
let busy = false

function emit(): void {
  for (const listener of listeners) listener()
}

function nowStamp(): string {
  const d = new Date()
  return d.toISOString().slice(11, 23)
}

function note(line: string): void {
  lastStep = line
  logLines.push(`${nowStamp()}  ${line}`)
  if (logLines.length > 80) logLines.splice(0, logLines.length - 80)
  emit()
}

function audioCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  const view = window as Window & { webkitAudioContext?: typeof AudioContext }
  return window.AudioContext ?? view.webkitAudioContext
}

function ctxState(target: AudioContext | null): string {
  if (!target) return 'none'
  return target.state
}

export function readAudioSession(): { exists: boolean; type: string } {
  if (typeof navigator === 'undefined') return { exists: false, type: 'n/a' }
  const session = (navigator as Navigator & { audioSession?: SessionApi }).audioSession
  if (!session || typeof session !== 'object') return { exists: false, type: 'unsupported' }
  const type = session.type
  return { exists: true, type: type == null || type === '' ? 'unset' : String(type) }
}

export function setAudioSessionPlayback(): { ok: boolean; type: string; error?: string } {
  const session = (navigator as Navigator & { audioSession?: SessionApi }).audioSession
  if (!session) return { ok: false, type: 'unsupported', error: 'navigator.audioSession is missing' }
  try {
    session.type = 'playback'
    const after = readAudioSession()
    return { ok: true, type: after.type }
  } catch (error) {
    const after = readAudioSession()
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    return { ok: false, type: after.type, error: message }
  }
}

function countMicLive(): number {
  if (!micStream) return 0
  return micStream.getAudioTracks().filter((track) => track.readyState === 'live').length
}

function stopMic(): void {
  if (!micStream) return
  for (const track of micStream.getTracks()) {
    try {
      track.stop()
    } catch {
      // already ended
    }
  }
  micStream = null
}

function clearLoopTimers(): void {
  if (loopTimer) {
    window.clearTimeout(loopTimer)
    loopTimer = 0
  }
  if (probeTimer) {
    window.clearInterval(probeTimer)
    probeTimer = 0
  }
  loopUntil = 0
}

function resumeOwnContext(target: AudioContext): void {
  try {
    void target.resume()
  } catch {
    // iOS may reject if not in a gesture; caller must invoke from a tap
  }
}

async function ensureEngine(): Promise<{ ctx: AudioContext; kit: RhythmKit }> {
  const Ctor = audioCtor()
  if (!Ctor) throw new Error('NO_AUDIO')
  if (!ctx || ctx.state === 'closed') {
    try {
      ctx = new Ctor({ latencyHint: 'interactive' })
    } catch {
      ctx = new Ctor()
    }
    kit = null
  }
  resumeOwnContext(ctx)
  if (!kit || kit.ctx !== ctx) {
    kit = await RhythmKit.create(ctx)
  }
  resumeOwnContext(ctx)
  return { ctx, kit }
}

function playDrumHits(engine: RhythmKit, audio: AudioContext): void {
  const t = audio.currentTime + 0.04
  engine.hit('kick', t, 'normal')
  engine.hit('closedHat', t + 0.18, 'normal')
  engine.hit('snare', t + 0.36, 'backbeat')
  engine.hit('closedHat', t + 0.54, 'normal')
  engine.hit('kick', t + 0.72, 'normal')
  engine.click(t, 2, 'wood', true)
  engine.click(t + 0.5, 0, 'wood', true)
  engine.click(t + 1.0, 0, 'wood', true)
  engine.click(t + 1.5, 2, 'wood', true)
}

function startProbe(audio: AudioContext, seconds: number, label: string): void {
  clearLoopTimers()
  lastHeardTime = audio.currentTime
  timeAdvancing = false
  loopUntil = performance.now() + seconds * 1000
  let ticks = 0
  let lastState = ctxState(audio)
  let freezeNoted = false
  probeTimer = window.setInterval(() => {
    const t = audio.currentTime
    const advanced = t > lastHeardTime + 0.01
    timeAdvancing = advanced
    if (advanced) {
      lastHeardTime = t
      freezeNoted = false
    }
    ticks += 1
    const state = ctxState(audio)
    const session = readAudioSession()
    const left = Math.max(0, (loopUntil - performance.now()) / 1000)
    if (state !== lastState) {
      note(`${label}: context ${lastState} → ${state} at t=${t.toFixed(3)}s session=${session.type}`)
      lastState = state
    }
    if (!advanced && ticks > 3 && !freezeNoted) {
      freezeNoted = true
      note(`${label}: currentTime froze at ${t.toFixed(3)}s  state=${state}  session=${session.type}`)
    }
    if (left <= 0) {
      clearLoopTimers()
      note(
        `${label}: finished. state=${state} t=${audio.currentTime.toFixed(3)}s session=${session.type} lastAdvance=${timeAdvancing ? 'yes' : 'NO'}`,
      )
    }
    emit()
  }, 250)
}

export function getSilentLabSnapshot(): SilentLabSnapshot {
  const session = readAudioSession()
  const left = loopUntil > 0 ? Math.max(0, (loopUntil - performance.now()) / 1000) : 0
  return {
    sessionExists: session.exists,
    sessionType: session.type,
    contextState: ctxState(ctx),
    currentTime: ctx ? Number(ctx.currentTime.toFixed(3)) : 0,
    timeAdvancing,
    sampleRate: ctx?.sampleRate ?? null,
    micLive: countMicLive(),
    looping: left > 0,
    loopLeftSec: left,
    lastStep,
    log: [...logLines],
  }
}

export function subscribeSilentLab(listener: LabListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function silentLabBusy(): boolean {
  return busy
}

function gate(run: () => Promise<void>): void {
  if (busy) {
    note('Busy — wait for the current step to finish, or tap Stop.')
    return
  }
  busy = true
  emit()
  void run()
    .catch((error) => {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      note(`Error: ${message}`)
    })
    .finally(() => {
      busy = false
      emit()
    })
}

/** (1) Set audioSession.type = playback, then play kick/snare/hats + click. */
export function runPlaybackThenDrumsFromTap(): void {
  gate(async () => {
    const session = setAudioSessionPlayback()
    note(
      session.ok
        ? `1. audioSession.type set to '${session.type}', then drums.`
        : `1. Could not set playback (${session.error ?? 'unknown'}). Playing drums anyway. type=${session.type}`,
    )
    const engine = await ensureEngine()
    playDrumHits(engine.kit, engine.ctx)
    note(
      `1. Scheduled kick/snare/hats + 4 clicks. context=${ctxState(engine.ctx)} t=${engine.ctx.currentTime.toFixed(3)}s session=${readAudioSession().type}`,
    )
  })
}

/** (2) Same drum hits, do not write audioSession. */
export function runDrumsWithoutSessionFromTap(): void {
  gate(async () => {
    const before = readAudioSession()
    const engine = await ensureEngine()
    note(`2. Not writing audioSession (still '${before.type}', exists=${before.exists}). Playing drums.`)
    playDrumHits(engine.kit, engine.ctx)
    note(
      `2. Scheduled kick/snare/hats + 4 clicks. context=${ctxState(engine.ctx)} t=${engine.ctx.currentTime.toFixed(3)}s session=${readAudioSession().type}`,
    )
  })
}

/** (3) Mic like Listen/Tuner, release, set playback, play drums. */
export function runMicThenPlaybackFromTap(): void {
  gate(async () => {
    const enginePromise = ensureEngine()
    note('3. Requesting mic (echoCancellation/noise/AGC off, same idea as Listen).')
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('NO_MIC_API')
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    })
    micStream = stream
    const live = countMicLive()
    note(`3. Mic granted. live tracks=${live}. Holding 1.5s, then release.`)
    emit()
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
    stopMic()
    note('3. Mic tracks stopped (orange dot should go off). Setting audioSession playback.')
    const session = setAudioSessionPlayback()
    note(
      session.ok
        ? `3. audioSession.type is '${session.type}'. Playing drums.`
        : `3. audioSession write failed (${session.error ?? 'unknown'}). Playing drums. type=${session.type}`,
    )
    const engine = await enginePromise
    resumeOwnContext(engine.ctx)
    playDrumHits(engine.kit, engine.ctx)
    note(
      `3. Scheduled kick/snare/hats + 4 clicks. context=${ctxState(engine.ctx)} t=${engine.ctx.currentTime.toFixed(3)}s session=${readAudioSession().type}`,
    )
  })
}

/** (4) 10s wood-click loop at 120 BPM. Watch for freeze / fade / interrupted. */
export function runTenSecondClickLoopFromTap(): void {
  gate(async () => {
    const engine = await ensureEngine()
    engine.kit.stopAll()
    const bpm = 120
    const beat = 60 / bpm
    const beats = 20
    const start = engine.ctx.currentTime + 0.05
    for (let i = 0; i < beats; i += 1) {
      engine.kit.click(start + i * beat, i % 4 === 0 ? 2 : 0, 'wood', true)
    }
    note(
      `4. 10s click loop started (20 wood clicks @ 120 BPM, beat 1 accented). context=${ctxState(engine.ctx)} session=${readAudioSession().type}. Listen for fade-out.`,
    )
    startProbe(engine.ctx, 10.4, '4')
    await new Promise((resolve) => {
      loopTimer = window.setTimeout(resolve, 10400)
    })
  })
}

export function stopSilentLabFromTap(): void {
  clearLoopTimers()
  stopMic()
  try {
    kit?.stopAll()
  } catch {
    // ignore
  }
  if (ctx) resumeOwnContext(ctx)
  busy = false
  note(`Stop. context=${ctxState(ctx)} session=${readAudioSession().type} mic=${countMicLive()}`)
}

export function disposeSilentLab(): void {
  clearLoopTimers()
  stopMic()
  try {
    kit?.stopAll()
  } catch {
    // ignore
  }
  const closing = ctx
  kit = null
  ctx = null
  busy = false
  if (closing && closing.state !== 'closed') {
    try {
      void closing.close()
    } catch {
      // ignore
    }
  }
}

export function silentLabLogText(): string {
  const snap = getSilentLabSnapshot()
  return [
    `audioSession exists=${snap.sessionExists} type=${snap.sessionType}`,
    `context=${snap.contextState} t=${snap.currentTime} advancing=${snap.timeAdvancing} rate=${snap.sampleRate ?? 'n/a'}`,
    `micLive=${snap.micLive} looping=${snap.looping}`,
    '',
    ...snap.log,
  ].join('\n')
}
