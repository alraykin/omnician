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
 * Practice-kit grooves grouped as styles with three beats each.
 * Patterns are original grids inspired by well-known textbook pockets
 * (backbeat, four-on-the-floor, boom-bap, one-drop, bossa, gallop) — not copies of recordings.
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

type HitMap = Partial<Record<VoiceId, number[]>>

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
  hits: HitMap
  fill?: HitMap
  mid?: HitMap
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
  hits: HitMap,
  fill?: HitMap,
  mid?: HitMap,
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
    mid,
    pattern: patternFromHits(beats, subdivision, hits),
  }
}

const HATS_8_16 = [0, 2, 4, 6, 8, 10, 12, 14]

function hatsCover(stepCount: number, openSlots: number[]): number[] {
  return Array.from({ length: stepCount }, (_, step) => step).filter((step) => !openSlots.includes(step))
}

function hatsExcept(openSlots: number[]): number[] {
  return hatsCover(16, openSlots)
}

const ROCK_EIGHTH_HATS = HATS_8_16.filter((step) => step !== 14)

const ROCK_GROOVE: HitMap = {
  kick: [0, 7, 8, 10],
  snare: [4, 12],
  closedHat: ROCK_EIGHTH_HATS,
  openHat: [14],
  crash: [0],
}

const ROCK_FILL: HitMap = {
  kick: [0, 7],
  snare: [4],
  closedHat: [0, 2, 4],
  highTom: [8, 9, 10],
  midTom: [11, 12],
  floorTom: [13, 14, 15],
  openHat: [15],
}

