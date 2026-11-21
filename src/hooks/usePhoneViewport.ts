import { useSyncExternalStore } from 'react'

import {
  readCompactViewport,
  readDrumEditorOpen,
  readPhoneDrumsSurface,
  readPhoneViewport,
  readPortraitViewport,
  subscribeDrumEditorOpen,
  subscribePhoneDrumsSurface,
  subscribeViewport,
} from '@/lib/phone-viewport'

export function usePhoneViewport(): boolean {
  return useSyncExternalStore(subscribeViewport, readPhoneViewport, () => false)
}

export function useCompactViewport(): boolean {
  return useSyncExternalStore(subscribeViewport, readCompactViewport, () => false)
}

export function usePortraitViewport(): boolean {
  return useSyncExternalStore(subscribeViewport, readPortraitViewport, () => true)
}

export function useDrumEditorOpen(): boolean {
  return useSyncExternalStore(subscribeDrumEditorOpen, readDrumEditorOpen, () => false)
}

export function usePhoneDrumsSurface(): boolean {
  return useSyncExternalStore(subscribePhoneDrumsSurface, readPhoneDrumsSurface, () => false)
}
