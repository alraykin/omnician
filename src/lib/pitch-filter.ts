/** Fixed pre-filters for pitch: DC block, 6 Hz high-pass, 3.6 kHz low-pass. No AGC. */

export const HP_HZ = 6
export const LP_HZ = 3600

export type Biquad = {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
  x1: number
  x2: number
  y1: number
  y2: number
}

export type DcBlock = {
  r: number
  x1: number
  y1: number
}

export type PitchFilter = {
  dc: DcBlock
  hp: Biquad
  lp: Biquad
}

function rbj(type: 'highpass' | 'lowpass', freq: number, q: number, sampleRate: number): Biquad {
  const w0 = (2 * Math.PI * freq) / sampleRate
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  const alpha = sin / (2 * q)
  let b0: number
  let b1: number
  let b2: number
  const a0 = 1 + alpha
  const a1 = -2 * cos
  const a2 = 1 - alpha
  if (type === 'highpass') {
    b0 = (1 + cos) / 2
    b1 = -(1 + cos)
    b2 = (1 + cos) / 2
  } else {
    b0 = (1 - cos) / 2
    b1 = 1 - cos
    b2 = (1 - cos) / 2
  }
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
  }
}

export function createPitchFilter(sampleRate: number): PitchFilter {
  return {
    dc: { r: 0.999, x1: 0, y1: 0 },
    hp: rbj('highpass', HP_HZ, 0.7071, sampleRate),
    lp: rbj('lowpass', LP_HZ, 0.7071, sampleRate),
  }
}

function tickBiquad(f: Biquad, x: number): number {
  const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2
  f.x2 = f.x1
  f.x1 = x
  f.y2 = f.y1
  f.y1 = y
  return y
}

function tickDc(f: DcBlock, x: number): number {
  const y = x - f.x1 + f.r * f.y1
  f.x1 = x
  f.y1 = y
  return y
}

export function filterSample(state: PitchFilter, x: number): number {
  return tickBiquad(state.lp, tickBiquad(state.hp, tickDc(state.dc, x)))
}

export function filterBuffer(input: ArrayLike<number>, sampleRate: number, out?: Float32Array): Float32Array {
  const dest = out && out.length === input.length ? out : new Float32Array(input.length)
  const state = createPitchFilter(sampleRate)
  for (let i = 0; i < input.length; i += 1) dest[i] = filterSample(state, input[i])
  return dest
}
