/** iPhone Duo fold layouts. Automatic unless `?fold=` overrides for QA. */

import { isNativeApp } from '@/lib/native-origin'
import { readNativeFoldLayout, readNativePosture, subscribeNativePosture } from '@/lib/native-fold'

export const FOLD_STORAGE_KEY = 'omnician.fold-mode.v1'
/** Inner Duo shortest side is ~626pt; outer cover is ~466pt. */
export const FOLD_MIN_SIDE_PX = 600
export const FOLD_DEAD_PX = 16
export const FOLD_CREASE = 512
export const FOLD_GRID_ROWS = 14
export const FOLD_GRID_COUNT_H = 16
export const FOLD_GRID_FLOOR_H = 1
export const FOLD_GRID_ROW_MIN = 22
export const FOLD_STATUS_RIGHT_PX = 88
export const FOLD_PEG_H = 72
export const FOLD_LAPTOP = { width: 626, height: 890 } as const
export const FOLD_BOOK = { width: 890, height: 626 } as const
export const FOLD_STATUS_PORTRAIT = { x: 496, y: 0, w: 224, h: 88 } as const
export const FOLD_STATUS_LANDSCAPE = { x: 936, y: 0, w: 88, h: 260 } as const
export const FOLD_STATUS_TENT_A = { x: 496, y: 0, w: 224, h: 80 } as const

export const FOLD_CHOICES = ['off', 'auto', 'laptop', 'book', 'tent'] as const
export type FoldChoice = (typeof FOLD_CHOICES)[number]
export type FoldLayout = 'off' | 'laptop' | 'book' | 'tent'
export type FoldTool = 'click' | 'drums' | 'tuner'

export const FOLD_CHOICE_LABELS: Record<FoldChoice, string> = {
  off: 'Off',
  auto: 'Auto',
  laptop: 'Laptop',
  book: 'Book',
  tent: 'Tent',
}

export const FOLD_INNER_CHOICES = ['laptop', 'book'] as const
export const FOLD_COVER_CHOICES = ['off', 'auto', 'tent'] as const

export type ViewportSegmentBox = {
  x: number
  y: number
  width: number
  height: number
}

export type FoldDetectInput = {
  segments?: ViewportSegmentBox[] | null
  horizontalSegments?: number
  verticalSegments?: number
  posture?: string | null
  width?: number
  height?: number
}

const listeners = new Set<() => void>()
let choice: FoldChoice = 'auto'
let loaded = false

export function isFoldChoice(value: unknown): value is FoldChoice {
  return typeof value === 'string' && (FOLD_CHOICES as readonly string[]).includes(value)
}

export function parseFoldChoice(value: unknown): FoldChoice {
  return isFoldChoice(value) ? value : 'off'
}

function readQueryChoice(): FoldChoice | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = new URLSearchParams(window.location.search).get('fold')
    if (raw == null || raw === '') return null
    return parseFoldChoice(raw)
  } catch {
    return null
  }
}

export function loadFoldChoice(): FoldChoice {
  return readQueryChoice() ?? 'auto'
}

export function saveFoldChoice(next: FoldChoice): FoldChoice {
  const value = parseFoldChoice(next)
  if (loaded && choice === value) return value
  choice = value
  loaded = true
  listeners.forEach((fn) => fn())
  return value
}

export function readFoldChoice(): FoldChoice {
  if (!loaded) {
    choice = loadFoldChoice()
    loaded = true
  }
  return choice
}

export function subscribeFoldChoice(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

export function innerFoldAvailable(width: number, height: number): boolean {
  return canUseFoldLayout(width, height)
}

export function foldChoicesForSize(width: number, height: number): readonly FoldChoice[] {
  return innerFoldAvailable(width, height) ? FOLD_CHOICES : FOLD_COVER_CHOICES
}

export function cycleFoldChoice(current: FoldChoice, allowInner = true): FoldChoice {
  const list: readonly FoldChoice[] = allowInner ? FOLD_CHOICES : FOLD_COVER_CHOICES
  const index = list.indexOf(current)
  if (index < 0) return list[0] ?? 'off'
  return list[(index + 1) % list.length] ?? 'off'
}

function matchCount(query: string): number {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 0
    if (window.matchMedia(query).matches) return 2
  } catch {
    /* never throw */
  }
  return 0
}

function readPosture(): string | null {
  try {
    const posture = (navigator as Navigator & { devicePosture?: { type?: string } }).devicePosture
    return typeof posture?.type === 'string' ? posture.type : null
  } catch {
    return null
  }
}

function readSegments(): ViewportSegmentBox[] | null {
  try {
    const viewport = (window as Window & { viewport?: { segments?: ViewportSegmentBox[] } }).viewport
    const visual = window.visualViewport as (VisualViewport & { segments?: ViewportSegmentBox[] }) | null
    const raw = viewport?.segments ?? visual?.segments
    if (!Array.isArray(raw) || raw.length < 2) return null
    return raw.map((seg) => ({
      x: Number(seg.x) || 0,
      y: Number(seg.y) || 0,
      width: Number(seg.width) || 0,
      height: Number(seg.height) || 0,
    }))
  } catch {
    return null
  }
}

