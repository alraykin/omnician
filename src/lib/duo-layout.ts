import { FOLD_MIN_SIDE_PX } from '@/lib/fold-mode'
import { readNativePosture } from '@/lib/native-fold'
import { isPortraitViewport } from '@/lib/phone-viewport'

/** Cover / outer CSS pixels used for Duo preview screenshots. */
export const DUO_OUTER = { width: 402, height: 874 } as const
export const DUO_OUTER_LANDSCAPE = { width: 874, height: 402 } as const

export const DUO_STATUS_STRIP_PX = 34
export const DUO_RAIL_WIDTH_PX = 54

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

/** Outer cover portrait: right-hand tab rail, compact tuner. */
export function isCoverPortraitRail(width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) return false
  if (!isPortraitViewport(width, height)) return false
  if (Math.min(width, height) >= FOLD_MIN_SIDE_PX) return false
  return isDuoOuterDisplay()
}
