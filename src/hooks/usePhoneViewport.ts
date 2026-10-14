import { useSyncExternalStore } from 'react'

import {
  readPhoneViewport,
  readPortraitViewport,
  subscribeViewport,
} from '@/lib/phone-viewport'

export function usePhoneViewport(): boolean {
  return useSyncExternalStore(subscribeViewport, readPhoneViewport, () => false)
}

export function usePortraitViewport(): boolean {
  return useSyncExternalStore(subscribeViewport, readPortraitViewport, () => true)
}
