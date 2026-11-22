import { FOLD_MIN_SIDE_PX } from '@/lib/fold-mode'
import { isNativeApp } from '@/lib/native-origin'
import { readNativePosture, type NativePostureSnapshot } from '@/lib/native-fold'
import { isPortraitViewport } from '@/lib/phone-viewport'

/**
 * iPhone Duo CSS points (Apple px / 3).
 * Outer 1398×2034 @460ppi; inner 1878×2670 @430ppi.
 */
export const DUO_OUTER = { width: 466, height: 678 } as const
export const DUO_OUTER_LANDSCAPE = { width: 678, height: 466 } as const
export const DUO_INNER_LAPTOP = { width: 626, height: 890 } as const
export const DUO_INNER_BOOK = { width: 890, height: 626 } as const
export const DUO_OUTER_TOL_PT = 6
export const DUO_MODEL_PREFIX = 'iPhone19'

/** Right-edge system band ≈ 14.5% of outer portrait width (68/466). Rail lives in this band. */
export const DUO_STATUS_STRIP_PX = 68
export const DUO_RAIL_WIDTH_PX = 68

export type CoverRailDetectInput = {
  width: number
  height: number
  screenWidth?: number
  screenHeight?: number
  native?: NativePostureSnapshot | null
  nativeApp?: boolean
  preview?: boolean
}

function readDuoQuery(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get('duo')
  } catch {
    return null
  }
}

/** QA / screenshots: `?duo=outer` draws the cover rail and right status strip. */
export function duoOuterPreview(): boolean {
  const raw = readDuoQuery()
  return raw === 'outer' || raw === 'cover'
}

export function sizeMatchesDuoOuter(width: number, height: number, tol = DUO_OUTER_TOL_PT): boolean {
  if (!(width > 0) || !(height > 0)) return false
  const short = Math.min(width, height)
  const long = Math.max(width, height)
  return Math.abs(short - DUO_OUTER.width) <= tol && Math.abs(long - DUO_OUTER.height) <= tol
}

export function modelLooksLikeDuo(model: string | null | undefined): boolean {
  if (!model) return false
  const normalized = model.trim().replace(/_/g, ',')
  return /^iphone19([,]|$)/i.test(normalized)
}

export function nativeLooksLikeDuo(native: NativePostureSnapshot | null | undefined): boolean {
  if (!native) return false
  if (native.hingeAvailable) return true
  if (native.foldDivisionActive != null) return true
  if (modelLooksLikeDuo(native.model)) return true
  if (sizeMatchesDuoOuter(native.windowWidth, native.windowHeight)) return true
  if (sizeMatchesDuoOuter(native.screenWidth, native.screenHeight)) return true
  return false
}

export function deviceLooksLikeDuo(input: CoverRailDetectInput): boolean {
  if (sizeMatchesDuoOuter(input.width, input.height)) return true
  if (sizeMatchesDuoOuter(input.screenWidth ?? 0, input.screenHeight ?? 0)) return true
  if (nativeLooksLikeDuo(input.native)) return true
  return false
}

function shortestSide(input: CoverRailDetectInput): number {
  const candidates = [
    Math.min(input.width, input.height),
    input.screenWidth && input.screenHeight ? Math.min(input.screenWidth, input.screenHeight) : 0,
    input.native?.windowWidth && input.native.windowHeight
      ? Math.min(input.native.windowWidth, input.native.windowHeight)
      : 0,
    input.native?.screenWidth && input.native.screenHeight
      ? Math.min(input.native.screenWidth, input.native.screenHeight)
      : 0,
  ].filter((n) => n > 0)
  return candidates.length ? Math.min(...candidates) : 0
}

/** Cover / outer display, including when the native plugin never reports `display: 'outer'`. */
export function isDuoOuterViewport(input: CoverRailDetectInput): boolean {
  if (input.preview) return true
  const shortest = shortestSide(input)
  if (!(shortest > 0) || shortest >= FOLD_MIN_SIDE_PX) return false
  if (input.native?.display === 'outer' && deviceLooksLikeDuo(input)) return true
  if (input.nativeApp === false) return false
  return deviceLooksLikeDuo(input)
}

export function detectCoverPortraitRail(input: CoverRailDetectInput): boolean {
  if (!(input.width > 0) || !(input.height > 0)) return false
  if (!isPortraitViewport(input.width, input.height)) return false
  if (Math.min(input.width, input.height) >= FOLD_MIN_SIDE_PX) return false
  return isDuoOuterViewport(input)
}

function readScreenSize(): { width: number; height: number } {
  if (typeof window === 'undefined' || !window.screen) return { width: 0, height: 0 }
  return { width: window.screen.width || 0, height: window.screen.height || 0 }
}

export function isDuoOuterDisplay(): boolean {
  if (typeof window === 'undefined') return duoOuterPreview()
  const screen = readScreenSize()
  return isDuoOuterViewport({
    width: window.innerWidth,
    height: window.innerHeight,
    screenWidth: screen.width,
    screenHeight: screen.height,
    native: readNativePosture(),
    nativeApp: isNativeApp(),
    preview: duoOuterPreview(),
  })
}

/** Outer cover portrait: right-hand tab rail, compact tuner. Inner shortest ~626 never gets this. */
export function isCoverPortraitRail(width: number, height: number): boolean {
  if (typeof window === 'undefined') {
    return detectCoverPortraitRail({ width, height, preview: duoOuterPreview() })
  }
  const screen = readScreenSize()
  return detectCoverPortraitRail({
    width,
    height,
    screenWidth: screen.width,
    screenHeight: screen.height,
    native: readNativePosture(),
    nativeApp: isNativeApp(),
    preview: duoOuterPreview(),
  })
}
