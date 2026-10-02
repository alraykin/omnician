import type { MouseEvent, PointerEvent } from 'react'

import { clampBpm, MAX_BPM, MIN_BPM } from '@/lib/rhythm'
import { cn } from '@/lib/utils'

/** First extra step after the pointer stays down. */
export const HOLD_INITIAL_DELAY_MS = 400
/** Repeat rate right after the delay. */
export const HOLD_INTERVAL_START_MS = 120
/** Repeat rate once the hold has been down about 1.5 s. */
export const HOLD_INTERVAL_FAST_MS = 40
export const HOLD_FAST_AFTER_MS = 1500
/** After this, a 1-BPM hold steps by 5. */
export const HOLD_COARSE_AFTER_MS = 3000
export const HOLD_COARSE_STEP = 5

export const HOLD_NUDGE_CLASS =
  'select-none [-webkit-user-select:none] [-webkit-touch-callout:none] [touch-action:manipulation]'

export function holdRepeatIntervalMs(heldMs: number): number {
  return heldMs >= HOLD_FAST_AFTER_MS ? HOLD_INTERVAL_FAST_MS : HOLD_INTERVAL_START_MS
}

export function holdRepeatStep(heldMs: number, tapStep: number): number {
  if (heldMs >= HOLD_COARSE_AFTER_MS) return Math.max(tapStep, HOLD_COARSE_STEP)
  return tapStep
}

type HoldRepeatOptions = {
  direction: 1 | -1
  tapStep?: number
  getValue: () => number
  setValue: (next: number) => void
  min?: number
  max?: number
}

let activeStop: (() => void) | null = null

function stopActive(): void {
  activeStop?.()
  activeStop = null
}

if (typeof window !== 'undefined') {
  window.addEventListener('blur', stopActive)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopActive()
  })
}

/**
 * Pointer-first +/− hold. One tap = one tapStep. Hold repeats, then speeds up.
 * Accumulates locally so React batches cannot collapse a burst to a single step.
 */
export function holdRepeatProps({
  direction,
  tapStep = 1,
  getValue,
  setValue,
  min = MIN_BPM,
  max = MAX_BPM,
}: HoldRepeatOptions) {
  const stopHold = () => {
    stopActive()
  }

  const startHold = () => {
    stopActive()
    let value = getValue()
    let timer = 0
    const startedAt = performance.now()

    const apply = (heldMs: number) => {
      const delta = holdRepeatStep(heldMs, tapStep) * direction
      const next = Math.min(max, Math.max(min, clampBpm(value + delta)))
      if (next === value) {
        stopActive()
        return false
      }
      value = next
      setValue(next)
      return true
    }

    const arm = (delay: number) => {
      timer = window.setTimeout(() => {
        if (activeStop !== stop) return
        if (!apply(performance.now() - startedAt)) return
        arm(holdRepeatIntervalMs(performance.now() - startedAt))
      }, delay)
    }

    const stop = () => {
      window.clearTimeout(timer)
      timer = 0
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      if (activeStop === stop) activeStop = null
    }

    activeStop = stop
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    apply(0)
    arm(HOLD_INITIAL_DELAY_MS)
  }

  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      startHold()
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      event.preventDefault()
      stopHold()
    },
    onPointerCancel: stopHold,
    onPointerLeave: stopHold,
    onContextMenu: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault()
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (event.detail !== 0) {
        event.preventDefault()
        return
      }
      const next = Math.min(max, Math.max(min, clampBpm(getValue() + tapStep * direction)))
      if (next !== getValue()) setValue(next)
    },
  }
}

export function mergeHoldRepeatClass(className?: string): string {
  return cn(HOLD_NUDGE_CLASS, className)
}
