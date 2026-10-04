import { TAP_SLOP_PX } from '@/lib/utils'

/** Hold a bar chip this long to open the menu. Short enough to feel instant, long enough to beat iOS callout. */
export const BAR_LONG_PRESS_MS = 450

export function movedPastSlop(fromX: number, fromY: number, toX: number, toY: number): boolean {
  return Math.hypot(toX - fromX, toY - fromY) > TAP_SLOP_PX
}
