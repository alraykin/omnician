import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { HAT_CHOKE_SEC, nextHatChokeTime } from '../src/lib/hat-choke.ts'

assert.ok(HAT_CHOKE_SEC >= 0.01 && HAT_CHOKE_SEC <= 0.02, 'choke fade stays in the 10–20ms click-free window')
assert.equal(nextHatChokeTime(0, [0.5]), 0.5)
assert.equal(nextHatChokeTime(0, [0.25, 0.5]), 0.25)
assert.equal(nextHatChokeTime(0.5, [0.25]), null, 'a closed hit before the open must not mute it')
assert.equal(nextHatChokeTime(1, [1]), 1, 'same-time closed still chokes the open')
assert.equal(nextHatChokeTime(0, []), null)

const voiceOrderClosedFirst = [0.5]
assert.equal(
  nextHatChokeTime(0, voiceOrderClosedFirst),
  0.5,
  'closed can be scheduled before the open and still choke it',
)

const audioSrc = readFileSync(new URL('../src/lib/rhythm-audio.ts', import.meta.url), 'utf8')
assert.match(audioSrc, /HAT_CHOKE_SEC/)
assert.match(audioSrc, /nextHatChokeTime/)
assert.match(audioSrc, /chokeOpenHats/)
assert.match(audioSrc, /closedHatTimes/)
assert.match(audioSrc, /time <= 0 \? this\.ctx\.currentTime/)
assert.doesNotMatch(audioSrc, /CHOKE_HAT_VOICES/)

console.log('hat-choke: ok')
