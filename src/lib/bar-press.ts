import { TAP_SLOP_PX } from '@/lib/utils'

/** Hold a bar chip this long to open the menu. Empty drum slots use the same hold to place a soft note. */
export const BAR_LONG_PRESS_MS = 450

/** Phone: hold a filled drum hit this long before a drag moves it. Taps and empty long-press stay free. */
export const MOVE_ARM_MS = 250

export function movedPastSlop(fromX: number, fromY: number, toX: number, toY: number): boolean {
  return Math.hypot(toX - fromX, toY - fromY) > TAP_SLOP_PX
}
