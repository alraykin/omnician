import { isNativeApp } from '@/lib/native-origin'
import {
  applyNativePosture,
  hydrateNativePosture,
  snapshotFromPlugin,
  type NativePostureSnapshot,
} from '@/lib/native-fold'

type PluginHandle = { remove: () => Promise<void> | void }

type PosturePlugin = {
  getState?: () => Promise<Record<string, unknown>>
  start?: () => Promise<unknown>
  stop?: () => Promise<unknown>
  addListener?: (event: string, cb: (data: Record<string, unknown>) => void) => Promise<PluginHandle> | PluginHandle
}

type CapacitorBridge = {
  isNativePlatform?: () => boolean
  registerPlugin?: (name: string) => PosturePlugin
  Plugins?: { OmnicianPosture?: PosturePlugin }
}

function capacitor(): CapacitorBridge | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as Window & { Capacitor?: CapacitorBridge }).Capacitor
}

function plugin(): PosturePlugin | null {
  const cap = capacitor()
  if (!cap) return null
  if (!isNativeApp() && cap.isNativePlatform?.() !== true) return null
  const existing = cap.Plugins?.OmnicianPosture
  if (existing && (typeof existing.getState === 'function' || typeof existing.start === 'function')) {
    return existing
  }
  try {
    const registered = cap.registerPlugin?.('OmnicianPosture')
    if (registered) return registered
  } catch {
    /* Capacitor 8 JS proxy is optional; native injects Plugins.OmnicianPosture. */
  }
  return existing ?? null
}

function viewportFallback() {
  if (typeof window === 'undefined') {
    return { windowWidth: 0, windowHeight: 0, screenWidth: 0, screenHeight: 0 }
  }
  return {
    windowWidth: window.innerWidth || 0,
    windowHeight: window.innerHeight || 0,
    screenWidth: window.screen?.width || 0,
    screenHeight: window.screen?.height || 0,
  }
}

function ingest(raw: Record<string, unknown> | null | undefined): NativePostureSnapshot {
  return applyNativePosture(hydrateNativePosture(snapshotFromPlugin(raw), viewportFallback()))
}

function pullState(native: PosturePlugin, removed: () => boolean) {
  void native.getState?.().then((state) => {
    if (!removed() && state) ingest(state)
  })
}

/** Starts the native OmnicianPosture plugin. No-ops in Safari. */
export function startNativePosture(): () => void {
  if (!isNativeApp()) return () => {}
  const native = plugin()
  if (!native) return () => {}
  let removed = false
  let handle: PluginHandle | null = null
  const isRemoved = () => removed
  void Promise.resolve(native.start?.()).then((state) => {
    if (removed) return
    if (state && typeof state === 'object') ingest(state as Record<string, unknown>)
    pullState(native, isRemoved)
  })
  const retries = [250, 800, 2000]
  const timers = retries.map((ms) =>
    window.setTimeout(() => {
      if (!removed) pullState(native, isRemoved)
    }, ms),
  )
  const pending = native.addListener?.('postureChange', (data) => {
    if (!removed) ingest(data)
  })
  if (pending && typeof (pending as Promise<PluginHandle>).then === 'function') {
    void (pending as Promise<PluginHandle>).then((value) => {
      handle = value
    })
  } else if (pending) {
    handle = pending as PluginHandle
  }
  return () => {
    removed = true
    timers.forEach((id) => window.clearTimeout(id))
    void handle?.remove?.()
    void native.stop?.()
  }
}

export function nativePosturePluginPresent(): boolean {
  return plugin() != null
}
