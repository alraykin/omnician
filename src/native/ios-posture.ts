import { isNativeApp } from '@/lib/native-origin'
import {
  applyNativePosture,
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
  Plugins?: { OmnicianPosture?: PosturePlugin }
}

function plugin(): PosturePlugin | null {
  if (typeof window === 'undefined') return null
  const capacitor = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor
  if (!capacitor?.isNativePlatform?.()) return null
  return capacitor.Plugins?.OmnicianPosture ?? null
}

function ingest(raw: Record<string, unknown> | null | undefined): NativePostureSnapshot {
  return applyNativePosture(snapshotFromPlugin(raw))
}

/** Starts the native OmnicianPosture plugin. No-ops in Safari. */
export function startNativePosture(): () => void {
  if (!isNativeApp()) return () => {}
  const native = plugin()
  if (!native) return () => {}
  let removed = false
  let handle: PluginHandle | null = null
  void native.start?.()
  void native.getState?.().then((state) => {
    if (!removed && state) ingest(state)
  })
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
    void handle?.remove?.()
    void native.stop?.()
  }
}
