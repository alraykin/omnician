import { notesLabel, stringsFromMidis, type InstrumentString } from '@/lib/notes'

export type InstrumentId =
  | 'chromatic'
  | 'acoustic-guitar'
  | 'electric-guitar'
  | 'bass-4'
  | 'bass-5'
  | 'guitar-7'
  | 'guitar-12'
  | 'ukulele'
  | 'banjo'
  | 'mandolin'
  | 'violin'
  | 'custom'

export type TuningCategory =
  | 'standard'
  | 'drop'
  | 'open'
  | 'alternate'
  | 'left-handed'

export type TuningPreset = {
  id: string
  name: string
  category: TuningCategory
  notes: string
  strings: InstrumentString[]
  families: InstrumentId[]
}

export type InstrumentMeta = {
  id: InstrumentId
  label: string
  shortLabel: string
}

export const INSTRUMENTS: InstrumentMeta[] = [
  { id: 'chromatic', label: 'Chromatic', shortLabel: 'Chromatic' },
  { id: 'acoustic-guitar', label: 'Acoustic Guitar', shortLabel: 'Acoustic Guitar' },
  { id: 'electric-guitar', label: 'Electric Guitar', shortLabel: 'Electric Guitar' },
  { id: 'bass-4', label: 'Bass 4', shortLabel: 'Bass 4' },
  { id: 'bass-5', label: 'Bass 5', shortLabel: 'Bass 5' },
  { id: 'guitar-7', label: '7-string', shortLabel: '7-string' },
  { id: 'guitar-12', label: '12-string', shortLabel: '12-string' },
  { id: 'ukulele', label: 'Ukulele', shortLabel: 'Ukulele' },
  { id: 'banjo', label: 'Banjo', shortLabel: 'Banjo' },
  { id: 'mandolin', label: 'Mandolin', shortLabel: 'Mandolin' },
  { id: 'violin', label: 'Violin', shortLabel: 'Violin' },
  { id: 'custom', label: 'My customs', shortLabel: 'My customs' },
]

export const CATEGORY_ORDER: TuningCategory[] = [
  'standard',
  'drop',
  'open',
  'alternate',
  'left-handed',
]

export const CATEGORY_LABELS: Record<TuningCategory, string> = {
  standard: 'Standard',
  drop: 'Drop',
  open: 'Open',
  alternate: 'Alternate / Other',
  'left-handed': 'Left-handed',
}

const G6: InstrumentId[] = ['acoustic-guitar', 'electric-guitar']
const G7: InstrumentId[] = ['guitar-7']
const G12: InstrumentId[] = ['guitar-12']
const B4: InstrumentId[] = ['bass-4']
const B5: InstrumentId[] = ['bass-5']
const UKE: InstrumentId[] = ['ukulele']
const BANJO: InstrumentId[] = ['banjo']
const MANDO: InstrumentId[] = ['mandolin']
const VN: InstrumentId[] = ['violin']

function preset(
  id: string,
  name: string,
  families: InstrumentId[],
  category: TuningCategory,
  midis: readonly number[],
): TuningPreset {
  return {
    id,
    name,
    families,
    category,
    notes: notesLabel(midis),
    strings: stringsFromMidis(midis),
  }
}

export const CHROMATIC_PRESET: TuningPreset = {
  id: 'chromatic',
  name: 'Chromatic',
  category: 'standard',
  notes: 'Nearest note',
  strings: [],
  families: ['chromatic'],
}

