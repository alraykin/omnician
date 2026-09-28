import { stepsPerBeat, type HitPos, type SubdivisionId } from '@/lib/rhythm'
import type { RhythmStyleId } from '@/lib/rhythm-presets'

export const KIT_INTENSITIES = [1, 2, 3, 4, 5] as const
export type KitIntensity = (typeof KIT_INTENSITIES)[number]
export const DEFAULT_KIT_INTENSITY: KitIntensity = 4
export const DEFAULT_INTENSITY_STYLE: RhythmStyleId = 'rock'

export type HitRole = 'backbeat' | 'ghost' | 'normal'

export type Timekeeper = 'hats' | 'ride' | 'both'

/** How this style plays at one numbered intensity — character, not volume. */
export type IntensityCharacter = {
  name: string
  blurb: string
  /** Crocell layer for kicks, backbeats, toms, crashes. */
  accentTier: KitIntensity
  ghostTier: KitIntensity
  hatTier: KitIntensity
  /** 0 even playing → 1 strong accent vs ghost contrast. */
  dynamics: number
  /** 0 close every open hat → 1 keep written → 2 extra opens. */
  hatOpenness: number
  /** 0 eighths/downbeats only → 1 as written → 2 fill empty 16ths. */
  hatDensity: number
  /** 0 drop ghosts/comps → 1 keep → 2 extra 16th ghosts. */
  ghostDensity: number
  /** 0 on-beat kicks only → 1 keep → 1.2 extra pickups. */
  kickDensity: number
  timekeeper: Timekeeper
  /** 0 mute crash/china/splash → 1 keep written → 2 extra china/splash. */
  cymbalExtra: number
  /** 0 strip toms → 0.5 thin fill → 1 keep written fills. */
  fillAmount: number
  /** High-shelf dB at ~3.8 kHz (kit brightness). */
  brightnessDb: number
  rimshotBackbeat: boolean
  sideStickBackbeat: boolean
}

export type StyleIntensityProfile = {
  styleId: RhythmStyleId
  levels: KitIntensity[]
  defaultLevel: KitIntensity
  characters: Record<number, IntensityCharacter>
}

function ch(partial: IntensityCharacter): IntensityCharacter {
  return partial
}

