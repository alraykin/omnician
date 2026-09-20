import { notesLabel, stringsFromMidis, type InstrumentString } from '@/lib/notes'

export type FamilyId =
  | 'chromatic'
  | 'guitar'
  | 'bass'
  | 'ukulele'
  | 'folk'
  | 'custom'

export type InstrumentId =
  | 'chromatic'
  | 'guitar-6'
  | 'guitar-7'
  | 'guitar-8'
  | 'guitar-9'
  | 'guitar-10'
  | 'guitar-12'
  | 'guitar-baritone'
  | 'bass-4'
  | 'bass-5'
  | 'bass-6'
  | 'bass-7'
  | 'bass-8'
  | 'ukulele'
  | 'banjo'
  | 'mandolin'
  | 'violin'
  | 'bouzouki'
  | 'custom'

export type TuningCategory =
  | 'standard'
  | 'drop'
  | 'double-drop'
  | 'open'
  | 'alternate'
  | 'left-handed'

export type TuningPreset = {
  id: string
  name: string
  category: TuningCategory
  notes: string
  strings: InstrumentString[]
  config: InstrumentId
}

export type FamilyMeta = {
  id: FamilyId
  label: string
}

export type ConfigMeta = {
  id: InstrumentId
  family: FamilyId
  label: string
}

export const FAMILIES: FamilyMeta[] = [
  { id: 'chromatic', label: 'Chromatic' },
  { id: 'guitar', label: 'Guitar' },
  { id: 'bass', label: 'Bass' },
  { id: 'ukulele', label: 'Ukulele' },
  { id: 'folk', label: 'Folk' },
  { id: 'custom', label: 'My customs' },
]

export const CONFIGS: ConfigMeta[] = [
  { id: 'chromatic', family: 'chromatic', label: 'Chromatic' },
  { id: 'guitar-6', family: 'guitar', label: '6-string' },
  { id: 'guitar-7', family: 'guitar', label: '7-string' },
  { id: 'guitar-8', family: 'guitar', label: '8-string' },
  { id: 'guitar-9', family: 'guitar', label: '9-string' },
  { id: 'guitar-10', family: 'guitar', label: '10-string' },
  { id: 'guitar-12', family: 'guitar', label: '12-string' },
  { id: 'guitar-baritone', family: 'guitar', label: 'Baritone' },
  { id: 'bass-4', family: 'bass', label: '4-string' },
  { id: 'bass-5', family: 'bass', label: '5-string' },
  { id: 'bass-6', family: 'bass', label: '6-string' },
  { id: 'bass-7', family: 'bass', label: '7-string' },
  { id: 'bass-8', family: 'bass', label: '8-string' },
  { id: 'ukulele', family: 'ukulele', label: 'Ukulele' },
  { id: 'banjo', family: 'folk', label: 'Banjo' },
  { id: 'mandolin', family: 'folk', label: 'Mandolin' },
  { id: 'violin', family: 'folk', label: 'Violin / Fiddle' },
  { id: 'bouzouki', family: 'folk', label: 'Bouzouki' },
  { id: 'custom', family: 'custom', label: 'My customs' },
]

export const CATEGORY_ORDER: TuningCategory[] = [
  'standard',
  'drop',
  'double-drop',
  'open',
  'alternate',
  'left-handed',
]

export const CATEGORY_LABELS: Record<TuningCategory, string> = {
  standard: 'Standard',
  drop: 'Drop',
  'double-drop': 'Double Drop',
  open: 'Open',
  alternate: 'Alternate / Other',
  'left-handed': 'Left-handed',
}

const LEGACY_CONFIG: Record<string, InstrumentId> = {
  'acoustic-guitar': 'guitar-6',
  'electric-guitar': 'guitar-6',
  'guitar-7': 'guitar-7',
  'guitar-12': 'guitar-12',
}

