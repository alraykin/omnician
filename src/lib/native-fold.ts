import type { FoldLayout } from '@/lib/fold-mode'

/** Inner Duo shortest side is ~626pt; outer cover is ~466pt. */
export const NATIVE_INNER_MIN_PX = 600

/** User-facing laptop band (~70–130°). Hold band is wider so the layout does not flicker. */
export const LAPTOP_HINGE_ENTER_MIN = 70
export const LAPTOP_HINGE_ENTER_MAX = 130
export const LAPTOP_HINGE_HOLD_MIN = 55
export const LAPTOP_HINGE_HOLD_MAX = 145

export type NativeDisplay = 'inner' | 'outer' | 'unknown'
export type NativeOrientation = 'portrait' | 'landscape'
export type NativeHingeStatus = 'closed' | 'partiallyOpen' | 'fullyOpen' | 'unknown'

export type NativePostureSnapshot = {
  hingeAvailable: boolean
  hingeAttachFailed: boolean
  hingeStatus: NativeHingeStatus | null
  hingeAngleDeg: number | null
  foldDivisionActive: boolean | null
  foldDivisionHorizontal: boolean | null
  display: NativeDisplay
  orientation: NativeOrientation
  windowWidth: number
  windowHeight: number
  screenWidth: number
  screenHeight: number
  gravityX: number | null
  gravityY: number | null
  gravityZ: number | null
  motionAvailable: boolean
  model: string | null
  source: 'hinge' | 'division' | 'motion' | 'size'
}

const listeners = new Set<() => void>()
let snapshot: NativePostureSnapshot | null = null
let lastLayout: FoldLayout = 'off'

export function emptyNativePosture(): NativePostureSnapshot {
  return {
    hingeAvailable: false,
    hingeAttachFailed: false,
    hingeStatus: null,
    hingeAngleDeg: null,
    foldDivisionActive: null,
    foldDivisionHorizontal: null,
    display: 'unknown',
    orientation: 'portrait',
    windowWidth: 0,
    windowHeight: 0,
    screenWidth: 0,
    screenHeight: 0,
    gravityX: null,
    gravityY: null,
    gravityZ: null,
    motionAvailable: false,
    model: null,
    source: 'size',
  }
}

export function parseNativeHingeStatus(value: unknown): NativeHingeStatus | null {
  if (value === 'closed' || value === 'partiallyOpen' || value === 'fullyOpen' || value === 'unknown') {
    return value
  }
  return null
}

export function parseNativeDisplay(value: unknown): NativeDisplay {
  if (value === 'inner' || value === 'outer' || value === 'unknown') return value
  return 'unknown'
}

