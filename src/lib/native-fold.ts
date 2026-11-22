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
  hingeStatus: NativeHingeStatus | null
  hingeAngleDeg: number | null
  foldDivisionActive: boolean | null
  foldDivisionHorizontal: boolean | null
  display: NativeDisplay
  orientation: NativeOrientation
  windowWidth: number
  windowHeight: number
  gravityX: number | null
  gravityY: number | null
  gravityZ: number | null
  motionAvailable: boolean
  source: 'hinge' | 'division' | 'motion' | 'size'
}

const listeners = new Set<() => void>()
let snapshot: NativePostureSnapshot | null = null
let lastLayout: FoldLayout = 'off'

export function emptyNativePosture(): NativePostureSnapshot {
  return {
    hingeAvailable: false,
    hingeStatus: null,
    hingeAngleDeg: null,
    foldDivisionActive: null,
    foldDivisionHorizontal: null,
    display: 'unknown',
    orientation: 'portrait',
    windowWidth: 0,
    windowHeight: 0,
    gravityX: null,
    gravityY: null,
    gravityZ: null,
    motionAvailable: false,
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
  const orientation: NativeOrientation =
    raw.orientation === 'landscape' || (width > 0 && height > 0 && width > height) ? 'landscape' : 'portrait'
  const angle = raw.hingeAngleDeg == null ? null : Number(raw.hingeAngleDeg)
  return {
    hingeAvailable: raw.hingeAvailable === true,
    hingeStatus: parseNativeHingeStatus(raw.hingeStatus),
    hingeAngleDeg: Number.isFinite(angle) ? angle : null,
    foldDivisionActive: typeof raw.foldDivisionActive === 'boolean' ? raw.foldDivisionActive : null,
    foldDivisionHorizontal: typeof raw.foldDivisionHorizontal === 'boolean' ? raw.foldDivisionHorizontal : null,
    display: parseNativeDisplay(raw.display),
    orientation,
    windowWidth: width,
    windowHeight: height,
    gravityX: finiteOrNull(raw.gravityX),
    gravityY: finiteOrNull(raw.gravityY),
    gravityZ: finiteOrNull(raw.gravityZ),
    motionAvailable: raw.motionAvailable === true,
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
  const display = snap.display === 'unknown' ? displayFromWindow(width, height) : snap.display
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

  if (!snap.hingeAvailable && motionLooksLaptop(snap, previous)) return 'laptop'
  return previous === 'laptop' && motionLooksLaptop(snap, previous) ? 'laptop' : 'off'
}

function hingeLooksLaptop(
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
  if (angle != null && Number.isFinite(angle)) {
    if (previous === 'laptop') return angle >= LAPTOP_HINGE_HOLD_MIN && angle <= LAPTOP_HINGE_HOLD_MAX
    return angle >= LAPTOP_HINGE_ENTER_MIN && angle <= LAPTOP_HINGE_ENTER_MAX
  }
  if (status === 'partiallyOpen') return true
  return null
}

function motionLooksLaptop(snap: NativePostureSnapshot, previous: FoldLayout): boolean {
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
