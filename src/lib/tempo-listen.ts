import {
  adoptMicStream,
  getCaptureAudioContext,
  getPlaybackAudioContext,
  noteAudioError,
  onHiddenReleaseCapture,
  releaseMicStream,
  resumeSharedAudioContext,
  stopMediaTracks,
} from '@/lib/audio-context'
import { isPermissionError, isUnavailableError, requestRawMic } from '@/lib/mic-capture'
import {
  LISTEN_MAX_MS,
  LISTEN_MIN_MS,
  detectTempo,
  mixToMono,
  sliceForFileAnalysis,
  type TempoEstimate,
} from '@/lib/tempo-detect'

export type ListenPhase = 'idle' | 'listening' | 'analyzing' | 'result' | 'error'

export type ListenSnapshot = {
  phase: ListenPhase
  level: number
  progress: number
  elapsedMs: number
  estimate: TempoEstimate | null
  source: 'mic' | 'file' | null
  message: string
  detail: string
}

const empty: ListenSnapshot = {
  phase: 'idle',
  level: 0,
  progress: 0,
  elapsedMs: 0,
  estimate: null,
  source: null,
  message: '',
  detail: '',
}

type Listener = (snap: ListenSnapshot) => void

function errorMessage(error: unknown, file: boolean): string {
  if (isPermissionError(error)) {
    return 'Microphone is blocked. Allow the mic for this site, then try Listen again.'
  }
  if (isUnavailableError(error)) {
    return 'Omnician could not find a microphone, or this page is not using https.'
  }
  if (file) return 'That file could not be decoded. Try an mp3, m4a, or wav.'
  return 'Something went wrong while listening. Try again.'
}