/** Cover / outer / phone landscape — Click uses Tent instead of rotate-back. */
export function isCoverLandscape(width: number, height: number): boolean {
  return width > height && !canUseFoldLayout(width, height)
}

function readViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 0, height: 0 }
  return { width: window.innerWidth, height: window.innerHeight }
}

/** Vertical (stacked) segments => Laptop. Horizontal (side by side) => Book. Small landscape => Tent. */
export function detectFoldedLayout(input?: FoldDetectInput): FoldLayout {
  try {
    if (isNativeApp() && readNativePosture()) return readNativeFoldLayout()
    const size = readViewportSize()
    const width = input?.width ?? size.width
    const height = input?.height ?? size.height
    const segments = input?.segments === undefined ? readSegments() : input.segments
    const vertical =
      input?.verticalSegments ??
      matchCount('(vertical-viewport-segments: 2)')
    const horizontal =
      input?.horizontalSegments ??
      matchCount('(horizontal-viewport-segments: 2)')
    const posture = input?.posture === undefined ? readPosture() : input.posture

    if (vertical >= 2) return 'laptop'
    if (horizontal >= 2) return 'book'
    if (segments && segments.length >= 2) {
      const [a, b] = segments
      if (a && b) {
        const stacked = Math.abs(a.x - b.x) < 8 && Math.abs(a.y - b.y) > 8
        const sideBySide = Math.abs(a.y - b.y) < 8 && Math.abs(a.x - b.x) > 8
        if (stacked) return 'laptop'
        if (sideBySide) return 'book'
      }
    }
    if (isCoverLandscape(width, height)) return 'tent'
    // Folded without segments is ambiguous (laptop / book). Do not guess.
    if (posture === 'folded') return 'off'
    return 'off'
  } catch {
    return 'off'
  }
}

export function canUseFoldLayout(width: number, height: number): boolean {
  return Math.min(width, height) >= FOLD_MIN_SIDE_PX
}

export function resolveFoldLayout(
  current: FoldChoice,
  width: number,
  height: number,
  detected: FoldLayout = detectFoldedLayout({ width, height }),
): FoldLayout {
  if (current === 'off') return 'off'
  if (current === 'tent') return 'tent'
  if (current === 'laptop' || current === 'book') {
    return canUseFoldLayout(width, height) ? current : 'off'
  }
  if (detected === 'laptop' || detected === 'book') {
    return canUseFoldLayout(width, height) ? detected : isCoverLandscape(width, height) ? 'tent' : 'off'
  }
  if (detected === 'tent' || isCoverLandscape(width, height)) return 'tent'
  return 'off'
}

/** Click Tent is a single landscape cover view, never a split inner-screen pose. */
export function clickShowsTent(layout: FoldLayout, portrait: boolean): boolean {
  return layout === 'tent' && !portrait
}

/** Unfolded inner landscape always uses Tuner Book, including Fold mode Off. */
export function tunerShowsBook(width: number, height: number): boolean {
  return canUseFoldLayout(width, height) && width > height
}

/** A global fold choice only remaps the tools that have a mockup for that pose. */
export function layoutForTool(
  layout: FoldLayout,
  tool: FoldTool,
  width = 0,
  height = 0,
): FoldLayout {
  if (tool === 'tuner') {
    if (layout === 'laptop' && canUseFoldLayout(width, height) && height >= width) return 'laptop'
    if (tunerShowsBook(width, height) || isCoverLandscape(width, height)) return 'book'
    return 'off'
  }
  if (layout === 'off') return 'off'
  if (tool === 'drums' && layout === 'laptop') return 'laptop'
  if (tool === 'click' && (layout === 'laptop' || layout === 'tent')) return layout
  return 'off'
}

/** Top-half grid area: crease minus the 16px dead zone, minus the meta row. */
export function foldLaptopGridMetrics(viewportHeight: number, metaHeight: number) {
  const crease = viewportHeight / 2
  const available = Math.max(0, crease - FOLD_DEAD_PX - Math.max(0, metaHeight))
  const row = (available - FOLD_GRID_COUNT_H - FOLD_GRID_FLOOR_H) / FOLD_GRID_ROWS
  return { crease, available, row, fitsMin: row + 1e-6 >= FOLD_GRID_ROW_MIN }
}

/** Peg row sits above the home indicator, not at a 720-tall y=624. */
export function foldBookPegBottom(safeBottom: number, extra = 12) {
  return Math.max(extra, safeBottom)
}

/** ±50¢ maps across the 816px book scale (408px each side of the crease). */
export const FOLD_NEEDLE_REACH_PX = 408

export function foldNeedleX(cents: number): number {
  return (Math.max(-50, Math.min(50, cents)) / 50) * FOLD_NEEDLE_REACH_PX
}

