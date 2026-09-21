import {
  makeBar,
  patternFromHits,
  patternsEqual,
  type BeatUnit,
  type RhythmBar,
  type SubdivisionId,
  type VoiceId,
} from '@/lib/rhythm'

export type RhythmPreset = {
  id: string
  name: string
  blurb: string
  beats: number
  beatUnit: BeatUnit
  subdivision: SubdivisionId
  accents?: number[]
  pattern: ReturnType<typeof patternFromHits>
}

function preset(
  id: string,
  name: string,
  blurb: string,
  beats: number,
  beatUnit: BeatUnit,
  subdivision: SubdivisionId,
  hits: Partial<Record<VoiceId, number[]>>,
  accents?: number[],
): RhythmPreset {
  return {
    id,
    name,
    blurb,
    beats,
    beatUnit,
    subdivision,
    accents,
    pattern: patternFromHits(beats, subdivision, hits),
  }
}

export const RHYTHM_PRESETS: RhythmPreset[] = [
  preset('rock-44', 'Rock', 'Backbeat you can lean on', 4, 4, 'eighths', {
    kick: [0, 4],
    snare: [2, 6],
    closedHat: [0, 1, 2, 3, 4, 5, 6, 7],
    crash: [0],
  }),
  preset('pop-44', 'Pop', 'Kick on the and of two', 4, 4, 'sixteenths', {
    kick: [0, 6, 8],
    snare: [4, 12],
    closedHat: [0, 2, 4, 6, 8, 10, 12, 14],
    crash: [0],
  }),
  preset('funk-44', 'Funk', 'Syncopated kick, tight hats', 4, 4, 'sixteenths', {
    kick: [0, 3, 8, 10],
    snare: [4, 12],
    closedHat: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15],
    openHat: [14],
  }),
  preset('ballad-44', 'Ballad', 'Quarter-note hats, room to sing', 4, 4, 'sixteenths', {
    kick: [0, 8],
    snare: [4, 12],
    closedHat: [0, 4, 8, 12],
  }),
  preset('triplet-44', 'Shuffle', 'Swing triplets in 4', 4, 4, 'triplets', {
    kick: [0, 6],
    snare: [3, 9],
    closedHat: [0, 2, 3, 5, 6, 8, 9, 11],
    crash: [0],
  }),
  preset('march-24', 'March', 'Left, right — 2/4 stomp', 2, 4, 'sixteenths', {
    kick: [0],
    snare: [4],
    closedHat: [0, 2, 4, 6],
    crash: [0],
  }),
  preset('waltz-34', 'Waltz', 'Oom-pah-pah in 3', 3, 4, 'sixteenths', {
    kick: [0],
    snare: [4, 8],
    closedHat: [0, 2, 4, 6, 8, 10],
    crash: [0],
  }),
  preset('five-54', 'Five', '3 + 2 pulse, Take Five pocket', 5, 4, 'eighths', {
    kick: [0, 6],
    snare: [2, 8],
    closedHat: [0, 2, 4, 6, 8],
    crash: [0],
  }),
  preset('eleven-118', 'Eleven', '11/8 — 3+3+3+2', 11, 8, 'eighths', {
    kick: [0, 6, 12, 16],
    snare: [4, 10, 18],
    closedHat: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    crash: [0],
  }, [0, 3, 6, 8]),
  preset('rock-68', 'Six-eight', 'Two big pulses, rocking 6/8', 6, 8, 'eighths', {
    kick: [0, 6],
    snare: [6],
    closedHat: [0, 2, 4, 6, 8, 10],
    crash: [0],
  }),
  preset('odd-78', 'Seven', '2 + 2 + 3 — odd-meter rock', 7, 8, 'eighths', {
    kick: [0, 8],
    snare: [4, 12],
    closedHat: [0, 2, 4, 6, 8, 10, 12],
    crash: [0],
  }),
  preset('slip-98', 'Slip jig', 'Three threes in 9/8', 9, 8, 'eighths', {
    kick: [0, 6, 12],
    snare: [6, 12],
    closedHat: [0, 2, 4, 6, 8, 10, 12, 14, 16],
    crash: [0],
  }),
  preset('blues-128', 'Shuffle blues', '12/8 slow-burn groove', 12, 8, 'eighths', {
    kick: [0, 12],
    snare: [6, 18],
    closedHat: [0, 4, 6, 10, 12, 16, 18, 22],
    crash: [0],
  }),
]

export function findPreset(id: string): RhythmPreset | undefined {
  return RHYTHM_PRESETS.find((item) => item.id === id)
}

export function matchPreset(bar: RhythmBar): RhythmPreset | null {
  return (
    RHYTHM_PRESETS.find(
      (item) =>
        item.beats === bar.beats &&
        item.beatUnit === bar.beatUnit &&
        item.subdivision === bar.subdivision &&
        patternsEqual(item.pattern, bar.pattern),
    ) ?? null
  )
}

export function presetToBar(preset: RhythmPreset): RhythmBar {
  return makeBar(
    preset.beats,
    preset.beatUnit,
    preset.subdivision,
    preset.pattern,
    preset.accents,
  )
}

export function applyPreset(preset: RhythmPreset): RhythmBar {
  return presetToBar(preset)
}
