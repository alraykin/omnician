/**
 * Closed hat (and a later Open) cuts a ringing Open hat.
 * Fade is short enough to feel like a choke, long enough to avoid a click.
 */
export const HAT_CHOKE_SEC = 0.016

/** Earliest choke at or after the open starts. Closed hits before the open are ignored. */
export function nextHatChokeTime(openStart: number, chokeAt: readonly number[]): number | null {
  let best: number | null = null
  for (const time of chokeAt) {
    if (time < openStart - 1e-9) continue
    if (best == null || time < best) best = time
  }
  return best
}
