import { useCallback, useState } from 'react'

import {
  createCustomId,
  loadCustomTunings,
  saveCustomTunings,
  type CustomTuning,
} from '@/lib/custom-presets'

export function useCustomTunings() {
  const [tunings, setTunings] = useState<CustomTuning[]>(() =>
    loadCustomTunings(),
  )

  const persist = useCallback((next: CustomTuning[]) => {
    setTunings(next)
    saveCustomTunings(next)
  }, [])

  const upsert = useCallback(
    (draft: { id?: string; name: string; midis: number[] }) => {
      const name = draft.name.trim().slice(0, 32)
      if (!name || draft.midis.length < 4 || draft.midis.length > 10) {
        return null
      }
      const id = draft.id ?? createCustomId()
      const entry: CustomTuning = { id, name, midis: draft.midis }
      const exists = tunings.some((item) => item.id === id)
      persist(
        exists
          ? tunings.map((item) => (item.id === id ? entry : item))
          : [...tunings, entry],
      )
      return id
    },
    [persist, tunings],
  )

  const remove = useCallback(
    (id: string) => {
      persist(tunings.filter((item) => item.id !== id))
    },
    [persist, tunings],
  )

  return { tunings, upsert, remove }
}
