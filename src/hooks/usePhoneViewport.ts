import { useSyncExternalStore } from 'react'

import {
  readDrumEditorOpen,
  readPhoneViewport,
  readPortraitViewport,
  subscribeDrumEditorOpen,
  subscribeViewport,
} from '@/lib/phone-viewport'

export function usePhoneViewport(): boolean {
  return useSyncExternalStore(subscribeViewport, readPhoneViewport, () => false)
}

export function usePortraitViewport(): boolean {
  return useSyncExternalStore(subscribeViewport, readPortraitViewport, () => true)
}

export function useDrumEditorOpen(): boolean {
  return useSyncExternalStore(subscribeDrumEditorOpen, readDrumEditorOpen, () => false)
}