export const RHYTHM_STYLES: RhythmStyle[] = [
  {
    id: 'rock',
    name: 'Rock',
    grooves: [
      preset('rock-44', 'rock', 'Rock', 1, 'Backbeat + tom fill', 4, 4, 4, ROCK_GROOVE, ROCK_FILL, {
        kick: [0, 7, 8, 10],
        snare: [4, 12, 15],
        closedHat: ROCK_EIGHTH_HATS,
        openHat: [14],
      }),
      preset(
        'punk-44',
        'rock',
        'Rock',
        2,
        'Driving 8th kicks',
        4,
        4,
        4,
        {
          kick: HATS_8_16,
          snare: [4, 12],
          closedHat: hatsExcept([6, 14]),
          openHat: [6, 14],
          crash: [0],
        },
        {
          kick: [0, 2, 4, 6, 8],
          snare: [4],
          closedHat: [0, 2, 4],
          highTom: [8, 9, 10],
          midTom: [11, 12],
          floorTom: [13, 14, 15],
          openHat: [15],
        },
      ),
      preset(
        'halftime-44',
        'rock',
        'Rock',
        3,
        'Half-time toms',
        4,
        4,
        4,
        {
          kick: [0, 6, 10, 14],
          snare: [8],
          closedHat: hatsExcept([14]),
          openHat: [14],
          floorTom: [4, 12],
          crash: [0],
        },
        {
          kick: [0, 6],
          snare: [8],
          closedHat: [0, 2],
          highTom: [4, 5, 6],
          midTom: [9, 10, 11],
          floorTom: [12, 13, 14, 15],
          openHat: [15],
        },
      ),
    ],
  },
  {
    id: 'funk',
    name: 'Funk',
    grooves: [
      preset(
        'funk-44',
        'funk',
        'Funk',
        1,
        'Ghost 16ths',
        4,
        4,
        4,
        {
          kick: [0, 3, 8, 10, 14],
          snare: [4, 12],
          rim: [2, 6, 7, 11, 13, 14],
          closedHat: hatsExcept([7, 15]),
          openHat: [7, 15],
        },
        {
          kick: [0, 3, 10],
          snare: [4],
          rim: [6, 7],
          closedHat: [0, 1, 2, 3, 4, 5],
          highTom: [8, 9, 10],
          midTom: [11, 12],
          floorTom: [13, 14],
          openHat: [15],
        },
      ),
      preset(
        'funk-2',
        'funk',
        'Funk',
        2,
        'Clav pocket',
        4,
        4,
        4,
        {
          kick: [0, 6, 8, 13],
          snare: [4, 12],
          rim: [2, 7, 11, 15],
          closedHat: hatsExcept([6, 14]),
          openHat: [6, 14],
        },
        {
          kick: [0, 6, 8],
          snare: [4],
          closedHat: [0, 2, 4, 6],
          highTom: [9, 10],
          midTom: [11, 12],
          floorTom: [13, 14],
          openHat: [15],
        },
      ),
      preset(
        'funk-3',
        'funk',
        'Funk',
        3,
        'The One',
        4,
        4,
        4,
        {
          kick: [0, 7, 10],
          snare: [4, 12],
          rim: [2, 6, 11, 13, 14],
          closedHat: hatsExcept([2, 14]),
          openHat: [2, 14],
        },
        {
          kick: [0, 10],
          snare: [4],
          rim: [6, 7],
          closedHat: [0, 2, 4],
          highTom: [8, 9],
          midTom: [11, 12],
          floorTom: [13, 14, 15],
          openHat: [15],
        },
      ),
    ],
  },
  {
    id: 'metal',
    name: 'Metal',
    grooves: [
      preset(
        'metal-44',
        'metal',
        'Metal',
        1,
        'Gallop kick',
        4,
        4,
        4,
        {
          kick: [0, 2, 3, 8, 10, 11],
          snare: [4, 12],
          closedHat: hatsExcept([14]),
          openHat: [14],
          crash: [0],
        },
        {
          kick: [0, 2, 3, 8],
          snare: [4, 12],
          closedHat: [0, 2, 4, 6],
          highTom: [8, 9],
          midTom: [10, 11],
          floorTom: [13, 14, 15],
        },
      ),
      preset(
        'metal-2',
        'metal',
        'Metal',
        2,
        'Double-kick 1 & 3',
        4,
        4,
        4,
        {
          kick: [0, 1, 2, 3, 8, 9, 10, 11, 14],
          snare: [4, 12],
          closedHat: hatsExcept([14]),
          openHat: [14],
          crash: [0],
        },
        {
          kick: [0, 1, 2, 3, 8, 9],
          snare: [4, 12],
          closedHat: [0, 2, 4, 6, 8],
          midTom: [10, 11],
          floorTom: [12, 13, 14, 15],
          openHat: [15],
        },
      ),
      preset(
        'metal-3',
        'metal',
        'Metal',
        3,
        'Driving 8ths',
        4,
        4,
        4,
        {
          kick: [0, 2, 4, 6, 7, 8, 10, 12, 14],
          snare: [4, 12],
          closedHat: hatsExcept([6, 14]),
          openHat: [6, 14],
          floorTom: [10],
          crash: [0],
        },
        {
          kick: [0, 8],
          snare: [4],
          closedHat: [0, 2, 4],
          highTom: [6, 7, 8],
          midTom: [9, 10, 11],
          floorTom: [12, 13, 14, 15],
        },
      ),
    ],
  },
  {
    id: 'pop',
    name: 'Pop',
    grooves: [
      preset(
        'pop-44',
        'pop',
        'Pop',
        1,
        'Kick on the and',
        4,
        4,
        4,
        {
          kick: [0, 6, 8, 14],
          snare: [4, 12],
          clap: [4, 12],
          closedHat: hatsExcept([14]),
          openHat: [14],
          crash: [0],
        },
        {
          kick: [0, 6, 8],
          snare: [4, 12],
          closedHat: [0, 2, 4, 6, 8],
          highTom: [10, 11],
          midTom: [12, 13],
          floorTom: [14],
          openHat: [15],
        },
      ),
      preset(
        'motown-44',
        'pop',
        'Pop',
        2,
        'Snare on all four',
        4,
        4,
        4,
        {
          kick: [0, 6, 8, 14],
          snare: [0, 4, 8, 12],
          closedHat: hatsExcept([6, 14]),
          openHat: [6, 14],
        },
        {
          kick: [0, 8],
          snare: [0, 4, 8],
          closedHat: [0, 2, 4, 6, 8],
          highTom: [10],
          midTom: [12],
          floorTom: [14, 15],
          openHat: [15],
        },
      ),
      preset(
        'pop-3',
        'pop',
        'Pop',
        3,
        'Four-on-the-floor',
        4,
        4,
        4,
        {
          kick: [0, 4, 8, 12],
          snare: [4, 12],
          clap: [4, 12],
          closedHat: hatsExcept([2, 6, 10, 14]),
          openHat: [2, 6, 10, 14],
        },
        {
          kick: [0, 4, 8, 12],
          clap: [4, 12],
          closedHat: [0, 4, 8],
          highTom: [9, 10],
          midTom: [11, 12],
          floorTom: [13, 14],
          openHat: [15],
        },
      ),
    ],
  },
  {
    id: 'hiphop',
    name: 'Hip-hop',
    grooves: [
      preset(
        'hiphop-44',
        'hiphop',
        'Hip-hop',
        1,
        'Boom-bap snare',
        4,
        4,
        4,
        {
          kick: [0, 7, 10, 13],
          snare: [4, 12],
          clap: [4, 12],
          rim: [2, 6, 11, 14],
          closedHat: hatsExcept([14]),
          openHat: [14],
        },
        {
          kick: [0, 7],
          snare: [4, 12],
          closedHat: [0, 2, 4, 6],
          highTom: [8, 9],
          midTom: [10, 11],
          floorTom: [13, 14],
          openHat: [15],
        },
      ),
      preset(
        'trap-44',
        'hiphop',
        'Hip-hop',
        2,
        'Snare on three',
        4,
        4,
        4,
        {
          kick: [0, 3, 8, 11, 14],
          snare: [8],
          clap: [8],
          closedHat: hatsExcept([12]),
          openHat: [12],
        },
        {
          kick: [0, 3, 8],
          snare: [8],
          closedHat: [0, 2, 4, 6, 8],
          highTom: [10, 11],
          midTom: [12, 13],
          floorTom: [14, 15],
          openHat: [15],
        },
      ),
      preset(
        'hiphop-3',
        'hiphop',
        'Hip-hop',
        3,
        'Bounce pocket',
        4,
        4,
        4,
        {
          kick: [0, 3, 8, 11],
          snare: [4, 12],
          clap: [4, 12],
          rim: [6, 14],
          closedHat: hatsExcept([6, 14]),
          openHat: [6, 14],
        },
        {
          kick: [0, 3, 8],
          snare: [4, 12],
          rim: [6],
          closedHat: [0, 2, 4, 8],
          highTom: [9, 10],
          floorTom: [13, 14, 15],
          openHat: [15],
        },
      ),
    ],
  },
  {
    id: 'house',
    name: 'House',
    grooves: [
      preset(
        'house-44',
        'house',
        'House',
        1,
        'Offbeat open hats',
        4,
        4,
        4,
        {
          kick: [0, 4, 8, 12],
          clap: [4, 12],
          closedHat: hatsExcept([2, 6, 10, 14]),
          openHat: [2, 6, 10, 14],
        },
        {
          kick: [0, 4, 8, 12],
          clap: [4, 12],
          closedHat: [0, 4, 8],
          highTom: [9],
          midTom: [11],
          floorTom: [13, 14],
          openHat: [2, 6, 10, 15],
        },
      ),
      preset(
        'disco-44',
        'house',
        'House',
        2,
        'Four on the floor',
        4,
        4,
        4,
        {
          kick: [0, 4, 8, 12],
          snare: [4, 12],
          clap: [4, 12],
          closedHat: hatsExcept([2, 6, 10, 14]),
          openHat: [2, 6, 10, 14],
        },
        {
          kick: [0, 4, 8, 12],
          snare: [4, 12],
          clap: [4, 12],
          closedHat: [0, 4, 8],
          highTom: [10],
          midTom: [11, 12],
          floorTom: [14],
          openHat: [15],
        },
      ),
      preset(
        'house-3',
        'house',
        'House',
        3,
        'Tech 16ths',
        4,
        4,
        4,
        {
          kick: [0, 4, 8, 12],
          clap: [4, 12],
          closedHat: hatsExcept([2, 6, 14]),
          openHat: [2, 6, 14],
        },
        {
          kick: [0, 4, 8, 12],
          clap: [4, 12],
          closedHat: [0, 2, 4, 8],
          highTom: [9, 10],
          midTom: [13],
          floorTom: [14, 15],
          openHat: [6, 15],
        },
      ),
    ],
  },
  {
    id: 'latin',
    name: 'Latin',
    grooves: [
      preset(
        'bossa-44',
        'latin',
        'Latin',
        1,
        'Rim clave feel',
        4,
        4,
        4,
        {
          kick: [0, 3, 8, 11],
          rim: [4, 7, 12, 14],
          closedHat: [4, 12],
          ride: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
          openHat: [14],
        },
        {
          kick: [0, 3, 8],
          rim: [4, 7],
          ride: [0, 2, 4, 6, 8],
          highTom: [10, 11],
          midTom: [12, 13],
          floorTom: [14, 15],
        },
      ),
      preset(
        'reggae-44',
        'latin',
        'Latin',
        2,
        'One-drop',
        4,
        4,
        4,
        {
          kick: [8],
          snare: [8],
          rim: [4, 12],
          closedHat: hatsExcept([14]),
          openHat: [14],
        },
        {
          kick: [8],
          snare: [8],
          rim: [4, 12],
          closedHat: [0, 2, 4, 6, 8],
          highTom: [10],
          midTom: [12],
          floorTom: [14, 15],
          openHat: [15],
        },
      ),
      preset(
        'latin-3',
        'latin',
        'Latin',
        3,
        'Samba pulse',
        4,
        4,
        4,
        {
          kick: [0, 7, 8, 15],
          rim: [2, 6, 10, 14],
          closedHat: hatsExcept([14]),
          floorTom: [0, 8],
          ride: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
          openHat: [14],
        },
        {
          kick: [0, 7, 8],
          rim: [2, 6, 10],
          ride: [0, 2, 4, 6, 8],
          highTom: [9, 10, 11],
          midTom: [12, 13],
          floorTom: [0, 14, 15],
        },
      ),
    ],
  },
  {
    id: 'shuffle',
    name: 'Shuffle',
    grooves: [
      preset(
        'shuffle-44',
        'shuffle',
        'Shuffle',
        1,
        'Swing triplets',
        4,
        4,
        3,
        {
          kick: [0, 5, 6],
          snare: [3, 9],
          rim: [2, 8],
          closedHat: [0, 2, 3, 5, 6, 8, 9],
          openHat: [11],
          crash: [0],
        },
        {
          kick: [0],
          snare: [3],
          closedHat: [0, 2, 3],
          highTom: [5, 6],
          midTom: [7, 8],
          floorTom: [9, 10, 11],
          openHat: [11],
        },
      ),
      preset(
        'train-24',
        'shuffle',
        'Shuffle',
        2,
        'Country 8ths',
        4,
        4,
        2,
        {
          kick: [0, 4],
          snare: [0, 1, 2, 3, 4, 5, 6, 7],
          closedHat: [0, 1, 2, 3, 4, 5, 6],
          openHat: [7],
        },
        {
          kick: [0],
          snare: [0, 1, 2, 3],
          highTom: [4, 5],
          floorTom: [6, 7],
        },
      ),
      preset(
        'blues-128',
        'shuffle',
        'Shuffle',
        3,
        '12/8 shuffle',
        12,
        8,
        2,
        {
          kick: [0, 8, 12, 20],
          snare: [6, 18],
          closedHat: hatsCover(24, [22]),
          openHat: [22],
          crash: [0],
        },
        {
          kick: [0, 12],
          snare: [6],
          closedHat: [0, 4, 6, 10, 12],
          highTom: [10, 12],
          midTom: [14, 16],
          floorTom: [18, 20, 22],
          openHat: [22],
        },
      ),
    ],
  },
  {
    id: 'waltz',
    name: 'Waltz',
    grooves: [
      preset(
        'waltz-34',
        'waltz',
        'Waltz',
        1,
        'Oom-pah-pah',
        3,
        4,
        2,
        {
          kick: [0],
          snare: [2, 4],
          closedHat: [0, 1, 2, 3, 4],
          openHat: [5],
          ride: [0],
          crash: [0],
        },
        {
          kick: [0],
          snare: [2],
          closedHat: [0, 1],
          highTom: [3],
          midTom: [4],
          floorTom: [5],
          openHat: [5],
        },
      ),
      preset(
        'jazz-waltz-34',
        'waltz',
        'Waltz',
        2,
        'Ride 1 · 2+ · 3',
        3,
        4,
        2,
        {
          kick: [0],
          snare: [4],
          closedHat: [2],
          ride: [0, 1, 3, 4, 5],
          rim: [2],
        },
        {
          kick: [0],
          snare: [4],
          ride: [0, 3],
          highTom: [2],
          midTom: [3],
          floorTom: [5],
        },
      ),
      preset(
        'waltz-3',
        'waltz',
        'Waltz',
        3,
        'Country 3/4',
        3,
        4,
        2,
        {
          kick: [0],
          snare: [2, 4],
          floorTom: [2, 4],
          closedHat: [0, 1, 2, 3, 4],
          openHat: [5],
          ride: [0],
        },
        {
          kick: [0],
          snare: [2],
          closedHat: [0, 1],
          highTom: [3],
          midTom: [4],
          floorTom: [5],
          openHat: [5],
        },
      ),
    ],
  },
  {
    id: 'odd',
    name: 'Odd',
    grooves: [
      preset(
        'five-54',
        'odd',
        'Odd',
        1,
        '3 + 2 pocket',
        5,
        4,
        2,
        {
          kick: [0, 3, 6],
          snare: [2, 8],
          closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8],
          openHat: [9],
          crash: [0],
        },
        {
          kick: [0, 6],
          snare: [2],
          closedHat: [0, 2],
          highTom: [4],
          midTom: [6],
          floorTom: [8, 9],
          openHat: [9],
        },
      ),
      preset(
        'rock-68',
        'odd',
        'Odd',
        2,
        'Two big pulses',
        6,
        8,
        2,
        {
          kick: [0, 3, 6],
          snare: [6],
          closedHat: hatsCover(12, [10]),
          openHat: [10],
          floorTom: [3],
          crash: [0],
        },
        {
          kick: [0],
          snare: [6],
          closedHat: [0, 2, 4],
          highTom: [4, 5],
          midTom: [7, 8],
          floorTom: [9, 10, 11],
          openHat: [11],
        },
      ),
      preset(
        'odd-78',
        'odd',
        'Odd',
        3,
        '2 + 2 + 3',
        7,
        8,
        2,
        {
          kick: [0, 4, 8],
          snare: [4, 12],
          closedHat: hatsCover(14, [12]),
          openHat: [12],
          crash: [0],
        },
        {
          kick: [0, 8],
          snare: [4],
          closedHat: [0, 2, 4, 8],
          highTom: [6, 7],
          midTom: [9, 10],
          floorTom: [12, 13],
          openHat: [13],
        },
      ),
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

function hitsWithoutCrash(hits: HitMap): HitMap {
  const next = { ...hits }
  delete next.crash
  return next
}

function barFromHits(
  beats: number,
  beatUnit: BeatUnit,
  subdivision: SubdivisionId,
  hits: HitMap,
  accents?: number[],
): RhythmBar {
  return makeBar(beats, beatUnit, subdivision, patternFromHits(beats, subdivision, hits), accents)
}

function barHitsForIndex(hits: HitMap, fill: HitMap | undefined, mid: HitMap | undefined, index: number): HitMap {
  if (fill && index === LOOP_BARS - 1) return hitsWithoutCrash(fill)
  if (mid && index === 1) return hitsWithoutCrash(mid)
  const body = hitsWithoutCrash(hits)
  if (hits.crash && hits.crash.length > 0 && CRASH_BARS.includes(index)) {
    return { ...body, crash: hits.crash }
  }
  return body
}

/** 4-bar phrase. Crash only on bars 1 and 3 when the groove includes a crash. */
export function makeGrooveBars(
  beats: number,
  beatUnit: BeatUnit,
  subdivision: SubdivisionId,
  hits: HitMap,
  fill?: HitMap,
  accents?: number[],
  mid?: HitMap,
): RhythmBar[] {
  return Array.from({ length: LOOP_BARS }, (_, index) =>
    barFromHits(beats, beatUnit, subdivision, barHitsForIndex(hits, fill, mid, index), accents),
  )
}

export function barsForPreset(item: RhythmPreset): RhythmBar[] {
  return makeGrooveBars(
    item.beats,
    item.beatUnit,
    item.subdivision,
    item.hits,
    item.fill,
    item.accents,
    item.mid,
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
  return makeGrooveBars(4, 4, 4, ROCK_GROOVE, ROCK_FILL)
}

/** First-open Click: a single empty 4/4 bar (eighths), not the 4-bar Rock loop. */
export function makeDefaultClickBars(): RhythmBar[] {
  return [makeBar(4, 4, DEFAULT_SUBDIVISION)]
}
