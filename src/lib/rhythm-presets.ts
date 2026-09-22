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
  hits: Partial<Record<VoiceId, number[]>>
  fill?: Partial<Record<VoiceId, number[]>>
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
  fill?: Partial<Record<VoiceId, number[]>>,
): RhythmPreset {
  return {
    id,
    name,
    blurb,
    beats,
    beatUnit,
    subdivision,
    accents,
    hits,
    fill,
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
  preset('rock-44', 'Rock', 'Backbeat 8ths', 4, 4, 2, ROCK_GROOVE, undefined, ROCK_FILL),
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

const LOOP_BARS = 4
const CRASH_BARS = [0, 2]

function hitsWithoutCrash(
  hits: Partial<Record<VoiceId, number[]>>,
): Partial<Record<VoiceId, number[]>> {
  const next = { ...hits }
  delete next.crash
  return next
}

function barFromHits(
  beats: number,
  beatUnit: BeatUnit,
  subdivision: SubdivisionId,
  hits: Partial<Record<VoiceId, number[]>>,
  accents?: number[],
): RhythmBar {
  return makeBar(beats, beatUnit, subdivision, patternFromHits(beats, subdivision, hits), accents)
}

/** 4-bar phrase. Crash only on bars 1 and 3 when the groove includes a crash. */
export function makeGrooveBars(
  beats: number,
  beatUnit: BeatUnit,
  subdivision: SubdivisionId,
  hits: Partial<Record<VoiceId, number[]>>,
  fill?: Partial<Record<VoiceId, number[]>>,
  accents?: number[],
): RhythmBar[] {
  const body = hitsWithoutCrash(hits)
  const crashing =
    hits.crash && hits.crash.length > 0 ? { ...body, crash: hits.crash } : body
  const useCrash = crashing !== body
  return Array.from({ length: LOOP_BARS }, (_, index) => {
    if (fill && index === LOOP_BARS - 1) {
      return barFromHits(beats, beatUnit, subdivision, fill, accents)
    }
    const patternHits = useCrash && CRASH_BARS.includes(index) ? crashing : body
    return barFromHits(beats, beatUnit, subdivision, patternHits, accents)
  })
}

export function barsForPreset(item: RhythmPreset): RhythmBar[] {
  return makeGrooveBars(
    item.beats,
    item.beatUnit,
    item.subdivision,
    item.hits,
    item.fill,
    item.accents,
  ).map(cloneBar)
}

export function matchPreset(bar: RhythmBar): RhythmPreset | null {
  return (
    RHYTHM_PRESETS.find((item) =>
      barsForPreset(item).some(
        (loopBar) =>
          loopBar.beats === bar.beats &&
          loopBar.beatUnit === bar.beatUnit &&
          loopBar.subdivision === bar.subdivision &&
          patternsEqual(loopBar.pattern, bar.pattern),
      ),
    ) ?? null
  )
}

export function presetToBar(item: RhythmPreset): RhythmBar {
  return cloneBar(barsForPreset(item)[0] ?? makeBar(item.beats, item.beatUnit, item.subdivision, item.pattern, item.accents))
}

export function applyPreset(item: RhythmPreset): RhythmBar {
  return presetToBar(item)
}

/** First-open Rock: three groove bars (crash on 1 and 3), then a short tom fill. */
export function makeDefaultRockBars(): RhythmBar[] {
  return makeGrooveBars(4, 4, 2, ROCK_GROOVE, ROCK_FILL)
}

/** First-open Click: a single empty 4/4 bar (eighths), not the 4-bar Rock loop. */
export function makeDefaultClickBars(): RhythmBar[] {
  return [makeBar(4, 4, DEFAULT_SUBDIVISION)]
}