export const BUILTIN_PRESETS: TuningPreset[] = [
  CHROMATIC_PRESET,

  preset('guitar-6-standard', 'Standard', G6, 'standard', [40, 45, 50, 55, 59, 64]),
  preset('guitar-6-half-down', 'Half step down', G6, 'standard', [39, 44, 49, 54, 58, 63]),
  preset('guitar-6-whole-down', 'Whole step down', G6, 'standard', [38, 43, 48, 53, 57, 62]),

  preset('guitar-6-drop-d', 'Drop D', G6, 'drop', [38, 45, 50, 55, 59, 64]),
  preset('guitar-6-drop-cs', 'Drop C♯', G6, 'drop', [37, 44, 49, 54, 58, 63]),
  preset('guitar-6-drop-c', 'Drop C', G6, 'drop', [36, 43, 48, 53, 57, 62]),
  preset('guitar-6-drop-b', 'Drop B', G6, 'drop', [35, 42, 47, 52, 56, 61]),
  preset('guitar-6-drop-a', 'Drop A', G6, 'drop', [33, 40, 45, 50, 54, 59]),

  preset('guitar-6-open-g', 'Open G', G6, 'open', [38, 43, 50, 55, 59, 62]),
  preset('guitar-6-open-d', 'Open D', G6, 'open', [38, 45, 50, 54, 57, 62]),
  preset('guitar-6-open-c', 'Open C', G6, 'open', [36, 43, 48, 55, 60, 64]),
  preset('guitar-6-open-e', 'Open E', G6, 'open', [40, 47, 52, 56, 59, 64]),
  preset('guitar-6-open-a', 'Open A', G6, 'open', [40, 45, 52, 57, 61, 64]),

  preset('guitar-6-dadgad', 'DADGAD', G6, 'alternate', [38, 45, 50, 55, 57, 62]),
  preset('guitar-6-double-drop-d', 'Double Drop D', G6, 'alternate', [38, 45, 50, 55, 59, 62]),
  preset('guitar-6-all-fourths', 'All fourths', G6, 'alternate', [40, 45, 50, 55, 60, 65]),
  preset('guitar-6-nst', 'New Standard', G6, 'alternate', [36, 43, 50, 57, 64, 67]),

  preset('guitar-6-lefty-standard', 'Standard', G6, 'left-handed', [64, 59, 55, 50, 45, 40]),
  preset('guitar-6-lefty-drop-d', 'Drop D', G6, 'left-handed', [64, 59, 55, 50, 45, 38]),

  preset('guitar-7', 'Standard', G7, 'standard', [35, 40, 45, 50, 55, 59, 64]),
  preset('guitar-7-half-down', 'Half step down', G7, 'standard', [34, 39, 44, 49, 54, 58, 63]),
  preset('guitar-7-whole-down', 'Whole step down', G7, 'standard', [33, 38, 43, 48, 53, 57, 62]),
  preset('guitar-7-drop-a', 'Drop A', G7, 'drop', [33, 40, 45, 50, 55, 59, 64]),
  preset('guitar-7-drop-g', 'Drop G', G7, 'drop', [31, 38, 43, 48, 53, 57, 62]),
  preset('guitar-7-all-fourths', 'All fourths', G7, 'alternate', [35, 40, 45, 50, 55, 60, 65]),

  preset('guitar-12-standard', 'Standard', G12, 'standard', [40, 45, 50, 55, 59, 64]),
  preset('guitar-12-half-down', 'Half step down', G12, 'standard', [39, 44, 49, 54, 58, 63]),
  preset('guitar-12-whole-down', 'Whole step down', G12, 'standard', [38, 43, 48, 53, 57, 62]),
  preset('guitar-12-drop-d', 'Drop D', G12, 'drop', [38, 45, 50, 55, 59, 64]),

  preset('bass-4', 'Standard', B4, 'standard', [28, 33, 38, 43]),
  preset('bass-4-half-down', 'Half step down', B4, 'standard', [27, 32, 37, 42]),
  preset('bass-4-whole-down', 'Whole step down', B4, 'standard', [26, 31, 36, 41]),
  preset('bass-4-bead', 'BEAD', B4, 'standard', [23, 28, 33, 38]),
  preset('bass-4-drop-d', 'Drop D', B4, 'drop', [26, 33, 38, 43]),
  preset('bass-4-drop-c', 'Drop C', B4, 'drop', [24, 31, 36, 41]),
  preset('bass-4-drop-b', 'Drop B', B4, 'drop', [23, 30, 35, 40]),

  preset('bass-5', 'Standard', B5, 'standard', [23, 28, 33, 38, 43]),
  preset('bass-5-half-down', 'Half step down', B5, 'standard', [22, 27, 32, 37, 42]),
  preset('bass-5-high-c', 'High C', B5, 'standard', [28, 33, 38, 43, 48]),
  preset('bass-5-drop-a', 'Drop A', B5, 'drop', [21, 28, 33, 38, 43]),

  preset('uke-gcea', 'Soprano / Concert', UKE, 'standard', [67, 60, 64, 69]),
  preset('uke-low-g', 'Low G', UKE, 'standard', [55, 60, 64, 69]),
  preset('uke-baritone', 'Baritone', UKE, 'standard', [50, 55, 59, 64]),
  preset('uke-d-tuning', 'D tuning', UKE, 'alternate', [69, 62, 66, 71]),
  preset('uke-open-c', 'Open C', UKE, 'open', [67, 60, 64, 67]),

  preset('banjo-open-g', 'Open G', BANJO, 'standard', [67, 50, 55, 59, 62]),
  preset('banjo-standard-c', 'Standard C', BANJO, 'standard', [67, 48, 55, 59, 62]),
  preset('banjo-open-d', 'Open D', BANJO, 'open', [69, 50, 54, 57, 62]),
  preset('banjo-double-c', 'Double C', BANJO, 'alternate', [67, 48, 55, 60, 62]),
  preset('banjo-sawmill', 'Sawmill', BANJO, 'alternate', [67, 50, 55, 60, 62]),

  preset('mandolin', 'Standard', MANDO, 'standard', [55, 62, 69, 76]),
  preset('mando-cross-a', 'Cross A', MANDO, 'alternate', [57, 64, 69, 76]),
  preset('mando-open-g', 'Open G', MANDO, 'open', [55, 62, 67, 74]),

  preset('violin', 'Standard', VN, 'standard', [55, 62, 69, 76]),
  preset('violin-cross-a', 'Cross A', VN, 'alternate', [57, 64, 69, 76]),
  preset('violin-cajun', 'Cajun', VN, 'alternate', [53, 60, 67, 74]),
  preset('violin-open-d', 'Open D', VN, 'open', [50, 57, 62, 69]),
]

