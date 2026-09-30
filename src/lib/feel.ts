/** Tight visual lock. Displayed cents are never pulled toward 0. */
export const IN_TUNE_CENTS = 1
export const IN_TUNE_EXIT_CENTS = 1.8
export const STRING_HYSTERESIS_CENTS = 32
/** Hold inside ±1¢ this long before the peg sticks green for the session. */
export { STICKY_HOLD_MS } from './sticky-tune'

export const TUNER_FEEL = {
  inTuneCents: IN_TUNE_CENTS,
  smoothPrev: 0.91,
  smoothNext: 0.09,
  minClarity: 0.8,
  minRms: 0.0035,
  holdMs: 400,
  jumpSemitones: 0.24,
  medianSize: 9,
  lockFrames: 4,
}

/** Identity — kept so older call sites compile. Never snap or settle toward 0. */
export function settleCents(cents: number, _inTune?: boolean): number {
  return cents
}

export function formatTenths(cents: number): string {
  const tenths = Math.round(cents * 10) / 10
  if (Object.is(tenths, -0) || tenths === 0) return '0.0'
  const abs = Math.abs(tenths).toFixed(1)
  return tenths > 0 ? `+${abs}` : `−${abs}`
}
