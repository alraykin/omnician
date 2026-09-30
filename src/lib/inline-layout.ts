import type { InstrumentString } from '@/lib/notes'

/** Tip → nut: highest string at the tip, lowest nearest the nut. */
export function inlinePegsFromTip(
  strings: readonly InstrumentString[],
): InstrumentString[] {
  return [...strings].sort((a, b) => a.stringNo - b.stringNo || b.midi - a.midi)
}

export const INLINE_EDGE_DEG = 16
export const INLINE_EDGE_TAN = Math.tan((INLINE_EDGE_DEG * Math.PI) / 180)