export function snapshotFromPlugin(raw: Record<string, unknown> | null | undefined): NativePostureSnapshot {
  const base = emptyNativePosture()
  if (!raw) return base
  const width = Number(raw.windowWidth) || 0
  const height = Number(raw.windowHeight) || 0
  const screenWidth = Number(raw.screenWidth) || 0
  const screenHeight = Number(raw.screenHeight) || 0
  const orientation: NativeOrientation =
    raw.orientation === 'landscape' || (width > 0 && height > 0 && width > height) ? 'landscape' : 'portrait'
  const angle = raw.hingeAngleDeg == null ? null : Number(raw.hingeAngleDeg)
  const model = typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : null
  return {
    hingeAvailable: raw.hingeAvailable === true,
    hingeAttachFailed: raw.hingeAttachFailed === true,
    hingeStatus: parseNativeHingeStatus(raw.hingeStatus),
    hingeAngleDeg: Number.isFinite(angle) ? angle : null,
    foldDivisionActive: typeof raw.foldDivisionActive === 'boolean' ? raw.foldDivisionActive : null,
    foldDivisionHorizontal: typeof raw.foldDivisionHorizontal === 'boolean' ? raw.foldDivisionHorizontal : null,
    display: parseNativeDisplay(raw.display),
    orientation,
    windowWidth: width,
    windowHeight: height,
    screenWidth,
    screenHeight,
    gravityX: finiteOrNull(raw.gravityX),
    gravityY: finiteOrNull(raw.gravityY),
    gravityZ: finiteOrNull(raw.gravityZ),
    motionAvailable: raw.motionAvailable === true,
    model,
    source: raw.source === 'hinge' || raw.source === 'division' || raw.source === 'motion' || raw.source === 'size' ? raw.source : 'size',
  }
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function displayFromWindow(width: number, height: number): NativeDisplay {
  if (!(width > 0) || !(height > 0)) return 'unknown'
  return Math.min(width, height) >= NATIVE_INNER_MIN_PX ? 'inner' : 'outer'
}

/** Classify inner/outer from the live window only — never window.screen (stale on Duo inner). */
export function resolveNativeDisplay(snap: NativePostureSnapshot): NativeDisplay {
  const fromWindow = displayFromWindow(snap.windowWidth, snap.windowHeight)
  if (fromWindow !== 'unknown') return fromWindow
  return snap.display === 'inner' || snap.display === 'outer' ? snap.display : 'unknown'
}

/** DeviceMotionEvent gravity in g units. iOS reports m/s²; some browsers already use g. */
export function gravityFromDeviceMotion(
  including: { x: number | null; y: number | null; z: number | null } | null | undefined,
  user?: { x: number | null; y: number | null; z: number | null } | null,
): { x: number; y: number; z: number } | null {
  if (!including || including.x == null || including.y == null || including.z == null) return null
  let x = including.x
  let y = including.y
  let z = including.z
  if (user && user.x != null && user.y != null && user.z != null) {
    x -= user.x
    y -= user.y
    z -= user.z
  }
  const mag = Math.hypot(x, y, z)
  if (mag > 4) {
    x /= 9.80665
    y /= 9.80665
    z /= 9.80665
  }
  if (![x, y, z].every(Number.isFinite)) return null
  return { x, y, z }
}

export function hydrateNativePosture(
  snap: NativePostureSnapshot,
  fallback?: { windowWidth?: number; windowHeight?: number },
): NativePostureSnapshot {
  const windowWidth = snap.windowWidth > 0 ? snap.windowWidth : fallback?.windowWidth || 0
  const windowHeight = snap.windowHeight > 0 ? snap.windowHeight : fallback?.windowHeight || 0
  const screenWidth = snap.screenWidth
  const screenHeight = snap.screenHeight
  const next: NativePostureSnapshot = {
    ...snap,
    windowWidth,
    windowHeight,
    screenWidth,
    screenHeight,
  }
  const resolved = resolveNativeDisplay(next)
  if (resolved !== 'unknown') next.display = resolved
  if (windowWidth > 0 && windowHeight > 0) {
    next.orientation = windowWidth > windowHeight ? 'landscape' : 'portrait'
  }
  return next
}

export function applyNativePosture(next: NativePostureSnapshot): NativePostureSnapshot {
  snapshot = next
  lastLayout = resolveNativeFoldLayout(next, lastLayout)
  listeners.forEach((fn) => fn())
  return next
}

export function readNativePosture(): NativePostureSnapshot | null {
  return snapshot
}

export function readNativeFoldLayout(): FoldLayout {
  return lastLayout
}

export function subscribeNativePosture(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

export function resetNativePostureForTests() {
  snapshot = null
  lastLayout = 'off'
}

/**
 * Map Duo hardware to the existing fold layouts.
 *
 * Inner portrait + laptop hinge/division/motion → laptop.
 * Inner landscape → book (Tuner already uses this).
 * Outer landscape → tent.
 * Outer portrait / inner flat → off.
 */
export function resolveNativeFoldLayout(
  snap: NativePostureSnapshot,
  previous: FoldLayout = 'off',
): FoldLayout {
  const width = snap.windowWidth
  const height = snap.windowHeight
  const display = resolveNativeDisplay(snap)
  const orientation: NativeOrientation =
    width > 0 && height > 0 ? (width > height ? 'landscape' : 'portrait') : snap.orientation

  if (display !== 'inner') {
    return orientation === 'landscape' ? 'tent' : 'off'
  }

  if (orientation === 'landscape') return 'book'

  const hinge = hingeLooksLaptop(snap.hingeAngleDeg, snap.hingeStatus, snap.hingeAvailable, previous)
  if (hinge === true) return 'laptop'
  if (hinge === false) return 'off'

  if (snap.foldDivisionActive === true && snap.foldDivisionHorizontal === true) return 'laptop'
  if (snap.foldDivisionActive === false && previous === 'laptop' && snap.hingeStatus === 'fullyOpen') return 'off'
  if (snap.foldDivisionActive === true && snap.foldDivisionHorizontal === false) return 'off'

  if (motionLooksLaptop(snap, previous)) return 'laptop'
  return 'off'
}

export function hingeLooksLaptop(
  angle: number | null,
  status: NativeHingeStatus | null,
  hingeAvailable: boolean,
  previous: FoldLayout,
): boolean | null {
  if (!hingeAvailable && status == null && angle == null) return null
  if (status === 'closed') return false
  if (status === 'fullyOpen') {
    if (previous === 'laptop' && angle != null) {
      return angle >= LAPTOP_HINGE_HOLD_MIN && angle <= LAPTOP_HINGE_HOLD_MAX
    }
    return false
  }
  if (status === 'partiallyOpen') return true
  if (angle != null && Number.isFinite(angle)) {
    if (previous === 'laptop') return angle >= LAPTOP_HINGE_HOLD_MIN && angle <= LAPTOP_HINGE_HOLD_MAX
    return angle >= LAPTOP_HINGE_ENTER_MIN && angle <= LAPTOP_HINGE_ENTER_MAX
  }
  return null
}

export function motionLooksLaptop(snap: NativePostureSnapshot, previous: FoldLayout): boolean {
  if (!snap.motionAvailable) return false
  const gx = snap.gravityX
  const gy = snap.gravityY
  const gz = snap.gravityZ
  if (gx == null || gy == null || gz == null) return false
  const ax = Math.abs(gx)
  const ay = Math.abs(gy)
  const az = Math.abs(gz)
  // Lower half flat (Z) and lid upright (Y), hinge horizontal (small X).
  if (previous === 'laptop') return ax < 0.5 && ay > 0.18 && az > 0.18
  return ax < 0.38 && ay > 0.28 && az > 0.28
}
