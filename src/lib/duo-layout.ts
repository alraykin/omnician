import { FOLD_MIN_SIDE_PX } from '@/lib/fold-mode'
import { readNativePosture } from '@/lib/native-fold'
import { isPortraitViewport } from '@/lib/phone-viewport'

/**
 * iPhone Duo CSS points (Apple px / 3).
 * Outer 1398×2034 @460ppi; inner 1878×2670 @430ppi.
 */
export const DUO_OUTER = { width: 466, height: 678 } as const
export const DUO_OUTER_LANDSCAPE = { width: 678, height: 466 } as const
export const DUO_INNER_LAPTOP = { width: 626, height: 890 } as const
export const DUO_INNER_BOOK = { width: 890, height: 626 } as const

/** Right-edge system strip ≈ 14.5% of outer portrait width (68/466). */
export const DUO_STATUS_STRIP_PX = 68
export const DUO_RAIL_WIDTH_PX = 48

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

export function isDuoOuterDisplay(): boolean {
  if (duoOuterPreview()) return true
  const native = readNativePosture()
  return native?.display === 'outer'
}

/** Outer cover portrait: right-hand tab rail, compact tuner. Inner shortest ~626 never gets this. */
export function isCoverPortraitRail(width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) return false
  if (!isPortraitViewport(width, height)) return false
  if (Math.min(width, height) >= FOLD_MIN_SIDE_PX) return false
  return isDuoOuterDisplay()
}
