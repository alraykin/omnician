import { analyzeFrequency, A4_HZ, rms } from '@/lib/notes'
import {
  connectRawInput,
  createTunerContextSync,
  isPermissionError,
  isUnavailableError,
  logCapture,
  requestRawMic,
} from '@/lib/mic-capture'
import { createSmoothState, pushEstimate, type SmoothState } from '@/lib/pitch-smooth'
import { createPitchScratch, estimateFromFilled } from '@/lib/yin'

const AGC_TARGET = 0.055
const AGC_MIN = 1.05
const AGC_MAX = 8
const UI_PERIOD_MS = 16
const LEAVE_STOP_MS = 80
const ORPHAN_PRIME_MS = 1600

export type TunerStatus =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'denied'
  | 'unavailable'
  | 'error'

export type TunerReading = ReturnType<typeof analyzeFrequency> & {
  clarity: number
}

export type TunerSnapshot = {
  status: TunerStatus
  reading: TunerReading | null
  needsGesture: boolean
}

type EstimateMsg = {
  type: 'estimate'
  hz: number
  clarity: number
  rms: number
  time: number
}

type StartOptions = {
  fromGesture?: boolean
  force?: boolean
}

const listeners = new Set<(snapshot: TunerSnapshot) => void>()

let snapshot: TunerSnapshot = {
  status: 'idle',
  reading: null,
  needsGesture: false,
}

let a4Hz = A4_HZ
let sessionId = 0
let pageCount = 0
let leaveTimer = 0
let orphanTimer = 0
let lastStartHadGesture = false

let audio: AudioContext | null = null
let stream: MediaStream | null = null
let oscillator: OscillatorNode | null = null
let worklet: AudioWorkletNode | null = null
let makeup: GainNode | null = null
let raf = 0
let smooth: SmoothState = createSmoothState()
let lastPublish = 0
let lastTick = 0
let agc = 2.4

function emit(partial: Partial<TunerSnapshot>): void {
  snapshot = { ...snapshot, ...partial }
  for (const listener of listeners) listener(snapshot)
}

function exposeDebug(): void {
  if (typeof window === 'undefined') return
  Object.defineProperty(window, '__OMNICIAN_TUNER__', {
    configurable: true,
    get() {
      return {
        status: snapshot.status,
        needsGesture: snapshot.needsGesture,
        track: stream?.getAudioTracks()[0]?.readyState ?? 'none',
        context: audio?.state ?? 'none',
        pages: pageCount,
      }
    },
  })
}

exposeDebug()

