import { useEffect, useState } from 'react'

import { A4_HZ } from '@/lib/notes'
import {
  getTunerSnapshot,
  setTunerA4,
  startTuner,
  stopTuner,
  subscribeTuner,
  type TunerReading,
  type TunerSnapshot,
  type TunerStatus,
} from '@/lib/tuner-session'

export type { TunerReading, TunerStatus }

export function useTuner(a4Hz = A4_HZ) {
  const [state, setState] = useState<TunerSnapshot>(getTunerSnapshot)

  useEffect(() => {
    setTunerA4(a4Hz)
  }, [a4Hz])

  useEffect(() => subscribeTuner(setState), [])

  return {
    status: state.status,
    reading: state.reading,
    needsGesture: state.needsGesture,
    start: () => startTuner({ fromGesture: true }),
    stop: stopTuner,
  }
}
