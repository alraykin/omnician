import {
  cloneBar,
  makeBar,
  markHitsSoft,
  patternFromHits,
  patternsEqual,
  type BeatUnit,
  type Pattern,
  type RhythmBar,
  type SubdivisionId,
  type VoiceId,
} from '@/lib/rhythm'

/**
 * Practice-kit grooves grouped as styles with three beats each.
 * Patterns are original grids inspired by well-known textbook pockets
 * and the cymbal vocabulary of players like Portnoy, Gadd, Weckl,
 * Bonham, Copeland, Questlove, and Peart — not copies of recordings.
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
  | 'jazz'
  | 'waltz'
  | 'odd'

type LiveVoice = VoiceId
type LegacyVoice = LiveVoice | 'clap' | 'lowTom'
type HitMap = Partial<Record<LegacyVoice, number[]>>

function retireVoices(hits: HitMap): Partial<Record<VoiceId, number[]>> {
  const next: HitMap = { ...hits }
  if (next.clap) {
    next.snare = [...new Set([...(next.snare ?? []), ...next.clap])].sort((a, b) => a - b)
    delete next.clap
  }
  if (next.lowTom) {
    const high = new Set(next.highTom ?? [])
    const mid = new Set(next.midTom ?? [])
    const floor = new Set(next.floorTom ?? [])
    const floorMin = floor.size ? Math.min(...floor) : Number.POSITIVE_INFINITY
    for (const step of next.lowTom) {
      if (high.has(step) || mid.has(step) || floor.has(step)) continue
      if (step >= floorMin) floor.add(step)
      else mid.add(step)
    }
    if (mid.size) next.midTom = [...mid].sort((a, b) => a - b)
    if (floor.size) next.floorTom = [...floor].sort((a, b) => a - b)
    delete next.lowTom
  }
  return next as Partial<Record<VoiceId, number[]>>
}

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
  bpm?: number
  soft?: HitMap
  fillSoft?: HitMap
  midSoft?: HitMap
  /** When set, these bars are used as-is instead of the crash / mid / fill loop. */
  phrase?: HitMap[]
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
    hits: retireVoices(hits),
    fill: fill ? retireVoices(fill) : undefined,
    mid: mid ? retireVoices(mid) : undefined,
    pattern: patternFromHits(beats, subdivision, retireVoices(hits)),
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

/** Bar 8 of Backbeat — kick on 1 + and-of-2, snare on 2, hats through beat 2, open on the and-of-2 and last 16th, then Tom 1 → Tom 2 → Fl Tom. */
const ROCK_FILL: HitMap = {
  kick: [0, 7],
  snare: [4],
  closedHat: [0, 2, 4],
  openHat: [6, 15],
  highTom: [8, 9, 10],
  midTom: [11, 12],
  floorTom: [13, 14, 15],
}

const TOM_RUN: HitMap = {
  highTom: [8, 9],
  midTom: [10],
  lowTom: [11, 12],
  floorTom: [13, 14, 15],
}

const QUARTER_HATS = [0, 4, 8, 12]
const CHAMELEON_KICK = [0, 7, 8, 10, 12]
const CHAMELEON_SNARE = [4, 12]

const CHAMELEON_GROOVE: HitMap = {
  kick: CHAMELEON_KICK,
  snare: CHAMELEON_SNARE,
  closedHat: QUARTER_HATS,
}

/** Bar 4 of Chameleon — pocket plus extra kicks on 2 and the e of 4. */
const CHAMELEON_BAR4: HitMap = {
  kick: [0, 4, 7, 8, 10, 12, 13],
  snare: CHAMELEON_SNARE,
  closedHat: QUARTER_HATS,
}

/** Bar 8 of Chameleon — pocket into snare 16ths, then Tom 1 → Tom 2 → Fl Tom. */
const CHAMELEON_FILL: HitMap = {
  kick: [0, 7, 8, 9, 10],
  snare: [4, 8, 9, 10, 11],
  closedHat: [0, 4, 8],
  highTom: [12, 13],
  midTom: [14],
  floorTom: [15],
}

const CHAMELEON_PHRASE: HitMap[] = [
  { ...CHAMELEON_GROOVE, crash: [0] },
  CHAMELEON_GROOVE,
  CHAMELEON_GROOVE,
  CHAMELEON_BAR4,
  { ...CHAMELEON_GROOVE, splash: [0] },
  CHAMELEON_GROOVE,
  CHAMELEON_GROOVE,
  CHAMELEON_FILL,
]

