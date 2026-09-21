import {
  METERS,
  patternFromHits,
  patternsEqual,
  type MeterId,
  type Pattern,
} from '@/lib/rhythm'

export type RhythmPreset = {
  id: string
  name: string
  blurb: string
  meterId: MeterId
  pattern: Pattern
}

function preset(
  id: string,
  name: string,
  blurb: string,
  meterId: MeterId,
  hits: Parameters<typeof patternFromHits>[1],
): RhythmPreset {
  return {
    id,
    name,
    blurb,
    meterId,
    pattern: patternFromHits(METERS[meterId], hits),
  }
}

export const RHYTHM_PRESETS: RhythmPreset[] = [
  preset('rock-44', 'Rock', 'Backbeat you can lean on', '4/4', {
    kick: [0, 8],
    snare: [4, 12],
    closedHat: [0, 2, 4, 6, 8, 10, 12, 14],
    crash: [0],
  }),
  preset('pop-44', 'Pop', 'Kick on the and of two', '4/4', {
    kick: [0, 6, 8],
    snare: [4, 12],
    closedHat: [0, 2, 4, 6, 8, 10, 12, 14],
    crash: [0],
  }),
  preset('funk-44', 'Funk', 'Syncopated kick, tight hats', '4/4', {
    kick: [0, 3, 8, 10],
    snare: [4, 12],
    closedHat: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15],
    openHat: [14],
  }),
  preset('ballad-44', 'Ballad', 'Quarter-note hats, room to sing', '4/4', {
    kick: [0, 8],
    snare: [4, 12],
    closedHat: [0, 4, 8, 12],
  }),
  preset('march-24', 'March', 'Left, right — 2/4 stomp', '2/4', {
    kick: [0],
    snare: [4],
    closedHat: [0, 2, 4, 6],
    crash: [0],
  }),
  preset('waltz-34', 'Waltz', 'Oom-pah-pah in 3', '3/4', {
    kick: [0],
    snare: [4, 8],
    closedHat: [0, 2, 4, 6, 8, 10],
    crash: [0],
  }),
  preset('five-54', 'Five', '3 + 2 pulse, Take Five pocket', '5/4', {
    kick: [0, 6],
    snare: [2, 8],
    closedHat: [0, 2, 4, 6, 8],
    crash: [0],
  }),
  preset('rock-68', 'Six-eight', 'Two big pulses, rocking 6/8', '6/8', {
    kick: [0, 3],
    snare: [3],
    closedHat: [0, 1, 2, 3, 4, 5],
    crash: [0],
  }),
  preset('odd-78', 'Seven', '2 + 2 + 3 — odd-meter rock', '7/8', {
    kick: [0, 4],
    snare: [2, 6],
    closedHat: [0, 1, 2, 3, 4, 5, 6],
    crash: [0],
  }),
  preset('slip-98', 'Slip jig', 'Three threes in 9/8', '9/8', {
    kick: [0, 3, 6],
    snare: [3, 6],
    closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    crash: [0],
  }),
  preset('blues-128', 'Shuffle blues', '12/8 slow-burn groove', '12/8', {
    kick: [0, 6],
    snare: [3, 9],
    closedHat: [0, 2, 3, 5, 6, 8, 9, 11],
    crash: [0],
  }),
]

export function presetsForMeter(meterId: MeterId): RhythmPreset[] {
  return RHYTHM_PRESETS.filter((item) => item.meterId === meterId)
}

export function defaultPreset(meterId: MeterId): RhythmPreset {
  return presetsForMeter(meterId)[0] ?? RHYTHM_PRESETS[0]
}

export function findPreset(id: string): RhythmPreset | undefined {
  return RHYTHM_PRESETS.find((item) => item.id === id)
}

export function matchPreset(meterId: MeterId, pattern: Pattern): RhythmPreset | null {
  return (
    RHYTHM_PRESETS.find(
      (item) => item.meterId === meterId && patternsEqual(item.pattern, pattern),
    ) ?? null
  )
}
