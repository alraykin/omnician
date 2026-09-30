/** Hold inside ±1¢ this long before a peg sticks green for the session. */
export const STICKY_HOLD_MS = 1500

export function allStringsSticky(
  strings: readonly { id: string }[],
  tunedIds: ReadonlySet<string>,
): boolean {
  return strings.length > 0 && strings.every((item) => tunedIds.has(item.id))
}

export function seedTunedIds(
  strings: readonly { id: string; stringNo: number; label: string }[],
  raw: string | null,
): Set<string> {
  if (raw == null || raw === '') return new Set()
  if (raw === 'all') return new Set(strings.map((item) => item.id))
  const count = Number(raw)
  if (Number.isFinite(count) && count > 0 && !raw.includes(',')) {
    return new Set(strings.slice(0, Math.min(count, strings.length)).map((item) => item.id))
  }
  const wanted = new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  return new Set(
    strings
      .filter(
        (item) =>
          wanted.has(item.id) ||
          wanted.has(String(item.stringNo)) ||
          wanted.has(item.label),
      )
      .map((item) => item.id),
  )
}

export function parseFocusStringNo(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function indexForStringNo(
  strings: readonly { stringNo: number }[],
  stringNo: number | null,
): number | null {
  if (stringNo == null) return null
  const index = strings.findIndex((item) => item.stringNo === stringNo)
  return index >= 0 ? index : null
}
