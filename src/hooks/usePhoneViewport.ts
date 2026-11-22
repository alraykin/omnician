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

let sizeCache = { width: 0, height: 0 }

function readViewportSize() {
  if (typeof window === 'undefined') return sizeCache
  const width = window.innerWidth
  const height = window.innerHeight
  if (sizeCache.width === width && sizeCache.height === height) return sizeCache
  sizeCache = { width, height }
  return sizeCache
}

export function useViewportSize(): { width: number; height: number } {
  return useSyncExternalStore(subscribeViewport, readViewportSize, () => sizeCache)
}

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
