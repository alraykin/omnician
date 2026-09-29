type AudioContextCtor = typeof AudioContext

type SafariAudioState = AudioContextState | 'interrupted'

let shared: AudioContext | null = null
let lifecycleWired = false

export function getAudioCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const view = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? view.webkitAudioContext
}

function createContext(): AudioContext {
  const Ctor = getAudioCtor()
  if (!Ctor) throw Object.assign(new Error('NO_AUDIO'), { code: 'unavailable' })
  try {
    return new Ctor({ latencyHint: 'interactive', sampleRate: 48000 })
  } catch {
    try {
      return new Ctor({ latencyHint: 'interactive' })
    } catch {
      return new Ctor()
    }
  }
}

function contextState(ctx: AudioContext): SafariAudioState {
  return ctx.state as SafariAudioState
}

export function contextNeedsResume(ctx: AudioContext): boolean {
  const state = contextState(ctx)
  return state === 'suspended' || state === 'interrupted'
}

function wireLifecycle(ctx: AudioContext): void {
  if (lifecycleWired || typeof window === 'undefined') return
  lifecycleWired = true

  const tryResume = () => {
    void resumeSharedAudioContext()
  }

  ctx.addEventListener('statechange', () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    if (contextNeedsResume(ctx)) tryResume()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryResume()
  })
  window.addEventListener('pageshow', tryResume)
  window.addEventListener('focus', tryResume)
  window.addEventListener('pointerdown', tryResume, { capture: true })
  window.addEventListener('touchstart', tryResume, { capture: true, passive: true })
}

/** One AudioContext for the whole app. Never close it — iOS caps how many you can create. */
export function getSharedAudioContext(): AudioContext {
  if (shared && contextState(shared) !== 'closed') return shared
  shared = createContext()
  wireLifecycle(shared)
  return shared
}

export async function resumeSharedAudioContext(): Promise<boolean> {
  const Ctor = getAudioCtor()
  if (!Ctor) return false
  const ctx = getSharedAudioContext()
  if (contextState(ctx) === 'closed') {
    shared = null
    return false
  }
  if (!contextNeedsResume(ctx)) return true
  try {
    await ctx.resume()
  } catch {
    return false
  }
  return !contextNeedsResume(ctx)
}

/** Call from a click/pointer handler before any await so iOS unlocks playback. */
export function unlockAudioFromGesture(): void {
  void resumeSharedAudioContext()
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
