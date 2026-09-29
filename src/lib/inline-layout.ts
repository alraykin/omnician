import type { InstrumentString } from '@/lib/notes'

export function inlineStringsForView(
  strings: readonly InstrumentString[],
): InstrumentString[] {
  return [...strings].sort((a, b) => a.midi - b.midi || b.stringNo - a.stringNo)
}