export function createTempoListener() {
  let snap: ListenSnapshot = { ...empty }
  const listeners = new Set<Listener>()
  let session = 0
  let stream: MediaStream | null = null
  let audio: AudioContext | null = null
  let processor: ScriptProcessorNode | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let silent: GainNode | null = null
  let chunks: Float32Array[] = []
  let collected = 0
  let startedAt = 0
  let raf = 0
  let levelEma = 0

  const emit = (partial: Partial<ListenSnapshot>) => {
    snap = { ...snap, ...partial }
    for (const fn of listeners) fn(snap)
  }

  const teardownGraph = async () => {
    cancelAnimationFrame(raf)
    raf = 0
    try {
      processor?.disconnect()
    } catch {
      /* already gone */
    }
    processor = null
    try {
      sourceNode?.disconnect()
    } catch {
      /* already gone */
    }
    sourceNode = null
    try {
      silent?.disconnect()
    } catch {
      /* already gone */
    }
    silent = null
    const live = stream
    stream = null
    releaseMicStream(live)
    audio = null
  }

  const subscribe = (fn: Listener) => {
    listeners.add(fn)
    fn(snap)
    return () => listeners.delete(fn)
  }

  const cancel = async () => {
    session += 1
    chunks = []
    collected = 0
    await teardownGraph()
    emit({ ...empty })
  }

  const finishMic = async (id: number) => {
    if (id !== session) return
    emit({ phase: 'analyzing', progress: 1 })
    const ctxRate = audio?.sampleRate ?? 48000
    await teardownGraph()
    if (id !== session) return
    const samples = new Float32Array(collected)
    let o = 0
    for (const part of chunks) {
      samples.set(part, o)
      o += part.length
    }
    chunks = []
    collected = 0
    const estimate = detectTempo(samples, ctxRate)
    if (!estimate) {
      emit({
        phase: 'error',
        message: 'Could not find a steady beat. Play a clearer groove, or try a file.',
        estimate: null,
        source: 'mic',
        progress: 1,
      })
      return
    }
    emit({
      phase: 'result',
      estimate,
      source: 'mic',
      progress: 1,
      level: 0,
      message: '',
    })
  }

  const startMic = async (streamPromise?: Promise<MediaStream>) => {
    const id = session + 1
    session = id
    chunks = []
    collected = 0
    levelEma = 0
    startedAt = performance.now()
    emit({
      phase: 'listening',
      level: 0,
      progress: 0,
      elapsedMs: 0,
      estimate: null,
      source: 'mic',
      message: '',
    })
    try {
      const pending = streamPromise ?? requestRawMic()
      const ctx = getCaptureAudioContext()
      audio = ctx
      void ctx.resume().catch((error) => noteAudioError(error, 'listen.resume'))
      const nextStream = await pending
      if (id !== session) {
        stopMediaTracks(nextStream)
        return
      }
      stream = adoptMicStream(nextStream)
      if (id !== session) {
        releaseMicStream(stream)
        stream = null
        audio = null
        return
      }
      const src = ctx.createMediaStreamSource(nextStream)
      sourceNode = src
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      processor = proc
      const mute = ctx.createGain()
      mute.gain.value = 0
      silent = mute
      proc.onaudioprocess = (event) => {
        if (id !== session) return
        const input = event.inputBuffer.getChannelData(0)
        const copy = new Float32Array(input.length)
        copy.set(input)
        chunks.push(copy)
        collected += copy.length
        let peak = 0
        for (let i = 0; i < copy.length; i += 1) {
          const a = Math.abs(copy[i])
          if (a > peak) peak = a
        }
        levelEma = Math.max(peak, levelEma * 0.82)
      }
      src.connect(proc)
      proc.connect(mute)
      mute.connect(ctx.destination)

      let lastPeek = 0
      const tick = () => {
        if (id !== session) return
        const elapsed = performance.now() - startedAt
        const progress = Math.min(1, elapsed / LISTEN_MAX_MS)
        emit({
          phase: 'listening',
          level: Math.min(1, levelEma * 3.2),
          progress,
          elapsedMs: elapsed,
          source: 'mic',
        })
        if (
          elapsed >= LISTEN_MIN_MS &&
          elapsed - lastPeek > 480 &&
          collected > (audio?.sampleRate ?? 48000) * 3.5
        ) {
          lastPeek = elapsed
          const samples = new Float32Array(collected)
          let o = 0
          for (const part of chunks) {
            samples.set(part, o)
            o += part.length
          }
          const peek = detectTempo(samples, audio?.sampleRate ?? 48000)
          if (peek && peek.confidence >= 0.8) {
            void finishMic(id)
            return
          }
        }
        if (elapsed >= LISTEN_MAX_MS) {
          void finishMic(id)
          return
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    } catch (error) {
      if (id !== session) return
      const detail = noteAudioError(error, 'listen')
      await teardownGraph()
      emit({
        phase: 'error',
        message: errorMessage(error, false),
        detail,
        estimate: null,
        source: 'mic',
        progress: 0,
      })
    }
  }

  const analyzeFile = async (file: File) => {
    const id = session + 1
    session = id
    await teardownGraph()
    emit({
      phase: 'analyzing',
      level: 0,
      progress: 0.15,
      elapsedMs: 0,
      estimate: null,
      source: 'file',
      message: '',
    })
    try {
      const data = await file.arrayBuffer()
      if (id !== session) return
      const ctx = getPlaybackAudioContext()
      audio = ctx
      await resumeSharedAudioContext()
      const decoded = await ctx.decodeAudioData(data.slice(0))
      if (id !== session) {
        await teardownGraph()
        return
      }
      const mono = mixToMono(decoded)
      const slice = sliceForFileAnalysis(mono, decoded.sampleRate)
      emit({ progress: 0.7, phase: 'analyzing' })
      const estimate = detectTempo(slice, decoded.sampleRate)
      audio = null
      if (id !== session) return
      if (!estimate) {
        emit({
          phase: 'error',
          message: 'Could not find a steady beat in that file. Try a clearer section.',
          estimate: null,
          source: 'file',
          progress: 1,
        })
        return
      }
      emit({
        phase: 'result',
        estimate,
        source: 'file',
        progress: 1,
        message: '',
      })
    } catch (error) {
      if (id !== session) return
      const detail = noteAudioError(error, 'listen.file')
      await teardownGraph()
      emit({
        phase: 'error',
        message: errorMessage(error, true),
        detail,
        estimate: null,
        source: 'file',
      })
    }
  }

  const showEstimate = (estimate: TempoEstimate, source: 'mic' | 'file') => {
    session += 1
    void teardownGraph()
    emit({
      phase: 'result',
      estimate,
      source,
      progress: 1,
      level: 0,
      elapsedMs: LISTEN_MAX_MS,
      message: '',
    })
  }

  onHiddenReleaseCapture(() => {
    void cancel()
  })

  return {
    subscribe,
    startMic,
    analyzeFile,
    cancel,
    showEstimate,
    get snapshot() {
      return snap
    },
  }
}

export type TempoListener = ReturnType<typeof createTempoListener>

let shared: TempoListener | null = null

export function getTempoListener(): TempoListener {
  if (!shared) shared = createTempoListener()
  return shared
}
