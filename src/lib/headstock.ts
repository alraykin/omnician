import type { InstrumentString } from '@/lib/notes'
import type { FamilyId, InstrumentId } from '@/lib/presets'

export type PegSide = 'left' | 'right' | 'fifth'

export type PegSlot = {
  string: InstrumentString
  side: PegSide
  row: number
}

export function familyTone(family: FamilyId): 'guitar' | 'bass' | 'ukulele' | 'folk' {
  if (family === 'bass') return 'bass'
  if (family === 'ukulele') return 'ukulele'
  if (family === 'folk') return 'folk'
  return 'guitar'
}

export function usesCloverPegs(config: InstrumentId): boolean {
  return config.startsWith('bass')
}

export function usesGuitarShape(config: InstrumentId): boolean {
  return (
    config.startsWith('guitar-') ||
    config.startsWith('bass-') ||
    config === 'ukulele' ||
    config === 'banjo' ||
    config === 'mandolin' ||
    config === 'violin' ||
    config === 'bouzouki' ||
    config === 'custom'
  )
}

export function layoutPegs(
  strings: readonly InstrumentString[],
  config: InstrumentId,
): PegSlot[] {
  if (strings.length === 0) return []

  if (config === 'guitar-12' && strings.length === 12) {
    const byNo = new Map(strings.map((item) => [item.stringNo, item]))
    // Left column reversed: D/d A/a E/E top→bottom. Right stays g/G B/B e/e.
    const leftNos = [7, 8, 9, 10, 11, 12]
    const rightNos = [6, 5, 4, 3, 2, 1]
    const slots: PegSlot[] = []
    leftNos.forEach((stringNo, row) => {
      const string = byNo.get(stringNo)
      if (string) slots.push({ string, side: 'left', row })
    })
    rightNos.forEach((stringNo, row) => {
      const string = byNo.get(stringNo)
      if (string) slots.push({ string, side: 'right', row })
    })
    return slots
  }

  const banjoFifth =
    config === 'banjo' && strings.length === 5
      ? strings.find((item) => item.stringNo === 5) ?? strings[0]
      : null

  const body = banjoFifth
    ? strings.filter((item) => item.id !== banjoFifth.id)
    : [...strings]

  const ordered = [...body].sort((a, b) => b.stringNo - a.stringNo)
  const { left: leftCount } = splitCounts(ordered.length, usesCloverPegs(config))
  const left = ordered.slice(0, leftCount).reverse()
  const right = ordered.slice(leftCount)

  const slots: PegSlot[] = [
    ...left.map((string, row) => ({ string, side: 'left' as const, row })),
    ...right.map((string, row) => ({ string, side: 'right' as const, row })),
  ]

  if (banjoFifth) {
    slots.push({ string: banjoFifth, side: 'fifth', row: 0 })
  }

  return slots
}

export function splitCounts(
  count: number,
  bass = false,
): { left: number; right: number } {
  if (count <= 0) return { left: 0, right: 0 }
  if (count === 1) return { left: 1, right: 0 }
  if (count === 2) return { left: 1, right: 1 }
  if (count === 3) return { left: 2, right: 1 }
  if (count === 4) return { left: 2, right: 2 }
  if (count === 5) return bass ? { left: 2, right: 3 } : { left: 3, right: 2 }
  if (count === 6) return { left: 3, right: 3 }
  if (count === 7) return { left: 4, right: 3 }
  if (count === 8) return { left: 4, right: 4 }
  if (count === 9) return { left: 5, right: 4 }
  if (count === 10) return { left: 5, right: 5 }
  const left = Math.ceil(count / 2)
  return { left, right: count - left }
}

export function pegLetter(
  string: InstrumentString,
  all: readonly InstrumentString[],
): string {
  if (string.pegLabel) return string.pegLabel
  const same = all.filter((item) => item.label === string.label)
  if (same.length < 2) return string.label
  // Only the 1st string is the high-e convention. A 7-string keeps both B pegs as B.
  if (string.stringNo === 1) return string.label.toLowerCase()
  return string.label
}