/** Hide the needle in the 16px crease except exactly in-tune (or passing through 0¢). */
export function foldNeedleHidden(cents: number | null, inTune: boolean): boolean {
  if (cents === null) return false
  if (inTune || Math.abs(cents) < 0.05) return false
  return Math.abs(foldNeedleX(cents)) < FOLD_DEAD_PX
}

/**
 * Traditional pendulum: one extreme-to-extreme swing per beat.
 * +1 = left, −1 = right. Ticks land at each extreme (integer beat times).
 *
 * `beatPhase` is monotonic elapsed beats (0, 1, 2, …), not a 0–1 bar fraction.
 * Wrapping a 1-beat bar’s fraction maps 0.999 → 0 and snaps −1 → +1.
 */
export function pendulumNormFromBeatPhase(beatPhase: number): number {
  if (!Number.isFinite(beatPhase)) return 0
  return Math.cos(Math.PI * beatPhase)
}

export function pendulumBeatPhase(
  audioTime: number,
  originAudioTime: number,
  originBeatPhase: number,
  beatSec: number,
): number {
  if (!(beatSec > 0) || !Number.isFinite(audioTime) || !Number.isFinite(originAudioTime)) {
    return originBeatPhase
  }
  return originBeatPhase + (audioTime - originAudioTime) / beatSec
}

export function rebasePendulumClock(
  now: number,
  originAudioTime: number,
  originBeatPhase: number,
  oldBeatSec: number,
  newBeatSec: number,
): { originAudioTime: number; originBeatPhase: number; beatSec: number } {
  const phase = pendulumBeatPhase(now, originAudioTime, originBeatPhase, oldBeatSec)
  return { originAudioTime: now, originBeatPhase: phase, beatSec: newBeatSec }
}

/** Within-bar helper. Prefer `pendulumNormFromBeatPhase` for motion (no bar wrap). */
export function pendulumNorm(barFrac: number, beats: number): number {
  const n = Math.max(1, Math.floor(beats) || 1)
  const phase = ((barFrac % 1) + 1) % 1
  return pendulumNormFromBeatPhase(phase * n)
}

export function pendulumBeatIndex(barFrac: number, beats: number): number {
  const n = Math.max(1, Math.floor(beats) || 1)
  const phase = ((barFrac % 1) + 1) % 1
  return Math.min(n - 1, Math.floor(phase * n))
}

export function pendulumBeatIndexFromPhase(beatPhase: number, beats: number): number {
  const n = Math.max(1, Math.floor(beats) || 1)
  if (!Number.isFinite(beatPhase) || beatPhase < 0) return 0
  return ((Math.floor(beatPhase) % n) + n) % n
}

export function pendulumAtExtreme(norm: number, epsilon = 0.035): boolean {
  return Math.abs(Math.abs(norm) - 1) < epsilon
}

export const PENDULUM_STOP_TAU_SEC = 0.09

/** Ease `from` toward center (0). tau is a time constant in seconds. */
export function easePendulumToCenter(from: number, dtSec: number, tau = PENDULUM_STOP_TAU_SEC): number {
  if (!Number.isFinite(from)) return 0
  if (!(dtSec > 0) || !(tau > 0)) return 0
  const next = from * Math.exp(-dtSec / tau)
  return Math.abs(next) < 0.008 ? 0 : next
}

export function splitPegs<T>(pegs: readonly T[]): { left: T[]; right: T[] } {
  const cut = Math.floor(pegs.length / 2)
  return { left: pegs.slice(0, cut), right: pegs.slice(cut) }
}

export function subscribeFoldHardware(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const on = () => onChange()
  window.addEventListener('resize', on)
  window.addEventListener('orientationchange', on)
  const visual = window.visualViewport
  visual?.addEventListener('resize', on)
  const nativeUnsub = subscribeNativePosture(on)
  const mqVert = (() => {
    try {
      return window.matchMedia('(vertical-viewport-segments: 2)')
    } catch {
      return null
    }
  })()
  const mqHoriz = (() => {
    try {
      return window.matchMedia('(horizontal-viewport-segments: 2)')
    } catch {
      return null
    }
  })()
  mqVert?.addEventListener('change', on)
  mqHoriz?.addEventListener('change', on)
  const posture = (navigator as Navigator & {
    devicePosture?: EventTarget & { addEventListener?: (type: string, fn: () => void) => void }
  }).devicePosture
  try {
    posture?.addEventListener?.('change', on)
  } catch {
    /* optional */
  }
  return () => {
    window.removeEventListener('resize', on)
    window.removeEventListener('orientationchange', on)
    visual?.removeEventListener('resize', on)
    mqVert?.removeEventListener('change', on)
    mqHoriz?.removeEventListener('change', on)
    nativeUnsub()
    try {
      posture?.removeEventListener?.('change', on)
    } catch {
      /* optional */
    }
  }
}
