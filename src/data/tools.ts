export type ToolSlug = 'tuner' | 'metronome' | 'drum-machine'

export type PracticeTool = {
  slug: ToolSlug
  name: string
  blurb: string
  coming: string
}

export const practiceTools: PracticeTool[] = [
  {
    slug: 'tuner',
    name: 'Tuner',
    blurb: 'Match your pitch before you play.',
    coming:
      'Get a clear in-tune signal so every practice starts on pitch. The tuner is coming in V1.',
  },
  {
    slug: 'metronome',
    name: 'Metronome',
    blurb: 'Keep a steady beat you can trust.',
    coming:
      'Set a tempo, lock in the click, and practice with a pulse that stays with you. The metronome is coming in V1.',
  },
  {
    slug: 'drum-machine',
    name: 'Drum Machine',
    blurb: 'Lay down a groove and play over it.',
    coming:
      'Build simple beats and practice against a pocket you can feel. The drum machine is coming in V1.',
  },
]

export function getTool(slug: string): PracticeTool | undefined {
  return practiceTools.find((tool) => tool.slug === slug)
}