async function loadPitchWorklet(ctx: AudioContext): Promise<boolean> {
  if (!ctx.audioWorklet) return false
  try {
    await ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}tuner/pitch-processor.js`)
    return true
  } catch {
    return false
  }
}

async function micPermissionState(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    const result = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    })
    if (result.state === 'granted' || result.state === 'denied' || result.state === 'prompt') {
      return result.state
    }
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

function applyEstimate(hz: number, clarity: number, signal: number, now: number): void {
  const prev = lastTick || now
  lastTick = now
  const dt = Math.min(0.05, Math.max(0.003, (now - prev) / 1000))
  const next = pushEstimate(smooth, hz, clarity, signal, now, dt)

  if (next.hz === null) {
    if (snapshot.reading !== null && now - lastPublish > 32) {
      lastPublish = now
      emit({ reading: null })
    }
    return
  }

  const due = next.snapped || now - lastPublish >= UI_PERIOD_MS
  if (!due) return
  lastPublish = now
  const note = analyzeFrequency(next.hz, a4Hz)
  emit({ reading: { ...note, clarity } })
}

async function closeContext(ctx: AudioContext | null): Promise<void> {
  if (!ctx || ctx.state === 'closed') return
  try {
    await ctx.close()
  } catch {
    // already closed
  }
}

function teardown(nextStatus: TunerStatus | null): void {
  sessionId += 1
  cancelAnimationFrame(raf)
  raf = 0
  lastPublish = 0
  lastTick = 0
  smooth = createSmoothState()
  makeup = null
  agc = 2.4

  const node = worklet
  worklet = null
  try {
    node?.port.close()
    node?.disconnect()
  } catch {
    // already gone
  }

  const liveStream = stream
  stream = null
  liveStream?.getTracks().forEach((track) => track.stop())

  const osc = oscillator
  oscillator = null
  try {
    osc?.stop()
  } catch {
    // already stopped
  }

  const ctx = audio
  audio = null
  void closeContext(ctx)

  if (nextStatus !== null) {
    emit({ status: nextStatus, reading: null, needsGesture: nextStatus === 'denied' })
  } else {
    emit({ reading: null })
  }
}

async function resumeContext(): Promise<boolean> {
  const ctx = audio
  if (!ctx || ctx.state === 'closed') return false
  if (ctx.state !== 'suspended') {
    if (snapshot.needsGesture) emit({ needsGesture: false })
    return true
  }
  try {
    await ctx.resume()
  } catch {
    emit({ needsGesture: true })
    return false
  }
  if (ctx.state === 'suspended') {
    emit({ needsGesture: true })
    return false
  }
  if (snapshot.needsGesture) emit({ needsGesture: false })
  return true
}

function tracksAreLive(): boolean {
  const track = stream?.getAudioTracks()[0]
  return Boolean(track && track.readyState === 'live')
}

export function getTunerSnapshot(): TunerSnapshot {
  return snapshot
}

export function subscribeTuner(listener: (next: TunerSnapshot) => void): () => void {
  listeners.add(listener)
  listener(snapshot)
  return () => {
    listeners.delete(listener)
  }
}

export function setTunerA4(next: number): void {
  a4Hz = next
}

export function stopTuner(): void {
  if (leaveTimer) {
    window.clearTimeout(leaveTimer)
    leaveTimer = 0
  }
  if (orphanTimer) {
    window.clearTimeout(orphanTimer)
    orphanTimer = 0
  }
  teardown('idle')
}

export async function startTuner(options: StartOptions = {}): Promise<void> {
  const fromGesture = Boolean(options.fromGesture)
  if (fromGesture) lastStartHadGesture = true

  if (!options.force && (snapshot.status === 'starting' || snapshot.status === 'listening')) {
    void resumeContext()
    return
  }

  if (options.force) {
    teardown(null)
  }

  if (!window.isSecureContext) {
    emit({ status: 'unavailable', reading: null, needsGesture: false })
    return
  }

  emit({ status: 'starting', reading: null, needsGesture: false })
  smooth = createSmoothState()

  const session = sessionId + 1
  sessionId = session

  let ctx: AudioContext
  try {
    ctx = audio && audio.state !== 'closed' ? audio : createTunerContextSync()
  } catch {
    if (sessionId === session) emit({ status: 'unavailable', needsGesture: false })
    return
  }

  audio = ctx
  const resumePromise = ctx.state === 'suspended' ? ctx.resume().catch(() => undefined) : Promise.resolve()

  const demoHz = Number(new URLSearchParams(window.location.search).get('demo'))
  const useDemo = Number.isFinite(demoHz) && demoHz > 20 && demoHz < 4000

  let source: AudioNode
  if (useDemo) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0.22
    osc.type = 'sawtooth'
    osc.frequency.value = demoHz
    osc.connect(gain)
    osc.start()
    oscillator = osc
    source = gain
    await resumePromise
  } else {
    let nextStream: MediaStream
    try {
      const streamPromise = requestRawMic()
      const [resolved] = await Promise.all([streamPromise, resumePromise])
      nextStream = resolved
    } catch (error) {
      if (audio === ctx) audio = null
      await closeContext(ctx)
      if (sessionId !== session) return
      if (isPermissionError(error)) {
        const permission = await micPermissionState()
        if (permission === 'denied' || lastStartHadGesture || fromGesture) {
          emit({ status: 'denied', needsGesture: true, reading: null })
          return
        }
        emit({ status: 'idle', needsGesture: true, reading: null })
        return
      }
      if (isUnavailableError(error)) {
        emit({ status: 'unavailable', needsGesture: false, reading: null })
        return
      }
      emit({ status: 'error', needsGesture: true, reading: null })
      return
    }

    if (sessionId !== session) {
      nextStream.getTracks().forEach((track) => track.stop())
      if (audio === ctx) audio = null
      await closeContext(ctx)
      return
    }

    stream = nextStream
    const track = nextStream.getAudioTracks()[0]
    if (track) {
      logCapture({
        settings: track.getSettings(),
        constraints: track.getConstraints(),
        contextSampleRate: ctx.sampleRate,
        baseLatency: ctx.baseLatency,
        outputLatency: 'outputLatency' in ctx ? ctx.outputLatency : null,
      })
    }
    source = ctx.createMediaStreamSource(nextStream)
  }

  if (sessionId !== session) return

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      // iOS can reject a late resume; a later tap retries.
    }
  }

  const workletOk = await loadPitchWorklet(ctx)
  if (sessionId !== session) {
    stream?.getTracks().forEach((item) => item.stop())
    if (stream && !tracksAreLive()) stream = null
    if (audio === ctx) audio = null
    await closeContext(ctx)
    return
  }

  const onEstimate = (hz: number, clarity: number, signal: number) => {
    if (sessionId !== session) return
    if (signal > 0.0012) {
      const desired = Math.min(AGC_MAX, Math.max(AGC_MIN, AGC_TARGET / signal))
      agc = agc * 0.88 + desired * 0.12
    } else {
      agc = agc * 0.96 + AGC_MIN * 0.04
    }
    if (makeup) {
      const nextGain = Math.min(6.2, 1.15 + agc * 0.32)
      makeup.gain.setTargetAtTime(nextGain, ctx.currentTime, 0.03)
    }
    applyEstimate(hz, clarity, signal * agc, performance.now())
  }

  if (workletOk) {
    const node = new AudioWorkletNode(ctx, 'omnician-pitch', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    })
    node.port.onmessage = (event: MessageEvent<EstimateMsg>) => {
      if (event.data?.type !== 'estimate') return
      onEstimate(event.data.hz, event.data.clarity, event.data.rms)
    }
    makeup = connectRawInput(ctx, source, node)
    worklet = node
  } else {
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 4096
    analyser.smoothingTimeConstant = 0
    makeup = connectRawInput(ctx, source, analyser)
    const scratch = createPitchScratch(4096)
    const buffer = new Float32Array(4096)
    let prevHz: number | null = null
    const tick = () => {
      if (sessionId !== session) return
      analyser.getFloatTimeDomainData(buffer)
      const signal = rms(buffer.subarray(buffer.length - 512))
      const estimate = estimateFromFilled(buffer, buffer.length, ctx.sampleRate, scratch, prevHz)
      if (estimate.frequency > 0 && estimate.clarity >= 0.55) prevHz = estimate.frequency
      onEstimate(estimate.frequency, estimate.clarity, signal)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }

  const needsGesture = ctx.state === 'suspended'
  emit({ status: 'listening', needsGesture, reading: null })
}

export async function resumeTuner(): Promise<void> {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

  const resumed = await resumeContext()

  if (snapshot.status === 'listening') {
    const demoHz = Number(new URLSearchParams(window.location.search).get('demo'))
    const useDemo = Number.isFinite(demoHz) && demoHz > 20 && demoHz < 4000
    if (!useDemo && !tracksAreLive()) {
      await startTuner({ force: true, fromGesture: lastStartHadGesture })
      return
    }
    if (!resumed) emit({ needsGesture: true })
    return
  }

  if (pageCount > 0 && (snapshot.status === 'idle' || snapshot.status === 'error')) {
    await startTuner({ fromGesture: lastStartHadGesture })
  }
}

export function primeTuner(): void {
  lastStartHadGesture = true
  if (orphanTimer) window.clearTimeout(orphanTimer)
  orphanTimer = window.setTimeout(() => {
    orphanTimer = 0
    if (pageCount === 0) stopTuner()
  }, ORPHAN_PRIME_MS)
  void startTuner({ fromGesture: true })
}

export function enterTunerPage(): void {
  pageCount += 1
  if (leaveTimer) {
    window.clearTimeout(leaveTimer)
    leaveTimer = 0
  }
  if (orphanTimer) {
    window.clearTimeout(orphanTimer)
    orphanTimer = 0
  }
  void startTuner()
}

export function leaveTunerPage(): void {
  pageCount = Math.max(0, pageCount - 1)
  if (pageCount > 0) return
  if (leaveTimer) window.clearTimeout(leaveTimer)
  leaveTimer = window.setTimeout(() => {
    leaveTimer = 0
    if (pageCount === 0) stopTuner()
  }, LEAVE_STOP_MS)
}
