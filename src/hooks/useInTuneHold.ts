import { useEffect, useRef, useState } from 'react'

import { IN_TUNE_DECAY_MS, IN_TUNE_HOLD_MS } from '@/lib/feel'

export function useInTuneHold(
  inTune: boolean,
  live: boolean,
  targetId: string | null,
  onComplete: (id: string) => void,
) {
  const [progress, setProgress] = useState(0)
  const [complete, setComplete] = useState(false)
  const progressRef = useRef(0)
  const completeRef = useRef(false)
  const targetRef = useRef(targetId)
  const inTuneRef = useRef(inTune)
  const liveRef = useRef(live)
  const onCompleteRef = useRef(onComplete)

  inTuneRef.current = inTune
  liveRef.current = live
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (targetRef.current !== targetId) {
      targetRef.current = targetId
      progressRef.current = 0
      completeRef.current = false
      setProgress(0)
      setComplete(false)
    }
  }, [targetId])

  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(48, now - last)
      last = now
      const holding = liveRef.current && inTuneRef.current && targetRef.current
      let next = progressRef.current
      if (holding) {
        next = Math.min(1, next + dt / IN_TUNE_HOLD_MS)
      } else {
        next = Math.max(0, next - dt / IN_TUNE_DECAY_MS)
        if (next === 0 && completeRef.current) {
          completeRef.current = false
          setComplete(false)
        }
      }
      if (next !== progressRef.current) {
        progressRef.current = next
        setProgress(next)
      }
      if (holding && next >= 1 && !completeRef.current) {
        completeRef.current = true
        setComplete(true)
        const id = targetRef.current
        if (id) onCompleteRef.current(id)
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return { progress, complete }
}
