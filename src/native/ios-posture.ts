import { Capacitor, registerPlugin } from '@capacitor/core'

import { isNativeApp } from '@/lib/native-origin'
import {
  applyNativePosture,
  emptyNativePosture,
  gravityFromDeviceMotion,
  hydrateNativePosture,
  readNativePosture,
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

const OmnicianPosture = registerPlugin<PosturePlugin>('OmnicianPosture')

let jsGravity: { x: number; y: number; z: number } | null = null

function viewportFallback() {
  if (typeof window === 'undefined') {
    return { windowWidth: 0, windowHeight: 0 }
  }
  return {
    windowWidth: window.innerWidth || 0,
    windowHeight: window.innerHeight || 0,
  }
}

function mergeGravity(snap: NativePostureSnapshot): NativePostureSnapshot {
  if (snap.gravityX != null && snap.gravityY != null && snap.gravityZ != null) return snap
  if (!jsGravity) return snap
  return {
    ...snap,
    gravityX: jsGravity.x,
    gravityY: jsGravity.y,
    gravityZ: jsGravity.z,
    motionAvailable: true,
    source: snap.source === 'hinge' || snap.source === 'division' ? snap.source : 'motion',
  }
}

function ingest(raw: Record<string, unknown> | null | undefined): NativePostureSnapshot {
  return applyNativePosture(
    hydrateNativePosture(mergeGravity(snapshotFromPlugin(raw)), viewportFallback()),
  )
}

function ingestJsGravity(next: { x: number; y: number; z: number }) {
  if (
    jsGravity &&
    Math.abs(jsGravity.x - next.x) < 0.02 &&
    Math.abs(jsGravity.y - next.y) < 0.02 &&
    Math.abs(jsGravity.z - next.z) < 0.02
  ) {
    return
  }
  jsGravity = next
  const prev = readNativePosture() ?? emptyNativePosture()
  applyNativePosture(
    hydrateNativePosture(
      {
        ...prev,
        gravityX: next.x,
        gravityY: next.y,
        gravityZ: next.z,
        motionAvailable: true,
        source: prev.source === 'hinge' || prev.source === 'division' ? prev.source : 'motion',
      },
      viewportFallback(),
    ),
  )
}

function pullState(native: PosturePlugin, removed: () => boolean) {
  void native.getState?.().then((state) => {
    if (!removed() && state) ingest(state)
  })
}

function seedFromWindow() {
  if (typeof window === 'undefined') return
  const prev = readNativePosture() ?? emptyNativePosture()
  applyNativePosture(hydrateNativePosture(mergeGravity(prev), viewportFallback()))
}

type MotionPermission = {
  requestPermission?: () => Promise<string>
}

function startJsDeviceMotion(): () => void {
  if (typeof window === 'undefined' || !isNativeApp()) return () => {}
  const Motion = window.DeviceMotionEvent as (typeof DeviceMotionEvent & MotionPermission) | undefined
  if (!Motion) return () => {}
  let stopped = false
  const onMotion = (event: DeviceMotionEvent) => {
    if (stopped) return
    const gravity = gravityFromDeviceMotion(event.accelerationIncludingGravity, event.acceleration)
    if (!gravity) return
    ingestJsGravity(gravity)
  }
  const listen = () => {
    window.addEventListener('devicemotion', onMotion)
  }
  listen()
  const armPermission = () => {
    window.removeEventListener('pointerdown', armPermission, true)
    window.removeEventListener('touchstart', armPermission, true)
    if (typeof Motion.requestPermission !== 'function') return
    void Motion.requestPermission()
      .then((state) => {
        if (!stopped && state === 'granted') listen()
      })
      .catch(() => {
        if (!stopped) listen()
      })
  }
  if (typeof Motion.requestPermission === 'function') {
    window.addEventListener('pointerdown', armPermission, true)
    window.addEventListener('touchstart', armPermission, true)
  }
  return () => {
    stopped = true
    window.removeEventListener('devicemotion', onMotion)
    window.removeEventListener('pointerdown', armPermission, true)
    window.removeEventListener('touchstart', armPermission, true)
  }
}

export function nativePosturePluginRegistered(): boolean {
  try {
    return Capacitor.isPluginAvailable('OmnicianPosture')
  } catch {
    return false
  }
}

export function nativePosturePluginPresent(): boolean {
  return nativePosturePluginRegistered()
}

/** Starts the native OmnicianPosture plugin plus a DeviceMotion gravity fallback. */
export function startNativePosture(): () => void {
  const stopMotion = startJsDeviceMotion()
  if (!isNativeApp()) return stopMotion
  seedFromWindow()
  if (!nativePosturePluginRegistered()) {
    return stopMotion
  }
  let removed = false
  let handle: PluginHandle | null = null
  const isRemoved = () => removed
  const native = OmnicianPosture
  void Promise.resolve(native.start?.()).then((state) => {
    if (removed) return
    if (state && typeof state === 'object') ingest(state as Record<string, unknown>)
    pullState(native, isRemoved)
  })
  const retries = [80, 200, 280]
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
    stopMotion()
  }
}