function preset(
  id: string,
  name: string,
  config: InstrumentId,
  category: TuningCategory,
  midis: readonly number[],
): TuningPreset {
  return {
    id,
    name,
    config,
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
  config: 'chromatic',
}

export const BUILTIN_PRESETS: TuningPreset[] = [
  CHROMATIC_PRESET,

  preset('guitar-6-standard', 'Standard', 'guitar-6', 'standard', [40, 45, 50, 55, 59, 64]),
  preset('guitar-6-half-down', 'Half step down', 'guitar-6', 'standard', [39, 44, 49, 54, 58, 63]),
  preset('guitar-6-whole-down', 'Whole step down', 'guitar-6', 'standard', [38, 43, 48, 53, 57, 62]),
  preset('guitar-6-drop-d', 'Drop D', 'guitar-6', 'drop', [38, 45, 50, 55, 59, 64]),
  preset('guitar-6-drop-cs', 'Drop C♯', 'guitar-6', 'drop', [37, 44, 49, 54, 58, 63]),
  preset('guitar-6-drop-c', 'Drop C', 'guitar-6', 'drop', [36, 43, 48, 53, 57, 62]),
  preset('guitar-6-drop-b', 'Drop B', 'guitar-6', 'drop', [35, 42, 47, 52, 56, 61]),
  preset('guitar-6-drop-a', 'Drop A', 'guitar-6', 'drop', [33, 40, 45, 50, 54, 59]),
  preset('guitar-6-double-drop-d', 'Double Drop D', 'guitar-6', 'double-drop', [38, 45, 50, 55, 59, 62]),
  preset('guitar-6-double-drop-cs', 'Double Drop C♯', 'guitar-6', 'double-drop', [37, 44, 49, 54, 58, 61]),
  preset('guitar-6-double-drop-c', 'Double Drop C', 'guitar-6', 'double-drop', [36, 43, 48, 53, 57, 60]),
  preset('guitar-6-open-g', 'Open G', 'guitar-6', 'open', [38, 43, 50, 55, 59, 62]),
  preset('guitar-6-open-d', 'Open D', 'guitar-6', 'open', [38, 45, 50, 54, 57, 62]),
  preset('guitar-6-open-c', 'Open C', 'guitar-6', 'open', [36, 43, 48, 55, 60, 64]),
  preset('guitar-6-open-e', 'Open E', 'guitar-6', 'open', [40, 47, 52, 56, 59, 64]),
  preset('guitar-6-open-a', 'Open A', 'guitar-6', 'open', [40, 45, 52, 57, 61, 64]),
  preset('guitar-6-dadgad', 'DADGAD', 'guitar-6', 'alternate', [38, 45, 50, 55, 57, 62]),
  preset('guitar-6-all-fourths', 'All fourths', 'guitar-6', 'alternate', [40, 45, 50, 55, 60, 65]),
  preset('guitar-6-nst', 'New Standard', 'guitar-6', 'alternate', [36, 43, 50, 57, 64, 67]),
  preset('guitar-6-lefty-standard', 'Standard', 'guitar-6', 'left-handed', [64, 59, 55, 50, 45, 40]),
  preset('guitar-6-lefty-drop-d', 'Drop D', 'guitar-6', 'left-handed', [64, 59, 55, 50, 45, 38]),

  preset('guitar-7', 'Standard', 'guitar-7', 'standard', [35, 40, 45, 50, 55, 59, 64]),
  preset('guitar-7-half-down', 'Half step down', 'guitar-7', 'standard', [34, 39, 44, 49, 54, 58, 63]),
  preset('guitar-7-whole-down', 'Whole step down', 'guitar-7', 'standard', [33, 38, 43, 48, 53, 57, 62]),
  preset('guitar-7-drop-a', 'Drop A', 'guitar-7', 'drop', [33, 40, 45, 50, 55, 59, 64]),
  preset('guitar-7-drop-g', 'Drop G', 'guitar-7', 'drop', [31, 38, 43, 48, 53, 57, 62]),
  preset('guitar-7-double-drop-a', 'Double Drop A', 'guitar-7', 'double-drop', [33, 40, 45, 50, 55, 59, 62]),
  preset('guitar-7-all-fourths', 'All fourths', 'guitar-7', 'alternate', [35, 40, 45, 50, 55, 60, 65]),

  preset('guitar-8', 'Standard', 'guitar-8', 'standard', [30, 35, 40, 45, 50, 55, 59, 64]),
  preset('guitar-8-half-down', 'Half step down', 'guitar-8', 'standard', [29, 34, 39, 44, 49, 54, 58, 63]),
  preset('guitar-8-drop-e', 'Drop E', 'guitar-8', 'drop', [28, 35, 40, 45, 50, 55, 59, 64]),
  preset('guitar-8-drop-d', 'Drop D', 'guitar-8', 'drop', [26, 33, 38, 43, 48, 53, 57, 62]),

  preset('guitar-9', 'Standard', 'guitar-9', 'standard', [25, 30, 35, 40, 45, 50, 55, 59, 64]),
  preset('guitar-9-half-down', 'Half step down', 'guitar-9', 'standard', [24, 29, 34, 39, 44, 49, 54, 58, 63]),
  preset('guitar-9-drop-b', 'Drop B', 'guitar-9', 'drop', [23, 30, 35, 40, 45, 50, 55, 59, 64]),

  preset('guitar-10', 'Standard', 'guitar-10', 'standard', [20, 25, 30, 35, 40, 45, 50, 55, 59, 64]),
  preset('guitar-10-half-down', 'Half step down', 'guitar-10', 'standard', [19, 24, 29, 34, 39, 44, 49, 54, 58, 63]),
  preset('guitar-10-drop-f', 'Drop F♯', 'guitar-10', 'drop', [18, 25, 30, 35, 40, 45, 50, 55, 59, 64]),

  preset('guitar-12-standard', 'Standard', 'guitar-12', 'standard', [40, 45, 50, 55, 59, 64]),
  preset('guitar-12-half-down', 'Half step down', 'guitar-12', 'standard', [39, 44, 49, 54, 58, 63]),
  preset('guitar-12-whole-down', 'Whole step down', 'guitar-12', 'standard', [38, 43, 48, 53, 57, 62]),
  preset('guitar-12-drop-d', 'Drop D', 'guitar-12', 'drop', [38, 45, 50, 55, 59, 64]),
  preset('guitar-12-double-drop-d', 'Double Drop D', 'guitar-12', 'double-drop', [38, 45, 50, 55, 59, 62]),

  preset('baritone-b', 'B standard', 'guitar-baritone', 'standard', [35, 40, 45, 50, 54, 59]),
  preset('baritone-a', 'A standard', 'guitar-baritone', 'standard', [33, 38, 43, 48, 52, 57]),
  preset('baritone-c', 'C standard', 'guitar-baritone', 'standard', [36, 41, 46, 51, 55, 60]),
  preset('baritone-half-down', 'Half step down', 'guitar-baritone', 'standard', [34, 39, 44, 49, 53, 58]),
  preset('baritone-drop-a', 'Drop A', 'guitar-baritone', 'drop', [33, 40, 45, 50, 54, 59]),
  preset('baritone-drop-g', 'Drop G', 'guitar-baritone', 'drop', [31, 38, 43, 48, 52, 57]),
  preset('baritone-double-drop-a', 'Double Drop A', 'guitar-baritone', 'double-drop', [33, 40, 45, 50, 54, 57]),

  preset('bass-4', 'Standard', 'bass-4', 'standard', [28, 33, 38, 43]),
  preset('bass-4-half-down', 'Half step down', 'bass-4', 'standard', [27, 32, 37, 42]),
  preset('bass-4-whole-down', 'Whole step down', 'bass-4', 'standard', [26, 31, 36, 41]),
  preset('bass-4-bead', 'BEAD', 'bass-4', 'standard', [23, 28, 33, 38]),
  preset('bass-4-drop-d', 'Drop D', 'bass-4', 'drop', [26, 33, 38, 43]),
  preset('bass-4-drop-c', 'Drop C', 'bass-4', 'drop', [24, 31, 36, 41]),
  preset('bass-4-drop-b', 'Drop B', 'bass-4', 'drop', [23, 30, 35, 40]),

  preset('bass-5', 'Standard', 'bass-5', 'standard', [23, 28, 33, 38, 43]),
  preset('bass-5-half-down', 'Half step down', 'bass-5', 'standard', [22, 27, 32, 37, 42]),
  preset('bass-5-high-c', 'High C', 'bass-5', 'standard', [28, 33, 38, 43, 48]),
  preset('bass-5-drop-a', 'Drop A', 'bass-5', 'drop', [21, 28, 33, 38, 43]),

  preset('bass-6', 'Standard', 'bass-6', 'standard', [23, 28, 33, 38, 43, 48]),
  preset('bass-6-half-down', 'Half step down', 'bass-6', 'standard', [22, 27, 32, 37, 42, 47]),
  preset('bass-6-drop-a', 'Drop A', 'bass-6', 'drop', [21, 28, 33, 38, 43, 48]),

  preset('bass-7', 'Standard', 'bass-7', 'standard', [18, 23, 28, 33, 38, 43, 48]),
  preset('bass-7-half-down', 'Half step down', 'bass-7', 'standard', [17, 22, 27, 32, 37, 42, 47]),
  preset('bass-7-drop-e', 'Drop E', 'bass-7', 'drop', [16, 23, 28, 33, 38, 43, 48]),

  preset('bass-8', 'Standard', 'bass-8', 'standard', [18, 23, 28, 33, 38, 43, 48, 53]),
  preset('bass-8-half-down', 'Half step down', 'bass-8', 'standard', [17, 22, 27, 32, 37, 42, 47, 52]),
  preset('bass-8-drop-e', 'Drop E', 'bass-8', 'drop', [16, 23, 28, 33, 38, 43, 48, 53]),

  preset('uke-gcea', 'Soprano / Concert', 'ukulele', 'standard', [67, 60, 64, 69]),
  preset('uke-low-g', 'Low G', 'ukulele', 'standard', [55, 60, 64, 69]),
  preset('uke-baritone', 'Baritone', 'ukulele', 'standard', [50, 55, 59, 64]),
  preset('uke-d-tuning', 'D tuning', 'ukulele', 'alternate', [69, 62, 66, 71]),
  preset('uke-open-c', 'Open C', 'ukulele', 'open', [67, 60, 64, 67]),

  preset('banjo-open-g', 'Open G', 'banjo', 'standard', [67, 50, 55, 59, 62]),
  preset('banjo-standard-c', 'Standard C', 'banjo', 'standard', [67, 48, 55, 59, 62]),
  preset('banjo-open-d', 'Open D', 'banjo', 'open', [69, 50, 54, 57, 62]),
  preset('banjo-double-c', 'Double C', 'banjo', 'alternate', [67, 48, 55, 60, 62]),
  preset('banjo-sawmill', 'Sawmill', 'banjo', 'alternate', [67, 50, 55, 60, 62]),

  preset('mandolin', 'Standard', 'mandolin', 'standard', [55, 62, 69, 76]),
  preset('mando-cross-a', 'Cross A', 'mandolin', 'alternate', [57, 64, 69, 76]),
  preset('mando-open-g', 'Open G', 'mandolin', 'open', [55, 62, 67, 74]),

  preset('violin', 'Standard', 'violin', 'standard', [55, 62, 69, 76]),
  preset('violin-cross-a', 'Cross A', 'violin', 'alternate', [57, 64, 69, 76]),
  preset('violin-cajun', 'Cajun', 'violin', 'alternate', [53, 60, 67, 74]),
  preset('violin-open-d', 'Open D', 'violin', 'open', [50, 57, 62, 69]),

  preset('bouzouki-gdad', 'GDAD', 'bouzouki', 'standard', [43, 50, 57, 62]),
  preset('bouzouki-gdae', 'GDAE', 'bouzouki', 'standard', [43, 50, 57, 64]),
  preset('bouzouki-adad', 'ADAD', 'bouzouki', 'alternate', [45, 50, 57, 62]),
]

const CONFIG_IDS = new Set<InstrumentId>(CONFIGS.map((item) => item.id))

export function normalizeInstrumentId(value: string): InstrumentId | null {
  if (CONFIG_IDS.has(value as InstrumentId)) return value as InstrumentId
  return LEGACY_CONFIG[value] ?? null
}

export function isInstrumentId(value: string): value is InstrumentId {
  return CONFIG_IDS.has(value as InstrumentId)
}

export function findConfig(id: InstrumentId): ConfigMeta {
  return CONFIGS.find((item) => item.id === id) ?? CONFIGS[0]
}

export function findFamily(id: FamilyId): FamilyMeta {
  return FAMILIES.find((item) => item.id === id) ?? FAMILIES[0]
}

export function familyOf(id: InstrumentId): FamilyId {
  return findConfig(id).family
}

export function configsForFamily(family: FamilyId): ConfigMeta[] {
  return CONFIGS.filter((item) => item.family === family)
}

export function familyHasSubmenu(family: FamilyId): boolean {
  return configsForFamily(family).length > 1
}

export function findInstrument(id: InstrumentId): ConfigMeta {
  return findConfig(id)
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
    config: 'custom',
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
    (item) => item.id !== 'chromatic' && item.config === instrument,
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
  const normalized = hint ? normalizeInstrumentId(hint) : null
  if (normalized && preset.config === normalized) return normalized
  return preset.config
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
