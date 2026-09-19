import { PitchDetector } from 'pitchy'

export const PITCH_BUFFER_SIZE = 8192

export type PitchEstimate = {
  frequency: number
  clarity: number
}

export function createPitchDetector(): PitchDetector<Float32Array> {
  return PitchDetector.forFloat32Array(PITCH_BUFFER_SIZE)
}

export function estimatePitch(
  detector: PitchDetector<Float32Array>,
  buffer: Float32Array,
  sampleRate: number,
): PitchEstimate {
  const [frequency, clarity] = detector.findPitch(buffer, sampleRate)
  return { frequency, clarity }
}
