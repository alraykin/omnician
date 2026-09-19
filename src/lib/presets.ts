import { stringsFromMidis, type InstrumentString } from '@/lib/notes'

export type PresetGroup =
  | 'chromatic'
  | 'guitar'
  | 'bass'
  | 'ukulele'
  | 'banjo'
  | 'other'
  | 'custom'

export type TuningPreset = {
  id: string
  name: string
  group: PresetGroup
  summary: string
  strings: InstrumentString[]
}

function preset(
  id: string,
  name: string,
  group: Exclude<PresetGroup, 'custom'>,
  summary: string,
  midis: readonly number[] = [],
): TuningPreset {
  return { id, name, group, summary, strings: stringsFromMidis(midis) }
}

export const BUILTIN_PRESETS: TuningPreset[] = [
  preset('chromatic', 'Chromatic', 'chromatic', 'Any pitch · nearest note'),

  preset(
    'guitar-6-standard',
    '6-string standard',
    'guitar',
    'E A D G B e',
    [40, 45, 50, 55, 59, 64],
  ),
  preset(
    'guitar-6-drop-d',
    '6-string Drop D',
    'guitar',
    'D A D G B e',
    [38, 45, 50, 55, 59, 64],
  ),
  preset(
    'guitar-6-dadgad',
    '6-string DADGAD',
    'guitar',
    'D A D G A D',
    [38, 45, 50, 55, 57, 62],
  ),
  preset(
    'guitar-4-tenor',
    '4-string tenor',
    'guitar',
    'C G D A',
    [48, 55, 62, 69],
  ),
  preset(
    'guitar-5',
    '5-string',
    'guitar',
    'E A D G B',
    [40, 45, 50, 55, 59],
  ),
  preset(
    'guitar-7',
    '7-string',
    'guitar',
    'B E A D G B e',
    [35, 40, 45, 50, 55, 59, 64],
  ),
  preset(
    'guitar-8',
    '8-string',
    'guitar',
    'F♯ B E A D G B e',
    [30, 35, 40, 45, 50, 55, 59, 64],
  ),
  preset(
    'guitar-9',
    '9-string',
    'guitar',
    'C♯ F♯ B E A D G B e',
    [25, 30, 35, 40, 45, 50, 55, 59, 64],
  ),
  preset(
    'guitar-10',
    '10-string',
    'guitar',
    'G♯ C♯ F♯ B E A D G B e',
    [20, 25, 30, 35, 40, 45, 50, 55, 59, 64],
  ),

  preset('bass-4', '4-string', 'bass', 'E A D G', [28, 33, 38, 43]),
  preset('bass-5', '5-string', 'bass', 'B E A D G', [23, 28, 33, 38, 43]),
  preset('bass-6', '6-string', 'bass', 'B E A D G C', [23, 28, 33, 38, 43, 48]),
  preset(
    'bass-7',
    '7-string',
    'bass',
    'F♯ B E A D G C',
    [18, 23, 28, 33, 38, 43, 48],
  ),
  preset(
    'bass-8',
    '8-string',
    'bass',
    'F♯ B E A D G C F',
    [18, 23, 28, 33, 38, 43, 48, 53],
  ),
  preset(
    'bass-9',
    '9-string',
    'bass',
    'C♯ F♯ B E A D G C F',
    [13, 18, 23, 28, 33, 38, 43, 48, 53],
  ),
  preset(
    'bass-10',
    '10-string',
    'bass',
    'F♯ B E A D G C F B♭ E♭',
    [18, 23, 28, 33, 38, 43, 48, 53, 58, 63],
  ),

  preset(
    'uke-gcea',
    'Standard GCEA',
    'ukulele',
    'High G · G C E A',
    [67, 60, 64, 69],
  ),
  preset(
    'uke-low-g',
    'Low G',
    'ukulele',
    'Linear · G C E A',
    [55, 60, 64, 69],
  ),

  preset(
    'banjo-open-g',
    '5-string open G',
    'banjo',
    'g D G B D',
    [67, 50, 55, 59, 62],
  ),

  preset('mandolin', 'Mandolin', 'other', 'G D A E', [55, 62, 69, 76]),
  preset('violin', 'Violin / fiddle', 'other', 'G D A E', [55, 62, 69, 76]),
  preset('viola', 'Viola', 'other', 'C G D A', [48, 55, 62, 69]),
  preset('cello', 'Cello', 'other', 'C G D A', [36, 43, 50, 57]),
]

export const GROUP_ORDER: PresetGroup[] = [
  'chromatic',
  'guitar',
  'bass',
  'ukulele',
  'banjo',
  'other',
  'custom',
]

export const GROUP_LABELS: Record<PresetGroup, string> = {
  chromatic: 'Mode',
  guitar: 'Guitar',
  bass: 'Bass',
  ukulele: 'Ukulele',
  banjo: 'Banjo',
  other: 'Other',
  custom: 'My presets',
}

export function findBuiltinPreset(id: string): TuningPreset | undefined {
  return BUILTIN_PRESETS.find((preset) => preset.id === id)
}

export function customToPreset(custom: {
  id: string
  name: string
  midis: number[]
}): TuningPreset {
  return {
    id: custom.id,
    name: custom.name,
    group: 'custom',
    summary: stringsFromMidis(custom.midis)
      .map((string) => `${string.label}${string.octave}`)
      .join(' '),
    strings: stringsFromMidis(custom.midis),
  }
}