const INSTRUMENT_IDS = new Set<InstrumentId>(INSTRUMENTS.map((item) => item.id))

export function isInstrumentId(value: string): value is InstrumentId {
  return INSTRUMENT_IDS.has(value as InstrumentId)
}

export function findInstrument(id: InstrumentId): InstrumentMeta {
  return INSTRUMENTS.find((item) => item.id === id) ?? INSTRUMENTS[0]
}

export function findBuiltinPreset(id: string): TuningPreset | undefined {
  return BUILTIN_PRESETS.find((item) => item.id === id)
}

export function customToPreset(custom: {
  id: string
  name: string
  midis: number[]
}): TuningPreset {
  return {
    id: custom.id,
    name: custom.name,
    category: 'alternate',
    notes: notesLabel(custom.midis),
    strings: stringsFromMidis(custom.midis),
    families: ['custom'],
  }
}

export function resolvePreset(
  id: string,
  customs: TuningPreset[],
): TuningPreset {
  return (
    findBuiltinPreset(id) ??
    customs.find((item) => item.id === id) ??
    CHROMATIC_PRESET
  )
}

export function tuningsForInstrument(
  instrument: InstrumentId,
  customs: TuningPreset[],
): TuningPreset[] {
  if (instrument === 'custom') return customs
  if (instrument === 'chromatic') return [CHROMATIC_PRESET]
  return BUILTIN_PRESETS.filter(
    (item) => item.id !== 'chromatic' && item.families.includes(instrument),
  )
}

export function defaultTuningId(instrument: InstrumentId, customs: TuningPreset[]): string {
  if (instrument === 'chromatic') return CHROMATIC_PRESET.id
  if (instrument === 'custom') return customs[0]?.id ?? CHROMATIC_PRESET.id
  const list = tuningsForInstrument(instrument, [])
  return (
    list.find((item) => item.category === 'standard')?.id ??
    list[0]?.id ??
    CHROMATIC_PRESET.id
  )
}

export function inferInstrument(
  preset: TuningPreset,
  hint?: string,
): InstrumentId {
  if (hint && isInstrumentId(hint) && preset.families.includes(hint)) {
    return hint
  }
  return preset.families[0] ?? 'chromatic'
}

export function groupTunings(
  tunings: TuningPreset[],
): { category: TuningCategory; label: string; items: TuningPreset[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    items: tunings.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0)
}

export function matchesQuery(preset: TuningPreset, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return (
    preset.name.toLowerCase().includes(needle) ||
    preset.notes.toLowerCase().includes(needle) ||
    CATEGORY_LABELS[preset.category].toLowerCase().includes(needle)
  )
}
