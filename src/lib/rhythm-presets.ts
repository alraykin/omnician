import {
  cloneBar,
  DEFAULT_SUBDIVISION,
  makeBar,
  patternFromHits,
  patternsEqual,
  type BeatUnit,
  type RhythmBar,
  type SubdivisionId,
  type VoiceId,
} from '@/lib/rhythm'

/**
 * Practice-kit grooves, not random grids. Shape draws on common drum-machine /
 * DAW libraries: Logic/GarageBand Drummer genres, Ableton Live Drum Rack
 * factory kits, Toontrack EZDrummer/Superior MIDI (Rock, Funk, Metal, Latin,
 * Jazz), and textbook patterns (backbeat, four-on-the-floor, boom-bap, one-drop,
 * bossa nova, blues shuffle).
 */
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

const ROCK_GROOVE: Partial<Record<VoiceId, number[]>> = {
  kick: [0, 4],
  snare: [2, 6],
  closedHat: [0, 1, 2, 3, 4, 5, 6, 7],
  crash: [0],
}

const ROCK_FILL: Partial<Record<VoiceId, number[]>> = {
  kick: [0],
  snare: [2],
  closedHat: [0, 1],
  highTom: [3, 4],
  midTom: [5, 6],
  floorTom: [7],
}

export const RHYTHM_PRESETS: RhythmPreset[] = [
  preset('rock-44', 'Rock', 'Backbeat 8ths', 4, 4, 2, ROCK_GROOVE),
  preset('punk-44', 'Punk', 'Driving 8th kicks', 4, 4, 2, {
    kick: [0, 1, 2, 3, 4, 5, 6, 7],
    snare: [2, 6],
    closedHat: [0, 1, 2, 3, 4, 5, 6, 7],
    crash: [0],
  }),
  preset('pop-44', 'Pop', 'Kick on the and', 4, 4, 4, {
    kick: [0, 6, 8],
    snare: [4, 12],
    clap: [4, 12],
    closedHat: [0, 2, 4, 6, 8, 10, 12, 14],
    crash: [0],
  }),
  preset('disco-44', 'Disco', 'Four on the floor', 4, 4, 4, {
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    clap: [4, 12],
    closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    openHat: [2, 6, 10, 14],
  }),
  preset('funk-44', 'Funk', 'Syncopated 16ths', 4, 4, 4, {
    kick: [0, 3, 8, 10],
    snare: [4, 6, 12, 14],
    closedHat: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15],
    openHat: [14],
  }),
  preset('hiphop-44', 'Hip-hop', 'Boom-bap snare', 4, 4, 4, {
    kick: [0, 7, 10],
    snare: [4, 12],
    clap: [4, 12],
    closedHat: [0, 2, 4, 6, 8, 10, 12, 14],
  }),
  preset('trap-44', 'Trap', 'Snare on three', 4, 4, 4, {
    kick: [0, 3, 8, 11, 14],
    snare: [8],
    clap: [8],
    closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15],
    openHat: [12],
  }),
  preset('house-44', 'House', 'Offbeat open hats', 4, 4, 4, {
    kick: [0, 4, 8, 12],
    clap: [4, 12],
    closedHat: [0, 4, 8, 12],
    openHat: [2, 6, 10, 14],
  }),
  preset('halftime-44', 'Half-time', 'Snare on three', 4, 4, 4, {
    kick: [0, 6, 10],
    snare: [8],
    closedHat: [0, 2, 4, 6, 8, 10, 12, 14],
    openHat: [14],
  }),
  preset('metal-44', 'Metal', 'Gallop kick', 4, 4, 4, {
    kick: [0, 2, 3, 8, 10, 11],
    snare: [4, 12],
    closedHat: [0, 2, 4, 6, 8, 10, 12, 14],
    crash: [0],
  }),
  preset('shuffle-44', 'Shuffle', 'Swing triplets', 4, 4, 3, {
    kick: [0, 6],
    snare: [3, 9],
    closedHat: [0, 2, 3, 5, 6, 8, 9, 11],
    crash: [0],
  }),
  preset('motown-44', 'Motown', 'Snare on all four', 4, 4, 2, {
    kick: [0, 4],
    snare: [0, 2, 4, 6],
    closedHat: [0, 1, 2, 3, 4, 5, 6, 7],
  }),
  preset('bossa-44', 'Bossa', 'Rim clave feel', 4, 4, 4, {
    kick: [0, 3, 8, 11],
    rim: [4, 7, 12, 14],
    ride: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
  }),
  preset('reggae-44', 'Reggae', 'One-drop', 4, 4, 4, {
    kick: [8],
    snare: [8],
    rim: [4, 12],
    closedHat: [2, 6, 10, 14],
    openHat: [14],
  }),
  preset('march-24', 'March', '2/4 stomp', 2, 4, 4, {
    kick: [0],
    snare: [4],
    closedHat: [0, 2, 4, 6],
    crash: [0],
  }),
  preset('train-24', 'Train', 'Country 8ths', 2, 4, 2, {
    kick: [0],
    snare: [0, 1, 2, 3],
    closedHat: [0, 1, 2, 3],
  }),
  preset('waltz-34', 'Waltz', 'Oom-pah-pah', 3, 4, 2, {
    kick: [0],
    snare: [2, 4],
    closedHat: [0, 1, 2, 3, 4, 5],
    crash: [0],
  }),
  preset('jazz-waltz-34', 'Jazz waltz', 'Ride 1 · 2+ · 3', 3, 4, 2, {
    kick: [0],
    snare: [4],
    closedHat: [2],
    ride: [0, 3, 4],
  }),
  preset('five-54', 'Five', '3 + 2 pocket', 5, 4, 2, {
    kick: [0, 6],
    snare: [2, 8],
    closedHat: [0, 2, 4, 6, 8],
    crash: [0],
  }),
  preset('rock-68', 'Six-eight', 'Two big pulses', 6, 8, 2, {
    kick: [0, 6],
    snare: [6],
    closedHat: [0, 2, 4, 6, 8, 10],
    crash: [0],
  }),
  preset('odd-78', 'Seven', '2 + 2 + 3', 7, 8, 2, {
    kick: [0, 8],
    snare: [4, 12],
    closedHat: [0, 2, 4, 6, 8, 10, 12],
    crash: [0],
  }),
  preset('blues-128', 'Blues', '12/8 shuffle', 12, 8, 2, {
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

/** First-open Rock: three groove bars, then a short tom fill into the one. */
export function makeDefaultRockBars(): RhythmBar[] {
  const groove = makeBar(4, 4, 2, patternFromHits(4, 2, ROCK_GROOVE))
  const fill = makeBar(4, 4, 2, patternFromHits(4, 2, ROCK_FILL))
  return [cloneBar(groove), cloneBar(groove), cloneBar(groove), cloneBar(fill)]
}

/** First-open Click: a single empty 4/4 bar (eighths), not the 4-bar Rock loop. */
export function makeDefaultClickBars(): RhythmBar[] {
  return [makeBar(4, 4, DEFAULT_SUBDIVISION)]
}
