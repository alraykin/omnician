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
    smoothPrev: 0.78,
    smoothNext: 0.22,
    minClarity: 0.74,
    minRms: 0.005,
    holdMs: 280,
    jumpSemitones: 1.1,
  },
  medium: {
    inTuneCents: 8,
    smoothPrev: 0.62,
    smoothNext: 0.38,
    minClarity: 0.82,
    minRms: 0.007,
    holdMs: 180,
    jumpSemitones: 0.7,
  },
  high: {
    inTuneCents: 5,
    smoothPrev: 0.35,
    smoothNext: 0.65,
    minClarity: 0.88,
    minRms: 0.01,
    holdMs: 90,
    jumpSemitones: 0.45,
  },
}

export const SENSITIVITY_HELP: Record<Sensitivity, string> = {
  low: 'Wider green window and a calmer needle — good for first passes.',
  medium: 'Everyday setting: balanced window and update speed.',
  high: 'Tighter green window and quicker updates — for fine tuning.',
}
