export type Sensitivity = 'low' | 'medium' | 'high'

export type SensitivitySettings = {
  inTuneCents: number
  smoothPrev: number
  smoothNext: number
  minClarity: number
  minRms: number
  holdMs: number
  jumpSemitones: number
}

export const SENSITIVITY: Record<Sensitivity, SensitivitySettings> = {
  low: {
    inTuneCents: 12,
    smoothPrev: 0.82,
    smoothNext: 0.18,
    minClarity: 0.78,
    minRms: 0.006,
    holdMs: 280,
    jumpSemitones: 1.1,
  },
  medium: {
    inTuneCents: 8,
    smoothPrev: 0.7,
    smoothNext: 0.3,
    minClarity: 0.84,
    minRms: 0.008,
    holdMs: 180,
    jumpSemitones: 0.7,
  },
  high: {
    inTuneCents: 5,
    smoothPrev: 0.48,
    smoothNext: 0.52,
    minClarity: 0.9,
    minRms: 0.011,
    holdMs: 90,
    jumpSemitones: 0.45,
  },
}

export const SENSITIVITY_HELP: Record<Sensitivity, string> = {
  low: 'Wider green window and a calmer needle — good for first passes.',
  medium: 'Everyday setting: balanced window and update speed.',
  high: 'Tighter green window and quicker updates — for fine tuning.',
}
