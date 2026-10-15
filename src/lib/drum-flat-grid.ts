import { type InputDivision } from '@/lib/beat-boxes'

/** Syllables after the beat number, aligned to the input grid. */
const SUB_SYLLABLES: Record<InputDivision, readonly string[]> = {
  2: ['&'],
  3: ['trip', 'let'],
  4: ['e', '&', 'a'],
  6: ['trip', 'let', 'trip', 'let', ''],
  8: ['', 'e', '', '&', '', 'a', ''],
}

export type CountKind = 'beat' | 'sub'

export function countMark(
  beat: number,
  slot: number,
  input: InputDivision,
): { text: string; kind: CountKind } {
  if (slot <= 0) return { text: String(beat + 1), kind: 'beat' }
  return { text: SUB_SYLLABLES[input][slot - 1] ?? '', kind: 'sub' }
}

export type GridLineKind = 'bar' | 'beat' | 'sub'

export function gridLineKind(beat: number, slot: number): GridLineKind {
  if (slot !== 0) return 'sub'
  if (beat === 0) return 'bar'
  return 'beat'
}

export function isBarEndSlot(beat: number, slot: number, beats: number, input: InputDivision): boolean {
  return beat === beats - 1 && slot === input - 1
}

export const PLAYHEAD_COLOR = '#FF4D6D'
export const HIT_COLOR = '#A855F7'
