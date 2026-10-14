import { type InputDivision } from '@/lib/beat-boxes'
import { barDurationSec, type RhythmBar } from '@/lib/rhythm'

/** Slot width in the landscape editor \u2014 tappable, never wraps to a second row. */
export const EDITOR_SLOT_PX = 22
export const EDITOR_BEAT_CHROME_PX = 8

export function editorBeatWidthPx(input: InputDivision): number {
  return Math.max(56, input * EDITOR_SLOT_PX + EDITOR_BEAT_CHROME_PX)
}

export function editorBarWidthPx(beats: number, input: InputDivision): number {
  return Math.max(1, beats) * editorBeatWidthPx(input)
}

export function editorPatternWidthPx(bars: readonly RhythmBar[], input: InputDivision): number {
  return bars.reduce((sum, bar) => sum + editorBarWidthPx(bar.beats, input), 0)
}

export function editorBarOffsetsPx(bars: readonly RhythmBar[], input: InputDivision): number[] {
  const offsets: number[] = []
  let x = 0
  for (const bar of bars) {
    offsets.push(x)
    x += editorBarWidthPx(bar.beats, input)
  }
  return offsets
}

/** 0\u20131 through the sounding bar, after output latency. */
export function fracInBar(opts: {
  audioTime: number
  barStart: number
  barDur: number
  outputLatency: number
  precount: boolean
  playing: boolean
}): number {
  if (!opts.playing || opts.precount || !(opts.barDur > 0)) return 0
  const raw = (opts.audioTime - opts.outputLatency - opts.barStart) / opts.barDur
  if (!Number.isFinite(raw)) return 0
  return Math.min(1, Math.max(0, raw))
}

export function playheadOffsetPx(opts: {
  bars: readonly RhythmBar[]
  input: InputDivision
  barIndex: number
  frac: number
}): number {
  const offsets = editorBarOffsetsPx(opts.bars, opts.input)
  const start = offsets[opts.barIndex] ?? 0
  const bar = opts.bars[opts.barIndex]
  const width = bar ? editorBarWidthPx(bar.beats, opts.input) : 0
  return start + Math.min(1, Math.max(0, opts.frac)) * width
}

export function followPlayheadScroll(opts: {
  scrollLeft: number
  clientWidth: number
  playheadX: number
  padding?: number
}): number | null {
  const pad = opts.padding ?? 48
  const left = opts.scrollLeft + pad
  const right = opts.scrollLeft + opts.clientWidth - pad * 1.6
  if (opts.playheadX >= left && opts.playheadX <= right) return null
  const next = opts.playheadX - opts.clientWidth * 0.38
  return Math.max(0, next)
}

export function barDurationAt(bars: readonly RhythmBar[], index: number, bpm: number): number {
  const bar = bars[index]
  if (!bar) return 0
  return barDurationSec(bar.beats, bpm, bar.beatUnit)
}
