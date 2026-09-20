export const IN_TUNE_CENTS = 5
export const IN_TUNE_EXIT_CENTS = 8
export const STRING_HYSTERESIS_CENTS = 36
/** Peg stays green until this string is clearly off, not on small wobbles. */
export const GREEN_CLEAR_CENTS = 32

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

/** Pull a live cents reading toward 0 so a sustained in-tune note sits still. */
export function settleCents(cents: number, inTune: boolean): number {
  if (!inTune) return cents
  const abs = Math.abs(cents)
  if (abs <= 2.4) return 0
  if (abs <= IN_TUNE_EXIT_CENTS) return cents * 0.22
  return cents
}
