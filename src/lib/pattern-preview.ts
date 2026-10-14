import { beatBoxView, type InputDivision } from '@/lib/beat-boxes'
import { type Pattern, type RhythmBar, type VoiceId } from '@/lib/rhythm'

export const PREVIEW_GROUPS = [
  { id: 'kick', label: 'Kick', voices: ['kick'] },
  { id: 'snare', label: 'Snare', voices: ['snare', 'rim'] },
  { id: 'toms', label: 'Toms', voices: ['highTom', 'midTom', 'floorTom'] },
  { id: 'hh', label: 'HH', voices: ['closedHat', 'openHat'] },
  { id: 'cym', label: 'Cym', voices: ['ride', 'rideBell', 'crash', 'stack', 'splash', 'china'] },
] as const

export type PreviewGroupId = (typeof PREVIEW_GROUPS)[number]['id']

export type PreviewDot = {
  key: string
  bar: number
  beat: number
  slot: number
  filled: boolean
  soft: boolean
}

export function inputShortLabel(input: InputDivision, beatUnit: number): string {
  const triplet = input === 3 || input === 6
  const den = beatUnit * (input === 3 ? 2 : input === 6 ? 4 : input)
  return triplet ? `1/${den}T` : `1/${den}`
}

function groupHits(pattern: Pattern, voices: readonly VoiceId[]) {
  const hits: { beat: number; filled: boolean; soft: boolean; slot: number }[] = []
  void hits
  return voices.flatMap((voice) => pattern[voice] ?? [])
}

export function previewDotsForGroup(
  bars: readonly RhythmBar[],
  voices: readonly VoiceId[],
  input: InputDivision,
): PreviewDot[] {
  const dots: PreviewDot[] = []
  bars.forEach((bar, barIndex) => {
    const hits = groupHits(bar.pattern, voices)
    for (let beat = 0; beat < bar.beats; beat += 1) {
      const view = beatBoxView(hits, beat, input)
      for (const slot of view.slots) {
        dots.push({
          key: `${barIndex}-${beat}-${slot.slot}`,
          bar: barIndex,
          beat,
          slot: slot.slot,
          filled: slot.filled,
          soft: slot.soft,
        })
      }
    }
  })
  return dots
}

export function previewHasHits(dots: readonly PreviewDot[]): boolean {
  return dots.some((dot) => dot.filled)
}
