export type PegTone = 'idle' | 'selected' | 'red' | 'green' | 'sticky'

export const PEG_WHITE = '#F4F7FB'
export const PEG_LAVENDER = '#EDE8F8'
export const PEG_RED = '#EF4444'
export const PEG_GREEN = '#22C55E'
export const PEG_INK = '#070B16'

export function pegTone(
  id: string,
  selectedId: string | null,
  tunedIds: ReadonlySet<string>,
  inTune: boolean,
  live: boolean,
): PegTone {
  if (id === selectedId) {
    if (live && inTune) return 'green'
    if (live) return 'red'
    return 'selected'
  }
  if (tunedIds.has(id)) return 'sticky'
  return 'idle'
}

export function pegColors(tone: PegTone): { fill: string; stroke: string; text: string } {
  if (tone === 'red') return { fill: PEG_RED, stroke: PEG_RED, text: PEG_WHITE }
  if (tone === 'green' || tone === 'sticky') {
    return { fill: PEG_GREEN, stroke: PEG_GREEN, text: PEG_WHITE }
  }
  if (tone === 'selected') return { fill: PEG_WHITE, stroke: PEG_WHITE, text: PEG_INK }
  return { fill: PEG_INK, stroke: PEG_LAVENDER, text: PEG_WHITE }
}

export function pegActiveColor(tone: PegTone): string | null {
  if (tone === 'green') return PEG_GREEN
  if (tone === 'red') return PEG_RED
  return null
}
