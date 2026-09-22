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
 * Practice-kit grooves, grouped as styles with about three beats each.
 * Shape draws on common libraries (Logic Drummer, Ableton, Toontrack) and
 * textbook pockets (backbeat, four-on-the-floor, boom-bap, one-drop, bossa).
 */
export type RhythmStyleId =
  | 'rock'
  | 'funk'
  | 'metal'
  | 'pop'
  | 'hiphop'
  | 'house'
  | 'latin'
  | 'shuffle'
  | 'waltz'
  | 'odd'

export type RhythmPreset = {
  id: string
  styleId: RhythmStyleId
  styleName: string
  groove: 1 | 2 | 3
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

export type RhythmStyle = {
  id: RhythmStyleId
  name: string
  grooves: RhythmPreset[]
}

function preset(
  id: string,
  styleId: RhythmStyleId,
  styleName: string,
  groove: 1 | 2 | 3,
  blurb: string,
  beats: number,
  beatUnit: BeatUnit,
  subdivision: SubdivisionId,
  hits: Partial<Record<VoiceId, number[]>>,
  fill?: Partial<Record<VoiceId, number[]>>,
  accents?: number[],
): RhythmPreset {
  return {
    id,
    styleId,
    styleName,
    groove,
    name: `${styleName} ${groove}`,
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

const HATS_16 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
const HATS_8_16 = [0, 2, 4, 6, 8, 10, 12, 14]

export const RHYTHM_STYLES: RhythmStyle[] = [
  {
    id: 'rock',
    name: 'Rock',
    grooves: [
      preset('rock-44', 'rock', 'Rock', 1, 'Backbeat 8ths', 4, 4, 2, ROCK_GROOVE, ROCK_FILL),
      preset('punk-44', 'rock', 'Rock', 2, 'Driving 8th kicks', 4, 4, 2, {
        kick: [0, 1, 2, 3, 4, 5, 6, 7],
        snare: [2, 6],
        closedHat: [0, 1, 2, 3, 4, 5, 6, 7],
        crash: [0],
      }),
      preset('halftime-44', 'rock', 'Rock', 3, 'Snare on three', 4, 4, 4, {
        kick: [0, 6, 10],
        snare: [8],
        closedHat: HATS_8_16,
        openHat: [14],
        crash: [0],
      }),
    ],
  },
  {
    id: 'funk',
    name: 'Funk',
    grooves: [
      preset('funk-44', 'funk', 'Funk', 1, 'Syncopated 16ths', 4, 4, 4, {
        kick: [0, 3, 8, 10],
        snare: [4, 12],
        rim: [6, 7, 11, 14],
        closedHat: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13, 15],
        openHat: [14],
      }),
      preset('funk-2', 'funk', 'Funk', 2, 'Clav pocket', 4, 4, 4, {
        kick: [0, 6, 8, 13],
        snare: [4, 12],
        rim: [2, 7, 11],
        closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15],
        openHat: [14],
      }),
      preset('funk-3', 'funk', 'Funk', 3, 'The One', 4, 4, 4, {
        kick: [0, 7, 10],
        snare: [4, 12],
        rim: [2, 6, 11, 14],
        closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15],
        openHat: [14],
      }),
    ],
  },
  {
    id: 'metal',
    name: 'Metal',
    grooves: [
      preset('metal-44', 'metal', 'Metal', 1, 'Gallop kick', 4, 4, 4, {
        kick: [0, 2, 3, 8, 10, 11],
        snare: [4, 12],
        closedHat: HATS_16,
        crash: [0],
      }),
      preset('metal-2', 'metal', 'Metal', 2, 'Double-kick 1 & 3', 4, 4, 4, {
        kick: [0, 1, 2, 3, 8, 9, 10, 11],
        snare: [4, 12],
        closedHat: HATS_8_16,
        crash: [0],
      }),
      preset('metal-3', 'metal', 'Metal', 3, 'Driving 8ths', 4, 4, 4, {
        kick: HATS_8_16,
        snare: [4, 12],
        closedHat: HATS_16,
        crash: [0],
      }),
    ],
  },
  {
    id: 'pop',
    name: 'Pop',
    grooves: [
      preset('pop-44', 'pop', 'Pop', 1, 'Kick on the and', 4, 4, 4, {
        kick: [0, 6, 8],
        snare: [4, 12],
        clap: [4, 12],
        closedHat: HATS_8_16,
        crash: [0],
      }),
      preset('motown-44', 'pop', 'Pop', 2, 'Snare on all four', 4, 4, 2, {
        kick: [0, 4],
        snare: [0, 2, 4, 6],
        closedHat: [0, 1, 2, 3, 4, 5, 6, 7],
      }),
      preset('pop-3', 'pop', 'Pop', 3, 'Four-on-the-floor', 4, 4, 4, {
        kick: [0, 4, 8, 12],
        snare: [4, 12],
        closedHat: HATS_8_16,
        openHat: [6, 14],
      }),
    ],
  },
  {
    id: 'hiphop',
    name: 'Hip-hop',
    grooves: [
      preset('hiphop-44', 'hiphop', 'Hip-hop', 1, 'Boom-bap snare', 4, 4, 4, {
        kick: [0, 7, 10],
        snare: [4, 12],
        clap: [4, 12],
        closedHat: HATS_8_16,
      }),
      preset('trap-44', 'hiphop', 'Hip-hop', 2, 'Snare on three', 4, 4, 4, {
        kick: [0, 3, 8, 11, 14],
        snare: [8],
        clap: [8],
        closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15],
        openHat: [12],
      }),
      preset('hiphop-3', 'hiphop', 'Hip-hop', 3, 'Bounce pocket', 4, 4, 4, {
        kick: [0, 3, 8, 11],
        snare: [4, 12],
        clap: [4, 12],
        closedHat: HATS_8_16,
        openHat: [14],
      }),
    ],
  },
  {
    id: 'house',
    name: 'House',
    grooves: [
      preset('house-44', 'house', 'House', 1, 'Offbeat open hats', 4, 4, 4, {
        kick: [0, 4, 8, 12],
        clap: [4, 12],
        closedHat: [0, 4, 8, 12],
        openHat: [2, 6, 10, 14],
      }),
      preset('disco-44', 'house', 'House', 2, 'Four on the floor', 4, 4, 4, {
        kick: [0, 4, 8, 12],
        snare: [4, 12],
        clap: [4, 12],
        closedHat: HATS_16,
        openHat: [2, 6, 10, 14],
      }),
      preset('house-3', 'house', 'House', 3, 'Tech 16ths', 4, 4, 4, {
        kick: [0, 4, 8, 12],
        clap: [4, 12],
        closedHat: HATS_16,
        openHat: [6, 14],
      }),
    ],
  },
  {
    id: 'latin',
    name: 'Latin',
    grooves: [
      preset('bossa-44', 'latin', 'Latin', 1, 'Rim clave feel', 4, 4, 4, {
        kick: [0, 3, 8, 11],
        rim: [4, 7, 12, 14],
        ride: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
      }),
      preset('reggae-44', 'latin', 'Latin', 2, 'One-drop', 4, 4, 4, {
        kick: [8],
        snare: [8],
        rim: [4, 12],
        closedHat: [2, 6, 10, 14],
        openHat: [14],
      }),
      preset('latin-3', 'latin', 'Latin', 3, 'Samba pulse', 4, 4, 4, {
        kick: [0, 7, 8, 15],
        rim: [2, 6, 10, 14],
        ride: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
      }),
    ],
  },
  {
    id: 'shuffle',
    name: 'Shuffle',
    grooves: [
      preset('shuffle-44', 'shuffle', 'Shuffle', 1, 'Swing triplets', 4, 4, 3, {
        kick: [0, 6],
        snare: [3, 9],
        closedHat: [0, 2, 3, 5, 6, 8, 9, 11],
        crash: [0],
      }),
      preset('train-24', 'shuffle', 'Shuffle', 2, 'Country 8ths', 2, 4, 2, {
        kick: [0],
        snare: [0, 1, 2, 3],
        closedHat: [0, 1, 2, 3],
      }),
      preset('blues-128', 'shuffle', 'Shuffle', 3, '12/8 shuffle', 12, 8, 2, {
        kick: [0, 12],
        snare: [6, 18],
        closedHat: [0, 4, 6, 10, 12, 16, 18, 22],
        crash: [0],
      }),
    ],
  },
  {
    id: 'waltz',
    name: 'Waltz',
    grooves: [
      preset('waltz-34', 'waltz', 'Waltz', 1, 'Oom-pah-pah', 3, 4, 2, {
        kick: [0],
        snare: [2, 4],
        closedHat: [0, 1, 2, 3, 4, 5],
        crash: [0],
      }),
      preset('jazz-waltz-34', 'waltz', 'Waltz', 2, 'Ride 1 · 2+ · 3', 3, 4, 2, {
        kick: [0],
        snare: [4],
        closedHat: [2],
        ride: [0, 3, 4],
      }),
      preset('waltz-3', 'waltz', 'Waltz', 3, 'Country 3/4', 3, 4, 2, {
        kick: [0],
        snare: [2, 4],
        floorTom: [2, 4],
        closedHat: [0, 1, 2, 3, 4, 5],
      }),
    ],
  },
  {
    id: 'odd',
    name: 'Odd',
    grooves: [
      preset('five-54', 'odd', 'Odd', 1, '3 + 2 pocket', 5, 4, 2, {
        kick: [0, 6],
        snare: [2, 8],
        closedHat: [0, 2, 4, 6, 8],
        crash: [0],
      }),
      preset('rock-68', 'odd', 'Odd', 2, 'Two big pulses', 6, 8, 2, {
        kick: [0, 6],
        snare: [6],
        closedHat: [0, 2, 4, 6, 8, 10],
        crash: [0],
      }),
      preset('odd-78', 'odd', 'Odd', 3, '2 + 2 + 3', 7, 8, 2, {
        kick: [0, 8],
        snare: [4, 12],
        closedHat: [0, 2, 4, 6, 8, 10, 12],
        crash: [0],
      }),
    ],
  },
]

export const RHYTHM_PRESETS: RhythmPreset[] = RHYTHM_STYLES.flatMap((style) => style.grooves)

const LEGACY_PRESET_IDS: Record<string, string> = {
  march: 'five-54',
  'march-24': 'five-54',
}

export function findPreset(id: string): RhythmPreset | undefined {
  const mapped = LEGACY_PRESET_IDS[id] ?? id
  return RHYTHM_PRESETS.find((item) => item.id === mapped)
}

export function findStyle(id: RhythmStyleId): RhythmStyle | undefined {
  return RHYTHM_STYLES.find((item) => item.id === id)
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
  return cloneBar(
    barsForPreset(item)[0] ?? makeBar(item.beats, item.beatUnit, item.subdivision, item.pattern, item.accents),
  )
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