export const RHYTHM_STYLES: RhythmStyle[] = [
  {
    id: 'rock',
    name: 'Rock',
    grooves: [
      {
        ...preset('rock-44', 'rock', 'Rock', 1, 'Classic backbeat, open and-of-4', 4, 4, 4, ROCK_GROOVE, ROCK_FILL, {
          kick: [0, 7, 8, 10],
          snare: [4, 12, 15],
          closedHat: ROCK_EIGHTH_HATS,
          openHat: [14],
        }),
        name: 'Backbeat',
        bpm: 88,
        midSoft: { snare: [15] },
      },
      preset(
        'punk-44',
        'rock',
        'Rock',
        2,
        'Bonham-style driving 8ths',
        4,
        4,
        4,
        {
          kick: HATS_8_16,
          snare: [4, 12],
          closedHat: hatsExcept([6, 14]),
          openHat: [6, 14],
          crash: [0],
          splash: [14],
        },
        {
          kick: [0, 2, 4, 6, 8],
          snare: [4],
          closedHat: [0, 2, 4],
          openHat: [15],
          splash: [15],
          ...TOM_RUN,
        },
      ),
      preset(
        'halftime-44',
        'rock',
        'Rock',
        3,
        'Peart-style half-time + ride bell',
        4,
        4,
        4,
        {
          kick: [0, 6, 10, 14],
          snare: [8],
          closedHat: hatsExcept([14]),
          openHat: [14],
          ride: [0, 4, 8, 12],
          rideBell: [4, 12],
          lowTom: [12],
          floorTom: [4],
          crash: [0],
        },
        {
          kick: [0, 6],
          snare: [8],
          closedHat: [0, 2],
          openHat: [15],
          rideBell: [4],
          highTom: [4, 5],
          midTom: [6, 7],
          lowTom: [9, 10, 11],
          floorTom: [12, 13, 14, 15],
        },
      ),
    ],
  },
  {
    id: 'funk',
    name: 'Funk',
    grooves: [
      {
        ...preset(
          'funk-44',
          'funk',
          'Funk',
          1,
          '16th-note pocket, splash on 5',
          4,
          4,
          4,
          { ...CHAMELEON_GROOVE, crash: [0] },
          CHAMELEON_FILL,
        ),
        name: 'Chameleon',
        bpm: 90,
        phrase: CHAMELEON_PHRASE,
      },
      {
        ...preset(
          'funk-2',
          'funk',
          'Funk',
          2,
          'Weckl linear pocket + catch',
          4,
          4,
          4,
          {
            kick: [0, 6, 8, 13],
            snare: [4, 12],
            rim: [2, 7, 11, 15],
            closedHat: hatsExcept([6, 14]),
            openHat: [6, 14],
            stack: [8],
          },
          {
            kick: [0, 6, 8],
            snare: [4],
            closedHat: [0, 2, 4, 6],
            openHat: [15],
            stack: [8],
            highTom: [9, 10],
            midTom: [11],
            lowTom: [12],
            floorTom: [13, 14],
          },
        ),
        soft: { rim: [2, 7, 11, 15] },
      },
      {
        ...preset(
          'funk-3',
          'funk',
          'Funk',
          3,
          'The One, splash lift',
          4,
          4,
          4,
          {
            kick: [0, 7, 10],
            snare: [4, 12],
            rim: [2, 6, 11, 13, 14],
            closedHat: hatsExcept([2, 14]),
            openHat: [2, 14],
            splash: [14],
          },
          {
            kick: [0, 10],
            snare: [4],
            rim: [6, 7],
            closedHat: [0, 2, 4],
            openHat: [15],
            splash: [15],
            ...TOM_RUN,
          },
        ),
        soft: { rim: [2, 6, 11, 13, 14] },
      },
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
        'Portnoy gallop + china',
        4,
        4,
        4,
        {
          kick: [0, 2, 3, 8, 10, 11],
          snare: [4, 12],
          closedHat: hatsExcept([14]),
          openHat: [14],
          rideBell: [4, 12],
          china: [0],
          crash: [0],
        },
        {
          kick: [0, 2, 3, 8],
          snare: [4, 12],
          closedHat: [0, 2, 4, 6],
          china: [0],
          ...TOM_RUN,
        },
      ),
      preset(
        'metal-2',
        'metal',
        'Metal',
        2,
        'Portnoy double-kick + chokes',
        4,
        4,
        4,
        {
          kick: [0, 1, 2, 3, 8, 9, 10, 11, 14],
          snare: [4, 12],
          closedHat: hatsExcept([6, 14]),
          stack: [8],
          china: [0],
          crash: [0, 6, 14],
        },
        {
          kick: [0, 1, 2, 3, 8, 9],
          snare: [4, 12],
          closedHat: [0, 2, 4, 6, 8],
          crash: [6],
          stack: [8],
          midTom: [10],
          lowTom: [11, 12],
          floorTom: [13, 14, 15],
        },
      ),
      preset(
        'metal-3',
        'metal',
        'Metal',
        3,
        'Driving 8ths, china + ride',
        4,
        4,
        4,
        {
          kick: [0, 2, 4, 6, 7, 8, 10, 12, 14],
          snare: [4, 12],
          closedHat: hatsExcept([6, 14]),
          openHat: [6, 14],
          ride: [4, 12],
          china: [0],
          floorTom: [10],
          crash: [0],
        },
        {
          kick: [0, 8],
          snare: [4],
          closedHat: [0, 2, 4],
          china: [0],
          highTom: [6, 7],
          midTom: [8, 9],
          lowTom: [10, 11],
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
        'Copeland ands + splash',
        4,
        4,
        4,
        {
          kick: [0, 6, 8, 14],
          snare: [4, 12],
          clap: [4, 12],
          closedHat: hatsExcept([14]),
          openHat: [14],
          splash: [14],
          crash: [0],
        },
        {
          kick: [0, 6, 8],
          snare: [4, 12],
          closedHat: [0, 2, 4, 6, 8],
          openHat: [15],
          splash: [15],
          highTom: [10],
          midTom: [11],
          lowTom: [12, 13],
          floorTom: [14],
        },
      ),
      preset(
        'motown-44',
        'pop',
        'Pop',
        2,
        'Snare on all four + bell',
        4,
        4,
        4,
        {
          kick: [0, 6, 8, 14],
          snare: [0, 4, 8, 12],
          closedHat: hatsExcept([6, 14]),
          openHat: [6, 14],
          rideBell: [0, 8],
        },
        {
          kick: [0, 8],
          snare: [0, 4, 8],
          closedHat: [0, 2, 4, 6, 8],
          openHat: [15],
          rideBell: [0],
          highTom: [10],
          midTom: [11],
          lowTom: [12],
          floorTom: [14, 15],
        },
      ),
      preset(
        'pop-3',
        'pop',
        'Pop',
        3,
        'Four-on-the-floor + catch',
        4,
        4,
        4,
        {
          kick: [0, 4, 8, 12],
          snare: [4, 12],
          clap: [4, 12],
          closedHat: hatsExcept([2, 6, 10, 14]),
          openHat: [2, 6, 10, 14],
          stack: [8],
        },
        {
          kick: [0, 4, 8, 12],
          clap: [4, 12],
          closedHat: [0, 4, 8],
          openHat: [15],
          stack: [8],
          highTom: [9],
          midTom: [10],
          lowTom: [11, 12],
          floorTom: [13, 14],
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
        'Questlove boom-bap rim',
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
          openHat: [15],
          highTom: [8, 9],
          midTom: [10],
          lowTom: [11],
          floorTom: [13, 14],
        },
      ),
      preset(
        'trap-44',
        'hiphop',
        'Hip-hop',
        2,
        'Snare on three + catch',
        4,
        4,
        4,
        {
          kick: [0, 3, 8, 11, 14],
          snare: [8],
          clap: [8],
          closedHat: hatsExcept([12]),
          openHat: [12],
          stack: [4, 12],
        },
        {
          kick: [0, 3, 8],
          snare: [8],
          closedHat: [0, 2, 4, 6, 8],
          openHat: [15],
          stack: [12],
          highTom: [10],
          midTom: [11],
          lowTom: [12, 13],
          floorTom: [14, 15],
        },
      ),
      preset(
        'hiphop-3',
        'hiphop',
        'Hip-hop',
        3,
        'Bounce pocket + splash',
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
          splash: [14],
        },
        {
          kick: [0, 3, 8],
          snare: [4, 12],
          rim: [6],
          closedHat: [0, 2, 4, 8],
          openHat: [15],
          splash: [15],
          highTom: [9],
          midTom: [10],
          lowTom: [11],
          floorTom: [13, 14, 15],
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
        'Offbeat opens + splash',
        4,
        4,
        4,
        {
          kick: [0, 4, 8, 12],
          clap: [4, 12],
          closedHat: hatsExcept([2, 6, 10, 14]),
          openHat: [2, 6, 10, 14],
          splash: [14],
        },
        {
          kick: [0, 4, 8, 12],
          clap: [4, 12],
          closedHat: [0, 4, 8],
          openHat: [2, 6, 10, 15],
          splash: [15],
          highTom: [9],
          midTom: [11],
          lowTom: [13],
          floorTom: [14],
        },
      ),
      preset(
        'disco-44',
        'house',
        'House',
        2,
        'Four on the floor + ride',
        4,
        4,
        4,
        {
          kick: [0, 4, 8, 12],
          snare: [4, 12],
          clap: [4, 12],
          closedHat: hatsExcept([2, 6, 10, 14]),
          openHat: [2, 6, 10, 14],
          ride: [0, 8],
        },
        {
          kick: [0, 4, 8, 12],
          snare: [4, 12],
          clap: [4, 12],
          closedHat: [0, 4, 8],
          openHat: [15],
          ride: [0],
          highTom: [10],
          midTom: [11],
          lowTom: [12],
          floorTom: [14],
        },
      ),
      preset(
        'house-3',
        'house',
        'House',
        3,
        'Tech 16ths + catch',
        4,
        4,
        4,
        {
          kick: [0, 4, 8, 12],
          clap: [4, 12],
          closedHat: hatsExcept([2, 6, 14]),
          openHat: [2, 6, 14],
          stack: [8],
        },
        {
          kick: [0, 4, 8, 12],
          clap: [4, 12],
          closedHat: [0, 2, 4, 8],
          openHat: [6, 15],
          stack: [8],
          highTom: [9, 10],
          midTom: [13],
          lowTom: [14],
          floorTom: [15],
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
        'Rim clave + ride bell',
        4,
        4,
        4,
        {
          kick: [0, 3, 8, 11],
          rim: [4, 7, 12, 14],
          closedHat: [4, 12],
          ride: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
          rideBell: [0, 8],
          openHat: [14],
        },
        {
          kick: [0, 3, 8],
          rim: [4, 7],
          ride: [0, 2, 4, 6, 8],
          rideBell: [0],
          highTom: [10],
          midTom: [11],
          lowTom: [12, 13],
          floorTom: [14, 15],
        },
      ),
      preset(
        'reggae-44',
        'latin',
        'Latin',
        2,
        'Copeland one-drop + splash',
        4,
        4,
        4,
        {
          kick: [8],
          snare: [8],
          rim: [4, 12],
          closedHat: hatsExcept([14]),
          openHat: [14],
          splash: [14],
        },
        {
          kick: [8],
          snare: [8],
          rim: [4, 12],
          closedHat: [0, 2, 4, 6, 8],
          openHat: [15],
          splash: [15],
          highTom: [10],
          midTom: [11],
          lowTom: [12],
          floorTom: [14, 15],
        },
      ),
      preset(
        'latin-3',
        'latin',
        'Latin',
        3,
        'Samba pulse + four toms',
        4,
        4,
        4,
        {
          kick: [0, 7, 8, 15],
          rim: [2, 6, 10, 14],
          closedHat: hatsExcept([14]),
          floorTom: [0, 8],
          ride: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
          rideBell: [3, 11],
          openHat: [14],
        },
        {
          kick: [0, 7, 8],
          rim: [2, 6, 10],
          ride: [0, 2, 4, 6, 8],
          highTom: [9, 10],
          midTom: [11],
          lowTom: [12, 13],
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
        'Swing triplets + ride bell',
        4,
        4,
        3,
        {
          kick: [0, 5, 6],
          snare: [3, 9],
          rim: [2, 8],
          closedHat: [0, 2, 3, 5, 6, 8, 9],
          openHat: [11],
          rideBell: [0, 6],
          crash: [0],
        },
        {
          kick: [0],
          snare: [3],
          closedHat: [0, 2, 3],
          openHat: [11],
          rideBell: [0],
          highTom: [5],
          midTom: [6],
          lowTom: [7, 8],
          floorTom: [9, 10, 11],
        },
      ),
      preset(
        'train-24',
        'shuffle',
        'Shuffle',
        2,
        'Country train 8ths',
        4,
        4,
        2,
        {
          kick: [0, 4],
          snare: [0, 1, 2, 3, 4, 5, 6, 7],
          closedHat: [0, 1, 2, 3, 4, 5, 6],
          openHat: [7],
          rideBell: [0, 4],
        },
        {
          kick: [0],
          snare: [0, 1, 2, 3],
          rideBell: [0],
          highTom: [4],
          midTom: [5],
          lowTom: [6],
          floorTom: [7],
        },
      ),
      preset(
        'blues-128',
        'shuffle',
        'Shuffle',
        3,
        '12/8 shuffle + china lift',
        12,
        8,
        2,
        {
          kick: [0, 8, 12, 20],
          snare: [6, 18],
          closedHat: hatsCover(24, [22]),
          openHat: [22],
          china: [0],
          crash: [0],
        },
        {
          kick: [0, 12],
          snare: [6],
          closedHat: [0, 4, 6, 10, 12],
          openHat: [22],
          china: [0],
          highTom: [10, 12],
          midTom: [14],
          lowTom: [16],
          floorTom: [18, 20, 22],
        },
      ),
    ],
  },
  {
    id: 'jazz',
    name: 'Jazz',
    grooves: [
      preset(
        'jazz-44',
        'jazz',
        'Jazz',
        1,
        'Ride swing ding-ding-a-ding',
        4,
        4,
        3,
        {
          kick: [0],
          snare: [3, 9],
          rim: [2, 5, 8, 11],
          ride: [0, 2, 3, 5, 6, 8, 9, 11],
          rideBell: [0, 6],
        },
        {
          kick: [0],
          snare: [3],
          ride: [0, 2, 3, 5],
          rideBell: [0],
          highTom: [6],
          midTom: [7, 8],
          floorTom: [9, 10, 11],
        },
      ),
      preset(
        'jazz-2feel',
        'jazz',
        'Jazz',
        2,
        'Two-feel, feathered bass',
        4,
        4,
        3,
        {
          kick: [0],
          snare: [9],
          rim: [3, 5, 11],
          ride: [0, 2, 3, 5, 6, 8, 9, 11],
        },
        {
          kick: [0],
          snare: [9],
          ride: [0, 2, 3],
          highTom: [5, 6],
          midTom: [7],
          floorTom: [8, 9, 10, 11],
        },
      ),
      preset(
        'jazz-bop',
        'jazz',
        'Jazz',
        3,
        'Uptempo comps + crash lift',
        4,
        4,
        3,
        {
          kick: [0, 8],
          snare: [3, 9],
          rim: [1, 2, 5, 7, 8, 11],
          ride: [0, 2, 3, 5, 6, 8, 9, 11],
          rideBell: [3, 9],
          crash: [0],
        },
        {
          kick: [0, 8],
          snare: [3, 9],
          ride: [0, 2, 3, 5],
          crash: [0],
          highTom: [6],
          midTom: [7, 8],
          floorTom: [9, 10, 11],
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
        'Oom-pah-pah + splash',
        3,
        4,
        2,
        {
          kick: [0],
          snare: [2, 4],
          closedHat: [0, 1, 2, 3, 4],
          openHat: [5],
          ride: [0],
          splash: [5],
          crash: [0],
        },
        {
          kick: [0],
          snare: [2],
          closedHat: [0, 1],
          openHat: [5],
          splash: [5],
          highTom: [3],
          midTom: [4],
          floorTom: [5],
        },
      ),
      preset(
        'jazz-waltz-34',
        'waltz',
        'Waltz',
        2,
        'Jazz ride 1 · 2+ · 3 + bell',
        3,
        4,
        2,
        {
          kick: [0],
          snare: [4],
          closedHat: [2],
          ride: [0, 1, 3, 4, 5],
          rideBell: [0, 4],
          rim: [2],
        },
        {
          kick: [0],
          snare: [4],
          ride: [0, 3],
          rideBell: [0],
          highTom: [2],
          midTom: [3],
          lowTom: [4],
          floorTom: [5],
        },
      ),
      preset(
        'waltz-3',
        'waltz',
        'Waltz',
        3,
        'Country 3/4 + floor',
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
          openHat: [5],
          highTom: [3],
          midTom: [4],
          lowTom: [4],
          floorTom: [5],
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
        'Portnoy 3 + 2 + china',
        5,
        4,
        2,
        {
          kick: [0, 3, 6],
          snare: [2, 8],
          closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8],
          openHat: [9],
          china: [0],
          rideBell: [2, 8],
          crash: [0],
        },
        {
          kick: [0, 6],
          snare: [2],
          closedHat: [0, 2],
          openHat: [9],
          china: [0],
          highTom: [4],
          midTom: [5],
          lowTom: [6, 7],
          floorTom: [8, 9],
        },
      ),
      preset(
        'rock-68',
        'odd',
        'Odd',
        2,
        'Two big pulses + catch',
        6,
        8,
        2,
        {
          kick: [0, 3, 6],
          snare: [6],
          closedHat: hatsCover(12, [10]),
          openHat: [10],
          floorTom: [3],
          stack: [0, 6],
          crash: [0],
        },
        {
          kick: [0],
          snare: [6],
          closedHat: [0, 2, 4],
          openHat: [11],
          stack: [0],
          highTom: [4, 5],
          midTom: [7],
          lowTom: [8],
          floorTom: [9, 10, 11],
        },
      ),
      preset(
        'odd-78',
        'odd',
        'Odd',
        3,
        'Portnoy 2 + 2 + 3 + china',
        7,
        8,
        2,
        {
          kick: [0, 4, 8],
          snare: [4, 12],
          closedHat: hatsCover(14, [12]),
          openHat: [12],
          china: [0],
          rideBell: [4, 8],
          crash: [0],
        },
        {
          kick: [0, 8],
          snare: [4],
          closedHat: [0, 2, 4, 8],
          openHat: [13],
          china: [0],
          highTom: [6],
          midTom: [7],
          lowTom: [9, 10],
          floorTom: [12, 13],
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

const LOOP_BARS = 8
const CRASH_EVERY = 4

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
  soft?: HitMap,
): RhythmBar {
  let pattern: Pattern = patternFromHits(beats, subdivision, hits)
  if (soft) pattern = markHitsSoft(pattern, beats, subdivision, retireVoices(soft))
  return makeBar(beats, beatUnit, subdivision, pattern, accents)
}

function softForIndex(
  item: Pick<RhythmPreset, 'soft' | 'fillSoft' | 'midSoft' | 'fill' | 'mid'>,
  index: number,
): HitMap | undefined {
  if (item.fill && index === LOOP_BARS - 1) return item.fillSoft
  if (item.mid && index % CRASH_EVERY === 1) return item.midSoft
  return item.soft
}

function barHitsForIndex(hits: HitMap, fill: HitMap | undefined, mid: HitMap | undefined, index: number): HitMap {
  if (fill && index === LOOP_BARS - 1) return hitsWithoutCrash(fill)
  if (mid && index % CRASH_EVERY === 1) return hitsWithoutCrash(mid)
  const body = hitsWithoutCrash(hits)
  if (index % CRASH_EVERY === 0) {
    return { ...body, crash: hits.crash && hits.crash.length > 0 ? hits.crash : [0] }
  }
  return body
}

/** 8-bar phrase. Crash on beat 1 every 4 bars; fill lands on bar 8. */
export function makeGrooveBars(
  beats: number,
  beatUnit: BeatUnit,
  subdivision: SubdivisionId,
  hits: HitMap,
  fill?: HitMap,
  accents?: number[],
  mid?: HitMap,
  soft?: HitMap,
  fillSoft?: HitMap,
  midSoft?: HitMap,
): RhythmBar[] {
  return Array.from({ length: LOOP_BARS }, (_, index) =>
    barFromHits(
      beats,
      beatUnit,
      subdivision,
      barHitsForIndex(hits, fill, mid, index),
      accents,
      softForIndex({ soft, fillSoft, midSoft, fill, mid }, index),
    ),
  )
}

export function barsForPreset(item: RhythmPreset): RhythmBar[] {
  if (item.phrase?.length) {
    return item.phrase.map((hits) =>
      barFromHits(item.beats, item.beatUnit, item.subdivision, retireVoices(hits), item.accents),
    )
  }
  return makeGrooveBars(
    item.beats,
    item.beatUnit,
    item.subdivision,
    item.hits,
    item.fill,
    item.accents,
    item.mid,
    item.soft,
    item.fillSoft,
    item.midSoft,
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

/** First-open Rock: 8 bars, Crash on 1 and 5, tom fill on 8. */
export function makeDefaultRockBars(): RhythmBar[] {
  return makeGrooveBars(4, 4, 4, ROCK_GROOVE, ROCK_FILL)
}

/** First-open Click: a single empty 4/4 bar (quarters). */
export function makeDefaultClickBars(): RhythmBar[] {
  return [makeBar(4, 4, 1)]
}
