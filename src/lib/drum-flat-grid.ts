import { type InputDivision } from '@/lib/beat-boxes'

export type CountKind = 'beat' | 'sub'

/** Beat numbers only — subdivision syllables (e & a) stay off the grid. */
export function countMark(
  beat: number,
  slot: number,
  _input?: InputDivision,
): { text: string; kind: CountKind } {
  if (slot <= 0) return { text: String(beat + 1), kind: 'beat' }
  return { text: '', kind: 'sub' }
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
