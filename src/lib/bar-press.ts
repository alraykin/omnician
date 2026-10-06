import { TAP_SLOP_PX } from '@/lib/utils'

/** Hold a bar chip this long to open the menu. Short enough to feel instant, long enough to beat iOS callout. */
export const BAR_LONG_PRESS_MS = 450

/** Phone: hold a filled drum hit this long before a drag moves it. Taps and swipes stay free. */
export const MOVE_ARM_MS = 250

export function movedPastSlop(fromX: number, fromY: number, toX: number, toY: number): boolean {
  return Math.hypot(toX - fromX, toY - fromY) > TAP_SLOP_PX
}