const ROCK: StyleIntensityProfile = {
  styleId: 'rock',
  levels: [1, 2, 3, 4, 5],
  defaultLevel: 4,
  characters: {
    1: ch({
      name: 'Light',
      blurb: 'Laid-back 8ths, closed hats, no crash or fill',
      accentTier: 2,
      ghostTier: 1,
      hatTier: 2,
      dynamics: 0.88,
      hatOpenness: 0,
      hatDensity: 0,
      ghostDensity: 0,
      kickDensity: 0.5,
      timekeeper: 'hats',
      cymbalExtra: 0,
      fillAmount: 0,
      brightnessDb: -2.8,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    2: ch({
      name: 'Pocket',
      blurb: '8th hats, light ghosts, phrase crash only',
      accentTier: 3,
      ghostTier: 1,
      hatTier: 3,
      dynamics: 0.72,
      hatOpenness: 0.4,
      hatDensity: 0.4,
      ghostDensity: 0.35,
      kickDensity: 0.75,
      timekeeper: 'hats',
      cymbalExtra: 0.4,
      fillAmount: 0,
      brightnessDb: -1.4,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    3: ch({
      name: 'Driving',
      blurb: 'Written hats and opens, light fill, no rimshot',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 3,
      dynamics: 0.55,
      hatOpenness: 1,
      hatDensity: 1,
      ghostDensity: 0.75,
      kickDensity: 1,
      timekeeper: 'hats',
      cymbalExtra: 1,
      fillAmount: 0.45,
      brightnessDb: -0.3,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    4: ch({
      name: 'Full',
      blurb: 'Rimshot backbeats, crashes, full tom fill',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 4,
      dynamics: 0.42,
      hatOpenness: 1,
      hatDensity: 1,
      ghostDensity: 1,
      kickDensity: 1,
      timekeeper: 'hats',
      cymbalExtra: 1,
      fillAmount: 1,
      brightnessDb: 0.7,
      rimshotBackbeat: true,
      sideStickBackbeat: false,
    }),
    5: ch({
      name: 'Stadium',
      blurb: '16th hats, extra opens, china/splash, bright kit',
      accentTier: 5,
      ghostTier: 3,
      hatTier: 5,
      dynamics: 0.22,
      hatOpenness: 1.7,
      hatDensity: 2,
      ghostDensity: 1.65,
      kickDensity: 1.2,
      timekeeper: 'hats',
      cymbalExtra: 2,
      fillAmount: 1,
      brightnessDb: 2.5,
      rimshotBackbeat: true,
      sideStickBackbeat: false,
    }),
  },
}

const FUNK: StyleIntensityProfile = {
  styleId: 'funk',
  levels: [1, 2, 3, 4, 5],
  defaultLevel: 3,
  characters: {
    1: ch({
      name: 'Dry',
      blurb: 'Tight closed hats, almost no ghosts, no fill',
      accentTier: 3,
      ghostTier: 1,
      hatTier: 2,
      dynamics: 0.9,
      hatOpenness: 0,
      hatDensity: 0.35,
      ghostDensity: 0,
      kickDensity: 0.7,
      timekeeper: 'hats',
      cymbalExtra: 0,
      fillAmount: 0,
      brightnessDb: -2.2,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    2: ch({
      name: 'Chick',
      blurb: 'Light rim ghosts, 8th hats, one open lift',
      accentTier: 3,
      ghostTier: 1,
      hatTier: 3,
      dynamics: 0.75,
      hatOpenness: 0.45,
      hatDensity: 0.5,
      ghostDensity: 0.45,
      kickDensity: 0.85,
      timekeeper: 'hats',
      cymbalExtra: 0.3,
      fillAmount: 0,
      brightnessDb: -1.1,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    3: ch({
      name: 'Pocket',
      blurb: 'Classic ghosted 16ths and written opens',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 3,
      dynamics: 0.62,
      hatOpenness: 1,
      hatDensity: 1,
      ghostDensity: 1,
      kickDensity: 1,
      timekeeper: 'hats',
      cymbalExtra: 1,
      fillAmount: 0.4,
      brightnessDb: 0,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    4: ch({
      name: 'Talk',
      blurb: 'Busier ghosts, more hat opens, light fill',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 4,
      dynamics: 0.48,
      hatOpenness: 1.45,
      hatDensity: 1.35,
      ghostDensity: 1.55,
      kickDensity: 1,
      timekeeper: 'hats',
      cymbalExtra: 1.4,
      fillAmount: 0.7,
      brightnessDb: 1.1,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    5: ch({
      name: 'On-the-one',
      blurb: 'Linear 16ths, splash, rimshot backbeat, full fill',
      accentTier: 5,
      ghostTier: 3,
      hatTier: 5,
      dynamics: 0.3,
      hatOpenness: 1.8,
      hatDensity: 2,
      ghostDensity: 2,
      kickDensity: 1.15,
      timekeeper: 'hats',
      cymbalExtra: 2,
      fillAmount: 1,
      brightnessDb: 2.2,
      rimshotBackbeat: true,
      sideStickBackbeat: false,
    }),
  },
}

const METAL: StyleIntensityProfile = {
  styleId: 'metal',
  levels: [1, 2, 3, 4],
  defaultLevel: 3,
  characters: {
    1: ch({
      name: 'Tight',
      blurb: 'Closed hats, no china, no fill — still punchy',
      accentTier: 3,
      ghostTier: 2,
      hatTier: 3,
      dynamics: 0.4,
      hatOpenness: 0,
      hatDensity: 0.5,
      ghostDensity: 0,
      kickDensity: 0.85,
      timekeeper: 'hats',
      cymbalExtra: 0.35,
      fillAmount: 0,
      brightnessDb: -0.6,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    2: ch({
      name: 'Drive',
      blurb: 'Driving hats, phrase crash, light fill, no china',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 4,
      dynamics: 0.32,
      hatOpenness: 0.5,
      hatDensity: 1,
      ghostDensity: 0.2,
      kickDensity: 1,
      timekeeper: 'hats',
      cymbalExtra: 0.7,
      fillAmount: 0.5,
      brightnessDb: 0.5,
      rimshotBackbeat: true,
      sideStickBackbeat: false,
    }),
    3: ch({
      name: 'Heavy',
      blurb: 'China + crash, gallop kicks, full fill, rimshot',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 4,
      dynamics: 0.22,
      hatOpenness: 1,
      hatDensity: 1,
      ghostDensity: 0.4,
      kickDensity: 1,
      timekeeper: 'both',
      cymbalExtra: 1,
      fillAmount: 1,
      brightnessDb: 1.4,
      rimshotBackbeat: true,
      sideStickBackbeat: false,
    }),
    4: ch({
      name: 'Chaos',
      blurb: '16th hats, extra china/splash, pickup kicks, bright',
      accentTier: 5,
      ghostTier: 3,
      hatTier: 5,
      dynamics: 0.12,
      hatOpenness: 1.35,
      hatDensity: 2,
      ghostDensity: 0.7,
      kickDensity: 1.25,
      timekeeper: 'both',
      cymbalExtra: 2,
      fillAmount: 1,
      brightnessDb: 2.8,
      rimshotBackbeat: true,
      sideStickBackbeat: false,
    }),
  },
}

const POP: StyleIntensityProfile = {
  styleId: 'pop',
  levels: [1, 2, 3, 4],
  defaultLevel: 3,
  characters: {
    1: ch({
      name: 'Verse',
      blurb: 'Soft 8ths, no crash or fill',
      accentTier: 2,
      ghostTier: 1,
      hatTier: 2,
      dynamics: 0.7,
      hatOpenness: 0,
      hatDensity: 0,
      ghostDensity: 0,
      kickDensity: 0.65,
      timekeeper: 'hats',
      cymbalExtra: 0,
      fillAmount: 0,
      brightnessDb: -2.4,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    2: ch({
      name: 'Pre',
      blurb: 'Written opens, phrase crash, no fill',
      accentTier: 3,
      ghostTier: 1,
      hatTier: 3,
      dynamics: 0.55,
      hatOpenness: 0.7,
      hatDensity: 0.7,
      ghostDensity: 0.4,
      kickDensity: 0.9,
      timekeeper: 'hats',
      cymbalExtra: 0.45,
      fillAmount: 0,
      brightnessDb: -0.8,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    3: ch({
      name: 'Chorus',
      blurb: 'Full pop groove, splash lifts, light fill',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 4,
      dynamics: 0.4,
      hatOpenness: 1,
      hatDensity: 1,
      ghostDensity: 0.8,
      kickDensity: 1,
      timekeeper: 'hats',
      cymbalExtra: 1,
      fillAmount: 0.65,
      brightnessDb: 0.6,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    4: ch({
      name: 'Anthem',
      blurb: 'Extra crashes, splash, full fill, brighter kit',
      accentTier: 5,
      ghostTier: 3,
      hatTier: 5,
      dynamics: 0.22,
      hatOpenness: 1.6,
      hatDensity: 1.7,
      ghostDensity: 1.2,
      kickDensity: 1.15,
      timekeeper: 'hats',
      cymbalExtra: 2,
      fillAmount: 1,
      brightnessDb: 2.3,
      rimshotBackbeat: true,
      sideStickBackbeat: false,
    }),
  },
}

const HIPHOP: StyleIntensityProfile = {
  styleId: 'hiphop',
  levels: [1, 2, 3, 4, 5],
  defaultLevel: 3,
  characters: {
    1: ch({
      name: 'Sparse',
      blurb: 'Boom-bap skeleton, sidestick 2 and 4, 8th hats',
      accentTier: 3,
      ghostTier: 1,
      hatTier: 2,
      dynamics: 0.85,
      hatOpenness: 0,
      hatDensity: 0,
      ghostDensity: 0,
      kickDensity: 0.6,
      timekeeper: 'hats',
      cymbalExtra: 0,
      fillAmount: 0,
      brightnessDb: -2.6,
      rimshotBackbeat: false,
      sideStickBackbeat: true,
    }),
    2: ch({
      name: 'Boom-bap',
      blurb: 'Light rim comps, 8ths, no fill',
      accentTier: 3,
      ghostTier: 1,
      hatTier: 3,
      dynamics: 0.7,
      hatOpenness: 0.4,
      hatDensity: 0.45,
      ghostDensity: 0.5,
      kickDensity: 0.85,
      timekeeper: 'hats',
      cymbalExtra: 0.25,
      fillAmount: 0,
      brightnessDb: -1.2,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    3: ch({
      name: 'Pocket',
      blurb: 'Written rims, open-hat lift, light fill',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 3,
      dynamics: 0.55,
      hatOpenness: 1,
      hatDensity: 1,
      ghostDensity: 1,
      kickDensity: 1,
      timekeeper: 'hats',
      cymbalExtra: 1,
      fillAmount: 0.45,
      brightnessDb: 0,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    4: ch({
      name: 'Busy',
      blurb: 'Extra 16th hats and ghosts',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 4,
      dynamics: 0.4,
      hatOpenness: 1.3,
      hatDensity: 1.7,
      ghostDensity: 1.55,
      kickDensity: 1,
      timekeeper: 'hats',
      cymbalExtra: 1.25,
      fillAmount: 0.75,
      brightnessDb: 1.0,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    5: ch({
      name: 'Bounce',
      blurb: 'Trap-busy hats, stack/splash, full fill, bright',
      accentTier: 5,
      ghostTier: 3,
      hatTier: 5,
      dynamics: 0.25,
      hatOpenness: 1.75,
      hatDensity: 2,
      ghostDensity: 1.8,
      kickDensity: 1.15,
      timekeeper: 'hats',
      cymbalExtra: 2,
      fillAmount: 1,
      brightnessDb: 2.1,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
  },
}

const HOUSE: StyleIntensityProfile = {
  styleId: 'house',
  levels: [1, 2, 3],
  defaultLevel: 2,
  characters: {
    1: ch({
      name: 'Dry',
      blurb: 'Four-on-the-floor, closed 8ths, no offbeat opens',
      accentTier: 3,
      ghostTier: 2,
      hatTier: 3,
      dynamics: 0.35,
      hatOpenness: 0,
      hatDensity: 0,
      ghostDensity: 0,
      kickDensity: 1,
      timekeeper: 'hats',
      cymbalExtra: 0,
      fillAmount: 0,
      brightnessDb: -1.6,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    2: ch({
      name: 'Club',
      blurb: 'Offbeat open hats as written',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 4,
      dynamics: 0.28,
      hatOpenness: 1,
      hatDensity: 1,
      ghostDensity: 0.3,
      kickDensity: 1,
      timekeeper: 'hats',
      cymbalExtra: 1,
      fillAmount: 0.4,
      brightnessDb: 0.4,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    3: ch({
      name: 'Peak',
      blurb: '16th hats, splash/stack, phrase crash, brighter',
      accentTier: 5,
      ghostTier: 3,
      hatTier: 5,
      dynamics: 0.18,
      hatOpenness: 1.5,
      hatDensity: 2,
      ghostDensity: 0.6,
      kickDensity: 1,
      timekeeper: 'both',
      cymbalExtra: 2,
      fillAmount: 1,
      brightnessDb: 2.0,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
  },
}

const LATIN: StyleIntensityProfile = {
  styleId: 'latin',
  levels: [1, 2, 3, 4],
  defaultLevel: 3,
  characters: {
    1: ch({
      name: 'Soft',
      blurb: 'Sparse ride, no bell or fill',
      accentTier: 2,
      ghostTier: 1,
      hatTier: 2,
      dynamics: 0.75,
      hatOpenness: 0,
      hatDensity: 0.3,
      ghostDensity: 0.4,
      kickDensity: 0.55,
      timekeeper: 'ride',
      cymbalExtra: 0,
      fillAmount: 0,
      brightnessDb: -2.5,
      rimshotBackbeat: false,
      sideStickBackbeat: true,
    }),
    2: ch({
      name: 'Clave',
      blurb: 'Ride + rim clave, drop extra cymbals',
      accentTier: 3,
      ghostTier: 2,
      hatTier: 3,
      dynamics: 0.58,
      hatOpenness: 0.5,
      hatDensity: 0.7,
      ghostDensity: 0.8,
      kickDensity: 0.85,
      timekeeper: 'ride',
      cymbalExtra: 0.35,
      fillAmount: 0,
      brightnessDb: -0.8,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    3: ch({
      name: 'Dance',
      blurb: 'Written ride bell, opens, light fill',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 3,
      dynamics: 0.42,
      hatOpenness: 1,
      hatDensity: 1,
      ghostDensity: 1,
      kickDensity: 1,
      timekeeper: 'both',
      cymbalExtra: 1,
      fillAmount: 0.7,
      brightnessDb: 0.5,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    4: ch({
      name: 'Carnival',
      blurb: 'Extra bell, splash, full fill, brighter',
      accentTier: 5,
      ghostTier: 3,
      hatTier: 4,
      dynamics: 0.25,
      hatOpenness: 1.5,
      hatDensity: 1.5,
      ghostDensity: 1.4,
      kickDensity: 1.15,
      timekeeper: 'both',
      cymbalExtra: 2,
      fillAmount: 1,
      brightnessDb: 2.2,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
  },
}

const SHUFFLE: StyleIntensityProfile = {
  styleId: 'shuffle',
  levels: [1, 2, 3, 4],
  defaultLevel: 3,
  characters: {
    1: ch({
      name: 'Feather',
      blurb: 'Ride only, feathered kick, no crash or fill',
      accentTier: 2,
      ghostTier: 1,
      hatTier: 2,
      dynamics: 0.82,
      hatOpenness: 0,
      hatDensity: 0,
      ghostDensity: 0.35,
      kickDensity: 0.45,
      timekeeper: 'ride',
      cymbalExtra: 0,
      fillAmount: 0,
      brightnessDb: -2.7,
      rimshotBackbeat: false,
      sideStickBackbeat: true,
    }),
    2: ch({
      name: 'Swing',
      blurb: 'Ride + 2 and 4, light hats',
      accentTier: 3,
      ghostTier: 1,
      hatTier: 3,
      dynamics: 0.65,
      hatOpenness: 0.4,
      hatDensity: 0.4,
      ghostDensity: 0.7,
      kickDensity: 0.75,
      timekeeper: 'ride',
      cymbalExtra: 0.35,
      fillAmount: 0,
      brightnessDb: -1.0,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    3: ch({
      name: 'Shuffle',
      blurb: 'Written shuffle hats, bell, light fill',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 3,
      dynamics: 0.45,
      hatOpenness: 1,
      hatDensity: 1,
      ghostDensity: 1,
      kickDensity: 1,
      timekeeper: 'both',
      cymbalExtra: 1,
      fillAmount: 0.7,
      brightnessDb: 0.4,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    4: ch({
      name: 'Cook',
      blurb: 'Busier ride/hats, crash, china lift, full fill',
      accentTier: 5,
      ghostTier: 3,
      hatTier: 4,
      dynamics: 0.25,
      hatOpenness: 1.5,
      hatDensity: 1.6,
      ghostDensity: 1.5,
      kickDensity: 1.15,
      timekeeper: 'both',
      cymbalExtra: 2,
      fillAmount: 1,
      brightnessDb: 2.1,
      rimshotBackbeat: true,
      sideStickBackbeat: false,
    }),
  },
}

const JAZZ: StyleIntensityProfile = {
  styleId: 'jazz',
  levels: [1, 2, 3, 4],
  defaultLevel: 2,
  characters: {
    1: ch({
      name: 'Feather',
      blurb: 'Soft ride, sidestick 2 and 4, almost no kick',
      accentTier: 2,
      ghostTier: 1,
      hatTier: 2,
      dynamics: 0.9,
      hatOpenness: 0,
      hatDensity: 0,
      ghostDensity: 0.55,
      kickDensity: 0.25,
      timekeeper: 'ride',
      cymbalExtra: 0,
      fillAmount: 0,
      brightnessDb: -3.2,
      rimshotBackbeat: false,
      sideStickBackbeat: true,
    }),
    2: ch({
      name: 'Swing',
      blurb: 'Ding-ding-a-ding, feathered kick, light comps',
      accentTier: 3,
      ghostTier: 1,
      hatTier: 2,
      dynamics: 0.72,
      hatOpenness: 0,
      hatDensity: 0,
      ghostDensity: 1,
      kickDensity: 0.7,
      timekeeper: 'ride',
      cymbalExtra: 0.25,
      fillAmount: 0,
      brightnessDb: -1.2,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    3: ch({
      name: 'Cook',
      blurb: 'Busier comps, some bell, light fill',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 3,
      dynamics: 0.5,
      hatOpenness: 0.35,
      hatDensity: 0.4,
      ghostDensity: 1.55,
      kickDensity: 1,
      timekeeper: 'ride',
      cymbalExtra: 0.8,
      fillAmount: 0.55,
      brightnessDb: 0.6,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    4: ch({
      name: 'Shout',
      blurb: 'Crash, extra bell, full fill, brighter ride',
      accentTier: 5,
      ghostTier: 3,
      hatTier: 4,
      dynamics: 0.28,
      hatOpenness: 0.8,
      hatDensity: 0.8,
      ghostDensity: 1.9,
      kickDensity: 1.2,
      timekeeper: 'both',
      cymbalExtra: 2,
      fillAmount: 1,
      brightnessDb: 2.4,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
  },
}

const WALTZ: StyleIntensityProfile = {
  styleId: 'waltz',
  levels: [1, 2, 3],
  defaultLevel: 2,
  characters: {
    1: ch({
      name: 'Ballad',
      blurb: 'Sparse hats, no crash or fill',
      accentTier: 2,
      ghostTier: 1,
      hatTier: 2,
      dynamics: 0.8,
      hatOpenness: 0,
      hatDensity: 0,
      ghostDensity: 0,
      kickDensity: 0.5,
      timekeeper: 'hats',
      cymbalExtra: 0,
      fillAmount: 0,
      brightnessDb: -2.6,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    2: ch({
      name: 'Dance',
      blurb: 'Written 3/4 groove, splash lift, light fill',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 3,
      dynamics: 0.5,
      hatOpenness: 1,
      hatDensity: 1,
      ghostDensity: 0.8,
      kickDensity: 1,
      timekeeper: 'both',
      cymbalExtra: 1,
      fillAmount: 0.65,
      brightnessDb: 0.2,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    3: ch({
      name: 'Big',
      blurb: 'Crash, extra hats, full fill, brighter',
      accentTier: 5,
      ghostTier: 3,
      hatTier: 4,
      dynamics: 0.28,
      hatOpenness: 1.55,
      hatDensity: 1.7,
      ghostDensity: 1.2,
      kickDensity: 1.15,
      timekeeper: 'both',
      cymbalExtra: 2,
      fillAmount: 1,
      brightnessDb: 2.0,
      rimshotBackbeat: true,
      sideStickBackbeat: false,
    }),
  },
}

const ODD: StyleIntensityProfile = {
  styleId: 'odd',
  levels: [1, 2, 3, 4],
  defaultLevel: 3,
  characters: {
    1: ch({
      name: 'Sparse',
      blurb: 'Downbeat time, no china or fill',
      accentTier: 3,
      ghostTier: 1,
      hatTier: 2,
      dynamics: 0.65,
      hatOpenness: 0,
      hatDensity: 0,
      ghostDensity: 0,
      kickDensity: 0.6,
      timekeeper: 'hats',
      cymbalExtra: 0,
      fillAmount: 0,
      brightnessDb: -1.8,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    2: ch({
      name: 'Groove',
      blurb: 'Written hats, phrase crash, no fill',
      accentTier: 3,
      ghostTier: 2,
      hatTier: 3,
      dynamics: 0.48,
      hatOpenness: 0.6,
      hatDensity: 0.7,
      ghostDensity: 0.5,
      kickDensity: 0.9,
      timekeeper: 'hats',
      cymbalExtra: 0.5,
      fillAmount: 0,
      brightnessDb: -0.4,
      rimshotBackbeat: false,
      sideStickBackbeat: false,
    }),
    3: ch({
      name: 'Full',
      blurb: 'China/crash as written, light fill',
      accentTier: 4,
      ghostTier: 2,
      hatTier: 4,
      dynamics: 0.35,
      hatOpenness: 1,
      hatDensity: 1,
      ghostDensity: 0.8,
      kickDensity: 1,
      timekeeper: 'both',
      cymbalExtra: 1,
      fillAmount: 0.7,
      brightnessDb: 0.8,
      rimshotBackbeat: true,
      sideStickBackbeat: false,
    }),
    4: ch({
      name: 'Max',
      blurb: 'Busier hats, extra china/splash, full fill',
      accentTier: 5,
      ghostTier: 3,
      hatTier: 5,
      dynamics: 0.18,
      hatOpenness: 1.5,
      hatDensity: 2,
      ghostDensity: 1.3,
      kickDensity: 1.2,
      timekeeper: 'both',
      cymbalExtra: 2,
      fillAmount: 1,
      brightnessDb: 2.4,
      rimshotBackbeat: true,
      sideStickBackbeat: false,
    }),
  },
}

export const STYLE_INTENSITY: Record<RhythmStyleId, StyleIntensityProfile> = {
  rock: ROCK,
  funk: FUNK,
  metal: METAL,
  pop: POP,
  hiphop: HIPHOP,
  house: HOUSE,
  latin: LATIN,
  shuffle: SHUFFLE,
  jazz: JAZZ,
  waltz: WALTZ,
  odd: ODD,
}

export function styleIntensityProfile(styleId: RhythmStyleId | null | undefined): StyleIntensityProfile {
  return STYLE_INTENSITY[styleId ?? DEFAULT_INTENSITY_STYLE] ?? ROCK
}

export function maxStyleIntensity(styleId: RhythmStyleId | null | undefined): KitIntensity {
  const levels = styleIntensityProfile(styleId).levels
  return levels[levels.length - 1] ?? 5
}

export function clampKitIntensity(value: unknown): KitIntensity {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_KIT_INTENSITY
  return Math.min(5, Math.max(1, Math.round(value))) as KitIntensity
}

export function clampStyleIntensity(
  styleId: RhythmStyleId | null | undefined,
  value: unknown,
): KitIntensity {
  const profile = styleIntensityProfile(styleId)
  const raw = clampKitIntensity(value)
  if (profile.levels.includes(raw)) return raw
  const max = maxStyleIntensity(styleId)
  return Math.min(raw, max) as KitIntensity
}

export function characterFor(
  styleId: RhythmStyleId | null | undefined,
  intensity: KitIntensity,
): IntensityCharacter {
  const profile = styleIntensityProfile(styleId)
  const level = clampStyleIntensity(styleId, intensity)
  return profile.characters[level] ?? profile.characters[profile.defaultLevel] ?? ROCK.characters[4]
}

export function intensityLabel(
  styleId: RhythmStyleId | null | undefined,
  value: KitIntensity,
): string {
  return characterFor(styleId, value).name
}

/** @deprecated Use intensityLabel(styleId, value). Kept for unstyled call sites. */
export function intensityLabelLegacy(value: KitIntensity): string {
  return intensityLabel('rock', value)
}

export function snareHitRole(hit: Pick<HitPos, 'beat' | 'num'>): HitRole {
  if (hit.num === 0 && hit.beat % 2 === 1) return 'backbeat'
  if (hit.num !== 0) return 'ghost'
  return 'normal'
}

export function snareRoleFromStep(step: number, subdivision: SubdivisionId): HitRole {
  const steps = stepsPerBeat(subdivision)
  const beat = Math.floor(step / steps)
  const slot = step % steps
  return snareHitRole({ beat, num: slot })
}

export function resolveTier(intensity: KitIntensity, role: HitRole): KitIntensity {
  if (role === 'ghost') return clampKitIntensity(intensity - 2)
  return intensity
}

export function useRimshotBackbeat(intensity: KitIntensity, role: HitRole): boolean {
  return role === 'backbeat' && intensity >= 4
}

export function playOptsForRole(
  styleId: RhythmStyleId | null | undefined,
  intensity: KitIntensity,
  role: HitRole,
): { tier: KitIntensity; rimshot: boolean; vel: number } {
  const chx = characterFor(styleId, intensity)
  if (role === 'ghost') {
    return { tier: chx.ghostTier, rimshot: false, vel: 0.38 + (1 - chx.dynamics) * 0.22 }
  }
  if (role === 'backbeat') {
    return {
      tier: chx.accentTier,
      rimshot: chx.rimshotBackbeat && !chx.sideStickBackbeat,
      vel: 0.82 + chx.dynamics * 0.22,
    }
  }
  return { tier: chx.accentTier, rimshot: false, vel: 0.72 + (1 - chx.dynamics) * 0.18 }
}
