import type { InstrumentString } from '@/lib/notes'

/** Tip → nut on an Ibanez-style in-line headstock: high string at the tip. */
export function inlinePegsFromTip(
  strings: readonly InstrumentString[],
): InstrumentString[] {
  return [...strings].sort((a, b) => a.stringNo - b.stringNo || b.midi - a.midi)
}

/** @deprecated use inlinePegsFromTip — kept name for older tests */
export function inlineStringsForView(
  strings: readonly InstrumentString[],
): InstrumentString[] {
  return inlinePegsFromTip(strings)
}
