import { clampBpm, type RhythmMode } from '@/lib/rhythm'

export const MIN_SB_PCT = 10
export const MAX_SB_PCT = 200
export const MIN_SB_STEP = 1
export const MAX_SB_STEP = 100
export const MIN_SB_REPEATS = 1
export const MAX_SB_REPEATS = 32

export type SpeedBuilder = {
  enabled: boolean
  fromPct: number
  toPct: number
  stepPct: number
  repeats: number
  precount: boolean
  announce: boolean
}

export type SpeedBuilderCue = {
  pct: number
  bpm: number
  reason: 'start' | 'step' | 'goal'
}

export const DEFAULT_SPEED_BUILDER: SpeedBuilder = {
  enabled: false,
  fromPct: 70,
  toPct: 100,
  stepPct: 5,
  repeats: 1,
  precount: true,
  announce: false,
}

export function clampSbPct(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SPEED_BUILDER.fromPct
  return Math.min(MAX_SB_PCT, Math.max(MIN_SB_PCT, Math.round(value)))
}

export function clampSbStep(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SPEED_BUILDER.stepPct
  return Math.min(MAX_SB_STEP, Math.max(MIN_SB_STEP, Math.round(value)))
}

export function clampSbRepeats(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SPEED_BUILDER.repeats
  return Math.min(MAX_SB_REPEATS, Math.max(MIN_SB_REPEATS, Math.round(value)))
}

export function parseSpeedBuilder(raw: unknown): SpeedBuilder {
  const base = { ...DEFAULT_SPEED_BUILDER }
  if (!raw || typeof raw !== 'object') return base
  const row = raw as Partial<SpeedBuilder>
  return {
    enabled: row.enabled === true,
    fromPct: clampSbPct(typeof row.fromPct === 'number' ? row.fromPct : base.fromPct),
    toPct: clampSbPct(typeof row.toPct === 'number' ? row.toPct : base.toPct),
    stepPct: clampSbStep(typeof row.stepPct === 'number' ? row.stepPct : base.stepPct),
    repeats: clampSbRepeats(typeof row.repeats === 'number' ? row.repeats : base.repeats),
    precount: row.precount !== false,
    announce: row.announce === true,
  }
}

/** One shared Precount: Speed Builder starts/steps, or a normal Drums start. Never both. */
export function shouldStartPrecount(
  mode: RhythmMode,
  sb: Pick<SpeedBuilder, 'enabled' | 'precount'>,
): boolean {
  if (!sb.precount) return false
  return sb.enabled || mode === 'drums'
}

/** True after the current tempo has been played `repeats` full cycles, unless already at the goal. */
export function shouldStepAfterRepeats(completedAtTempo: number, repeats: number, atGoal: boolean): boolean {
  if (atGoal) return false
  return completedAtTempo >= clampSbRepeats(repeats)
}

export function sbBpm(baseBpm: number, pct: number): number {
  return clampBpm(Math.round((clampBpm(baseBpm) * clampSbPct(pct)) / 100))
}

export function nextSbPct(current: number, from: number, to: number, step: number): number {
  const now = clampSbPct(current)
  const start = clampSbPct(from)
  const goal = clampSbPct(to)
  const size = clampSbStep(step)
  if (now === goal) return goal
  const dir = goal > start ? 1 : goal < start ? -1 : 0
  if (dir === 0) return goal
  const next = now + dir * size
  return dir > 0 ? Math.min(goal, next) : Math.max(goal, next)
}

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
] as const

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const

export function percentWords(pct: number): string {
  const n = clampSbPct(pct)
  if (n < 20) return ONES[n]
  if (n < 100) {
    const ten = Math.floor(n / 10)
    const one = n % 10
    return one === 0 ? TENS[ten] : `${TENS[ten]}-${ONES[one]}`
  }
  if (n === 100) return 'one hundred'
  if (n === 200) return 'two hundred'
  const rest = n - 100
  return rest === 0 ? 'one hundred' : `one hundred ${percentWords(rest)}`
}

export function announceLine(pct: number): string {
  return `${percentWords(pct)} percent`
}

export function unlockSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    const synth = window.speechSynthesis
    const warm = new SpeechSynthesisUtterance(' ')
    warm.volume = 0
    warm.rate = 2
    synth.speak(warm)
    synth.cancel()
    const hold = new SpeechSynthesisUtterance(' ')
    hold.volume = 0
    hold.rate = 2
    synth.speak(hold)
  } catch {
    // Speech can fail before a gesture; ignore.
  }
}

export function speakPercent(pct: number): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const utter = new SpeechSynthesisUtterance(announceLine(pct))
    utter.rate = 1.02
    utter.pitch = 1
    utter.volume = 0.9
    utter.lang = 'en-US'
    synth.speak(utter)
  } catch {
    // Voice may be unavailable.
  }
}
