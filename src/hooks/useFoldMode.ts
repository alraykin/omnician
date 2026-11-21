import { useMemo, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'

import {
  canUseFoldLayout,
  detectFoldedLayout,
  innerFoldAvailable,
  layoutForTool,
  readFoldChoice,
  resolveFoldLayout,
  subscribeFoldChoice,
  subscribeFoldHardware,
  type FoldChoice,
  type FoldLayout,
  type FoldTool,
} from '@/lib/fold-mode'
import { subscribeViewport } from '@/lib/phone-viewport'

function subscribeAll(onChange: () => void): () => void {
  const a = subscribeFoldChoice(onChange)
  const b = subscribeFoldHardware(onChange)
  const c = subscribeViewport(onChange)
  return () => {
    a()
    b()
    c()
  }
}

const EMPTY_SIZE = { width: 0, height: 0 }
let cachedSize = EMPTY_SIZE

function readSize() {
  if (typeof window === 'undefined') return EMPTY_SIZE
  const width = window.innerWidth
  const height = window.innerHeight
  if (cachedSize.width === width && cachedSize.height === height) return cachedSize
  cachedSize = { width, height }
  return cachedSize
}

export function useFoldChoice(): FoldChoice {
  return useSyncExternalStore(subscribeFoldChoice, readFoldChoice, () => 'off')
}

export function useFoldHardware(): FoldLayout {
  return useSyncExternalStore(subscribeAll, detectFoldedLayout, () => 'off')
}

export function useFoldLayout(): FoldLayout {
  const choice = useFoldChoice()
  const detected = useFoldHardware()
  const size = useSyncExternalStore(subscribeViewport, readSize, () => EMPTY_SIZE)
  return resolveFoldLayout(choice, size.width, size.height, detected)
}

export function useToolFoldLayout(tool: FoldTool): FoldLayout {
  const layout = useFoldLayout()
  const size = useSyncExternalStore(subscribeViewport, readSize, () => EMPTY_SIZE)
  return layoutForTool(layout, tool, size.width, size.height)
}

export function useInnerFoldAvailable(): boolean {
  const size = useSyncExternalStore(subscribeViewport, readSize, () => EMPTY_SIZE)
  return innerFoldAvailable(size.width, size.height)
}

export function useFoldHeaderVisible(): boolean {
  const location = useLocation()
  const size = useSyncExternalStore(subscribeViewport, readSize, () => EMPTY_SIZE)
  return useMemo(() => {
    if (location.pathname.startsWith('/click')) return true
    return (
      (location.pathname.startsWith('/tuner') || location.pathname.startsWith('/drums')) &&
      canUseFoldLayout(size.width, size.height)
    )
  }, [location.pathname, size.height, size.width])
}
