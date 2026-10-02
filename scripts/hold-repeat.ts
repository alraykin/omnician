import assert from 'node:assert/strict'

import {
  HOLD_COARSE_AFTER_MS,
  HOLD_COARSE_STEP,
  HOLD_FAST_AFTER_MS,
  HOLD_INTERVAL_FAST_MS,
  HOLD_INTERVAL_START_MS,
  holdRepeatIntervalMs,
  holdRepeatStep,
} from '../src/lib/hold-repeat.ts'

assert.equal(holdRepeatIntervalMs(0), HOLD_INTERVAL_START_MS)
assert.equal(holdRepeatIntervalMs(HOLD_FAST_AFTER_MS - 1), HOLD_INTERVAL_START_MS)
assert.equal(holdRepeatIntervalMs(HOLD_FAST_AFTER_MS), HOLD_INTERVAL_FAST_MS)
assert.equal(holdRepeatIntervalMs(4000), HOLD_INTERVAL_FAST_MS)

assert.equal(holdRepeatStep(0, 1), 1)
assert.equal(holdRepeatStep(HOLD_COARSE_AFTER_MS - 1, 1), 1)
assert.equal(holdRepeatStep(HOLD_COARSE_AFTER_MS, 1), HOLD_COARSE_STEP)
assert.equal(holdRepeatStep(0, 5), 5)
assert.equal(holdRepeatStep(HOLD_COARSE_AFTER_MS, 5), 5, 'already-coarse tap stays 5')

console.log('hold-repeat: ok')
