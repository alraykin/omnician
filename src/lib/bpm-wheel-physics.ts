/**
 * Drag travel and visible number pitch are the same so the strip, committed
 * value, and turn clicks stay locked during slow drags and coasting.
 */
export const PX_PER_BPM = 28
export const ITEM_PX = PX_PER_BPM
export const SNAP_BPM_S = 26
export const FLICK_WINDOW_MS = 80
export const STALE_FLICK_MS = 40
export const TAP_SLOP_PX = 4
export const FLICK_MIN_BPM_S = 8
export const FLICK_MAX_BPM_S = 280
export const COAST_STOP_BPM_S = 2.2
export const FRICTION_FAST = 1.55
export const FRICTION_SLOW = 3.15

export type WheelSample = { t: number; y: number }

export function coastFriction(bpmPerSec: number): number {
  const speed = Math.abs(bpmPerSec)
  const t = Math.min(1, speed / 220)
  return FRICTION_SLOW + (FRICTION_FAST - FRICTION_SLOW) * t * t
}

/**
 * Finger delta → BPM delta.
 * Positive dyPx is finger-down. Higher BPM sits below center, so finger-down
 * must decrease BPM (the strip follows the finger and lower numbers enter).
 */
export function bpmDeltaFromFinger(dyPx: number, dtSec: number): number {
  if (dyPx === 0) return 0
  const dt = Math.max(dtSec, 0.004)
  const pxPerSec = Math.abs(dyPx) / dt
  const t = Math.min(1, Math.max(0, (pxPerSec - 220) / 1600))
  const gain = 1 + 2.2 * t * t
  return (-dyPx / PX_PER_BPM) * gain
}

/** Last ~80ms. Finger up (y falling) → positive BPM/s. */
export function flickVelocityBpm(samples: readonly WheelSample[], now?: number): number {
  if (samples.length < 2) return 0
  const latest = samples[samples.length - 1]
  const endT = now ?? latest.t
  if (endT - latest.t > STALE_FLICK_MS) return 0
  const windowed = samples.filter((sample) => sample.t >= endT - FLICK_WINDOW_MS)
  const used = windowed.length >= 2 ? windowed : samples.slice(-2)
  const first = used[0]
  const last = used[used.length - 1]
  if (!first || !last) return 0
  const dt = (last.t - first.t) / 1000
  if (dt < 0.012) return 0
  const dy = last.y - first.y
  if (Math.abs(dy) < 2) return 0
  const raw = -dy / dt / PX_PER_BPM
  const speed = Math.abs(raw)
  if (speed < FLICK_MIN_BPM_S) return 0
  const boost = 1 + Math.min(0.55, (speed - FLICK_MIN_BPM_S) / 280)
  const signed = raw * boost
  const cap = signed < 0 ? -1 : 1
  return cap * Math.min(FLICK_MAX_BPM_S, Math.abs(signed))
}

/** Pixel shift of the number strip: increasing BPM moves the strip up. */
export function stripOffsetPx(visual: number): number {
  const center = Math.round(visual)
  return (center - visual) * ITEM_PX
}

/** Integer sitting in the selection window. */
export function centeredBpm(visual: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(visual)))
}
