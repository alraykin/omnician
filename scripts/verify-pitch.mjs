import { PitchDetector } from 'pitchy'

const A4 = 440
const SIZE = 8192
const RATE = 44100

function sine(freq, n, rate) {
  const buffer = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    buffer[i] = Math.sin((2 * Math.PI * freq * i) / rate)
  }
  return buffer
}

function freqToMidi(frequency) {
  return 69 + 12 * Math.log2(frequency / A4)
}

const cases = [
  ['A4', 440],
  ['E2 guitar', 82.4068892282175],
  ['G3 guitar', 195.99771799087463],
  ['E4 guitar', 329.6275569128699],
  ['E1 bass', 41.20344461410875],
  ['A#4', 466.1637615180899],
]

const detector = PitchDetector.forFloat32Array(SIZE)
let failed = 0

for (const [label, hz] of cases) {
  const [detected, clarity] = detector.findPitch(sine(hz, SIZE, RATE), RATE)
  const cents = (freqToMidi(detected) - freqToMidi(hz)) * 100
  const ok = Math.abs(cents) < 8 && clarity > 0.9
  if (!ok) failed += 1
  console.log(
    `${ok ? 'ok' : 'FAIL'}  ${label.padEnd(12)} expected ${hz.toFixed(2)} Hz  got ${detected.toFixed(2)} Hz  ${cents.toFixed(2)} cents  clarity ${clarity.toFixed(3)}`,
  )
}

if (failed) {
  console.error(`\n${failed} pitch check(s) failed`)
  process.exit(1)
}

console.log('\nAll synthetic pitch checks passed.')
