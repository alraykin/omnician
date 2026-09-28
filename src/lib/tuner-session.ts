import { clampA4 } from '@/lib/custom-presets'
import { analyzeFrequency, A4_HZ, rms } from '@/lib/notes'
import {
  captureChannelCount,
  captureDeviceLabel,
  captureSampleRate,
  connectRawInput,
  createTunerContextSync,
  isPermissionError,
  isUnavailableError,
  loadInputDeviceId,
  logCapture,
  requestRawMic,
  saveInputDeviceId,
} from '@/lib/mic-capture'
import { createPitchScratch, estimateFromFilled, MAX_WINDOW } from '@/lib/mpm'
import { filterBuffer } from '@/lib/pitch-filter'
import { createSmoothState, pushEstimate, type SmoothState } from '@/lib/pitch-smooth'

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

export type TunerDebugInfo = {
  sampleRate: number | null
  captureRate: number | null
  channelCount: number | null
  deviceLabel: string
  rms: number
  rawHz: number
  clarity: number
  note: string
  cents: number | null
  engine: 'worklet' | 'analyser' | 'none'
}

export type TunerSnapshot = {
  status: TunerStatus
  reading: TunerReading | null
  needsGesture: boolean
  debug: TunerDebugInfo
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

const emptyDebug = (): TunerDebugInfo => ({
  sampleRate: null,
  captureRate: null,
  channelCount: null,
  deviceLabel: '—',
  rms: 0,
  rawHz: 0,
  clarity: 0,
  note: '—',
  cents: null,
  engine: 'none',
})

let snapshot: TunerSnapshot = {
  status: 'idle',
  reading: null,
  needsGesture: false,
  debug: emptyDebug(),
}

let a4Hz = A4_HZ
let sessionId = 0
let pageCount = 0
let leaveTimer = 0
let orphanTimer = 0
let lastStartHadGesture = false
let lastError = ''
let lastCaptureRate: number | null = null
let lastChannelCount: number | null = null
let lastDeviceLabel = '—'
let preferredDeviceId: string | null = loadInputDeviceId()
let engine: 'worklet' | 'analyser' | 'none' = 'none'

let audio: AudioContext | null = null
let stream: MediaStream | null = null
let oscillator: OscillatorNode | null = null
let worklet: AudioWorkletNode | null = null
let raf = 0
let smooth: SmoothState = createSmoothState()
let lastPublish = 0
let lastTick = 0

function pitchWorkletUrl(): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${base}worklets/pitch-processor.js`
}

function emit(partial: Partial<TunerSnapshot>): void {
  snapshot = { ...snapshot, ...partial }
  for (const listener of listeners) listener(snapshot)
}

function currentDebug(partial: Partial<TunerDebugInfo> = {}): TunerDebugInfo {
  return {
    ...snapshot.debug,
    sampleRate: audio?.sampleRate ?? snapshot.debug.sampleRate,
    captureRate: lastCaptureRate,
    channelCount: lastChannelCount,
    deviceLabel: lastDeviceLabel,
    engine,
    ...partial,
  }
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
        lastError,
        engine,
        sampleRate: audio?.sampleRate ?? null,
        captureRate: lastCaptureRate,
        channelCount: lastChannelCount,
        deviceLabel: lastDeviceLabel,
        workletUrl: pitchWorkletUrl(),
        debug: snapshot.debug,
      }
    },
  })
}

exposeDebug()

async function loadPitchWorklet(ctx: AudioContext): Promise<boolean> {
  if (!ctx.audioWorklet) {
    lastError = 'NO_AUDIO_WORKLET'
    return false
  }
  const url = pitchWorkletUrl()
  try {
    await ctx.audioWorklet.addModule(url)
    return true
  } catch (error) {
    lastError = `WORKLET: ${error instanceof Error ? error.message : String(error)} @ ${url}`
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
  const rawNote = hz > 0 ? analyzeFrequency(hz, a4Hz) : null
  const debug = currentDebug({
    rms: signal,
    rawHz: hz,
    clarity,
    note: rawNote ? `${rawNote.sharpName}${rawNote.octave}` : '—',
    cents: rawNote ? rawNote.cents : null,
  })

  if (next.hz === null) {
    if (snapshot.reading !== null && now - lastPublish > 32) {
      lastPublish = now
      emit({ reading: null, debug })
      return
    }
    if (now - lastPublish > 80) {
      lastPublish = now
      emit({ debug })
    }
    return
  }

  const due = next.snapped || now - lastPublish >= UI_PERIOD_MS
  if (!due) {
    if (now - lastPublish > 50) {
      lastPublish = now
      emit({ debug })
    }
    return
  }
  lastPublish = now
  const note = analyzeFrequency(next.hz, a4Hz)
  emit({ reading: { ...note, clarity }, debug })
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
  engine = 'none'
  lastDeviceLabel = stream ? lastDeviceLabel : '—'

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
  a4Hz = clampA4(next)
}

export function getTunerInputDeviceId(): string | null {
  return preferredDeviceId
}

export async function setTunerInputDevice(id: string | null): Promise<void> {
  preferredDeviceId = id
  saveInputDeviceId(id)
  if (pageCount > 0) {
    await startTuner({ force: true, fromGesture: lastStartHadGesture })
  }
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
    ctx = audio && audio.state !== 'closed' ? audio : createTunerContextSync(lastCaptureRate)
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
      const streamPromise = requestRawMic(preferredDeviceId)
      const [resolved] = await Promise.all([streamPromise, resumePromise])
      nextStream = resolved
    } catch (error) {
      lastError = `${error instanceof Error ? error.name : 'Error'}: ${error instanceof Error ? error.message : String(error)}`
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
    const trackRate = captureSampleRate(nextStream)
    lastChannelCount = captureChannelCount(nextStream)
    lastDeviceLabel = captureDeviceLabel(nextStream)
    if (trackRate) lastCaptureRate = trackRate
    if (trackRate && Math.abs(trackRate - ctx.sampleRate) > 50) {
      const replacement = createTunerContextSync(trackRate)
      if (audio === ctx) audio = null
      await closeContext(ctx)
      ctx = replacement
      audio = ctx
      try {
        await ctx.resume()
      } catch {
        // tap-anywhere will unlock if this late resume is rejected
      }
    }
    if (track) {
      logCapture({
        settings: track.getSettings(),
        constraints: track.getConstraints(),
        contextSampleRate: ctx.sampleRate,
        baseLatency: ctx.baseLatency,
        outputLatency: 'outputLatency' in ctx ? ctx.outputLatency : null,
      })
    }
    try {
      source = ctx.createMediaStreamSource(nextStream)
    } catch (error) {
      lastError = `SOURCE: ${error instanceof Error ? error.message : String(error)}`
      nextStream.getTracks().forEach((track) => track.stop())
      if (audio === ctx) audio = null
      await closeContext(ctx)
      if (sessionId !== session) return
      emit({ status: 'error', needsGesture: true, reading: null })
      return
    }
  }

  if (sessionId !== session) return

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      // iOS can reject a late resume; a later tap retries.
    }
  }

  let workletOk = false
  try {
    workletOk = await loadPitchWorklet(ctx)
  } catch (error) {
    lastError = `WORKLET: ${error instanceof Error ? error.message : String(error)}`
    workletOk = false
  }
  if (sessionId !== session) {
    stream?.getTracks().forEach((item) => item.stop())
    if (stream && !tracksAreLive()) stream = null
    if (audio === ctx) audio = null
    await closeContext(ctx)
    return
  }

  const onEstimate = (hz: number, clarity: number, signal: number) => {
    if (sessionId !== session) return
    applyEstimate(hz, clarity, signal, performance.now())
  }

  const attachAnalyser = () => {
    const analyser = ctx.createAnalyser()
    const fftSize = Math.min(32768, Math.max(16384, MAX_WINDOW))
    analyser.fftSize = fftSize
    analyser.smoothingTimeConstant = 0
    connectRawInput(ctx, source, analyser)
    const scratch = createPitchScratch()
    const buffer = new Float32Array(fftSize)
    const filtered = new Float32Array(fftSize)
    let prevHz: number | null = null
    const tick = () => {
      if (sessionId !== session) return
      analyser.getFloatTimeDomainData(buffer)
      filterBuffer(buffer, ctx.sampleRate, filtered)
      const signal = rms(filtered.subarray(filtered.length - 512))
      const estimate = estimateFromFilled(filtered, filtered.length, ctx.sampleRate, scratch, prevHz)
      if (estimate.frequency > 0) prevHz = estimate.frequency
      else if (signal < 0.002) prevHz = null
      onEstimate(estimate.frequency, estimate.clarity, signal)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    engine = 'analyser'
  }

  try {
    if (workletOk) {
      try {
        const node = new AudioWorkletNode(ctx, 'omnician-pitch', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers',
        })
        node.port.onmessage = (event: MessageEvent<EstimateMsg & { channelCount?: number }>) => {
          if (event.data?.type !== 'estimate') return
          if (typeof event.data.channelCount === 'number') lastChannelCount = event.data.channelCount
          onEstimate(event.data.hz, event.data.clarity, event.data.rms)
        }
        connectRawInput(ctx, source, node)
        worklet = node
        engine = 'worklet'
      } catch (error) {
        lastError = `WORKLET_NODE: ${error instanceof Error ? error.message : String(error)}`
        attachAnalyser()
      }
    } else {
      attachAnalyser()
    }

    const needsGesture = ctx.state === 'suspended'
    emit({
      status: 'listening',
      needsGesture,
      reading: null,
      debug: currentDebug(),
    })
  } catch (error) {
    lastError = `${error instanceof Error ? error.name : 'Error'}: ${error instanceof Error ? error.message : String(error)}`
    if (sessionId !== session) return
    teardown(null)
    emit({ status: 'error', needsGesture: true, reading: null })
  }
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
  void startTuner({ fromGesture: lastStartHadGesture })
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
