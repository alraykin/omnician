import {
  detectCoverPortraitRail,
  duoOuterPreview,
  isCoverPortraitRail,
} from '@/lib/duo-layout'
import { detectFoldedLayout, resolveFoldLayout, readFoldChoice } from '@/lib/fold-mode'
import { isNativeApp } from '@/lib/native-origin'
import { readNativeFoldLayout, readNativePosture, subscribeNativePosture } from '@/lib/native-fold'
import { nativePosturePluginPresent, nativePosturePluginRegistered } from '@/native/ios-posture'
import { toggleTunerDebug } from '@/lib/tuner-debug'

const listeners = new Set<(on: boolean) => void>()
let enabled = false

function readQuery(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).get('debug') === 'posture'
  } catch {
    return false
  }
}

export function isPostureDebugEnabled(): boolean {
  return enabled || readQuery()
}

export function setPostureDebugEnabled(on: boolean): void {
  enabled = on
  for (const listener of listeners) listener(isPostureDebugEnabled())
}

export function togglePostureDebug(): void {
  setPostureDebugEnabled(!isPostureDebugEnabled())
}

export function subscribePostureDebug(listener: (on: boolean) => void): () => void {
  listeners.add(listener)
  listener(isPostureDebugEnabled())
  return () => {
    listeners.delete(listener)
  }
}

function cssVar(name: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '—'
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return value || '—'
  } catch {
    return '—'
  }
}

function fmt(value: number | null | undefined, digits = 3): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

export type PostureDiagnostics = {
  display: string
  hingeAvailable: string
  hingeAttachFailed: string
  hingeStatus: string
  hingeAngleDeg: string
  foldDivisionActive: string
  foldDivisionHorizontal: string
  gravityX: string
  gravityY: string
  gravityZ: string
  motionAvailable: string
  model: string
  windowSize: string
  screenSize: string
  safeArea: string
  foldLayout: string
  coverPortraitRail: string
  nativeApp: string
  pluginPresent: string
  registered: string
  source: string
  orientation: string
}

export function readPostureDiagnostics(): PostureDiagnostics {
  const native = readNativePosture()
  const width = typeof window === 'undefined' ? 0 : window.innerWidth
  const height = typeof window === 'undefined' ? 0 : window.innerHeight
  const screenWidth = typeof window === 'undefined' ? 0 : window.screen?.width || 0
  const screenHeight = typeof window === 'undefined' ? 0 : window.screen?.height || 0
  const detected = detectFoldedLayout({ width, height })
  const foldLayout = resolveFoldLayout(readFoldChoice(), width, height, detected)
  const nativeLayout = native ? readNativeFoldLayout() : null
  const cover = detectCoverPortraitRail({
    width,
    height,
    native,
    nativeApp: isNativeApp(),
    preview: duoOuterPreview(),
  })
  const bool = (value: boolean | null | undefined) => {
    if (value == null) return '—'
    return value ? 'true' : 'false'
  }
  return {
    display: native?.display ?? 'null',
    hingeAvailable: bool(native?.hingeAvailable),
    hingeAttachFailed: bool(native?.hingeAttachFailed),
    hingeStatus: native?.hingeStatus ?? '—',
    hingeAngleDeg: fmt(native?.hingeAngleDeg, 1),
    foldDivisionActive: bool(native?.foldDivisionActive),
    foldDivisionHorizontal: bool(native?.foldDivisionHorizontal),
    gravityX: fmt(native?.gravityX),
    gravityY: fmt(native?.gravityY),
    gravityZ: fmt(native?.gravityZ),
    motionAvailable: bool(native?.motionAvailable),
    model: native?.model ?? '—',
    windowSize: `${Math.round(native?.windowWidth || width)}×${Math.round(native?.windowHeight || height)} (css ${Math.round(width)}×${Math.round(height)})`,
    screenSize: `${Math.round(native?.screenWidth || screenWidth)}×${Math.round(native?.screenHeight || screenHeight)}`,
    safeArea: `t ${cssVar('--safe-top')} / r ${cssVar('--safe-right')} / b ${cssVar('--safe-bottom')} / l ${cssVar('--safe-left')}`,
    foldLayout: nativeLayout && nativeLayout !== foldLayout ? `${foldLayout} (native ${nativeLayout})` : foldLayout,
    coverPortraitRail: `${cover} (hook ${isCoverPortraitRail(width, height)})`,
    nativeApp: bool(isNativeApp()),
    pluginPresent: bool(typeof window === 'undefined' ? false : nativePosturePluginPresent()),
    registered: bool(typeof window === 'undefined' ? false : nativePosturePluginRegistered()),
    source: native?.source ?? '—',
    orientation: native?.orientation ?? (width > height ? 'landscape' : 'portrait'),
  }
}

export function subscribePostureDiagnostics(onChange: () => void): () => void {
  return subscribeNativePosture(onChange)
}

const LOGO_SELECTOR = '[data-brand-logo], [data-inline-wordmark], [data-split-wordmark], [data-home-logo]'

/** 5 quick taps on the Omnician logo opens posture diagnostics. 3 taps still toggles tuner debug. */
export function armLogoDebugGestures(): () => void {
  if (typeof window === 'undefined') return () => undefined
  let taps = 0
  let timer = 0
  const onTap = (event: Event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (!target.closest(LOGO_SELECTOR)) return
    taps += 1
    window.clearTimeout(timer)
    if (taps >= 5) {
      taps = 0
      event.preventDefault()
      event.stopPropagation()
      togglePostureDebug()
      return
    }
    timer = window.setTimeout(() => {
      if (taps >= 3) toggleTunerDebug()
      taps = 0
    }, 520)
  }
  window.addEventListener('pointerdown', onTap)
  return () => {
    window.removeEventListener('pointerdown', onTap)
    window.clearTimeout(timer)
  }
}
