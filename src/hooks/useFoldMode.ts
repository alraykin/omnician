import { useMemo, useSyncExternalStore } from 'react'

import { usePhoneViewport } from '@/hooks/usePhoneViewport'
import {
  canUseFoldLayout,
  detectFoldedLayout,
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
  return layoutForTool(layout, tool)
}

export function useFoldHeaderVisible(): boolean {
  const phone = usePhoneViewport()
  const size = useSyncExternalStore(subscribeViewport, readSize, () => EMPTY_SIZE)
  return useMemo(
    () => !phone && canUseFoldLayout(size.width, size.height),
    [phone, size.height, size.width],
  )
}
