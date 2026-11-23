/** Overlay geometry for Duo laptop halves, outer cover, and status-cluster safe area. */

import { DUO_OUTER, DUO_OUTER_LANDSCAPE } from '@/lib/duo-layout'
import { FOLD_BOOK, FOLD_DEAD_PX, FOLD_LAPTOP, type FoldLayout, type ViewportSegmentBox } from '@/lib/fold-mode'

/** Inner landscape status column (clock / camera / battery). */
export const OVERLAY_CLUSTER_RIGHT_PX = 88
/** Outer cover right status / camera band. */
export const OVERLAY_OUTER_CLUSTER_RIGHT_PX = 68

export type OverlayListColumns = 1 | 2

export function laptopTopHalfRect(width: number, height: number): ViewportSegmentBox {
  const crease = height / 2
  return {
    x: 0,
    y: 0,
    width: Math.max(0, width),
    height: Math.max(0, crease - FOLD_DEAD_PX),
  }
}

/** Below the hinge: crease + 16px dead zone through the bottom of the viewport. */
export function laptopBottomHalfRect(width: number, height: number): ViewportSegmentBox {
  const y = height / 2 + FOLD_DEAD_PX
  return {
    x: 0,
    y,
    width: Math.max(0, width),
    height: Math.max(0, height - y),
  }
}

/** Laptop overlays live in the bottom half only. Book/tent/off use the full viewport. */
export function overlayHostRect(
  layout: FoldLayout | string,
  width: number,
  height: number,
): ViewportSegmentBox {
  if (layout === 'laptop') return laptopBottomHalfRect(width, height)
  return { x: 0, y: 0, width: Math.max(0, width), height: Math.max(0, height) }
}

export function overlayStaysInLaptopBottom(top: number, bottom: number, viewportHeight: number): boolean {
  const host = laptopBottomHalfRect(0, viewportHeight)
  return top >= host.y - 1e-6 && bottom <= host.y + host.height + 1e-6
}

/**
 * 1-column groove list on the outer cover and any sheet narrower than a tablet.
 * Never 3 columns — style cards in a tight grid truncate names to "Bac…".
 */
export function overlayListColumns(input: { width: number; outer?: boolean }): OverlayListColumns {
  if (input.outer) return 1
  if (!(input.width > 0) || input.width < 768) return 1
  return 2
}

export function overlayCloseOnLeft(): true {
  return true
}

export function clampMenuToOverlayHost(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
  host: ViewportSegmentBox,
  margin = 8,
): { left: number; top: number } {
  const minLeft = host.x + margin
  const minTop = host.y + margin
  const maxLeft = host.x + host.width - menuWidth - margin
  const maxTop = host.y + host.height - Math.min(menuHeight, Math.max(margin, host.height - margin)) - margin
  return {
    left: Math.min(Math.max(minLeft, x), Math.max(minLeft, maxLeft)),
    top: Math.min(Math.max(minTop, y), Math.max(minTop, maxTop)),
  }
}

export const OVERLAY_SIZES = {
  outerPortrait: DUO_OUTER,
  outerLandscape: DUO_OUTER_LANDSCAPE,
  innerLaptop: FOLD_LAPTOP,
  innerBook: FOLD_BOOK,
} as const
