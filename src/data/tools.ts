export type ToolSlug = 'tuner' | 'rhythm'

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
    coming: 'A live tuner is ready now — tap Tuner on the home screen.',
  },
  {
    slug: 'rhythm',
    name: 'Rhythm',
    blurb: 'A click or a groove — same tempo, your pocket.',
    coming: 'Rhythm is ready now — tap Rhythm on the home screen.',
  },
]

export function getTool(slug: string): PracticeTool | undefined {
  return practiceTools.find((tool) => tool.slug === slug)
}
