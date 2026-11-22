import { useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'

import { isCoverPortraitRail, isDuoOuterDisplay } from '@/lib/duo-layout'
import { subscribeNativePosture } from '@/lib/native-fold'
import { subscribeViewport } from '@/lib/phone-viewport'

function subscribe(onChange: () => void): () => void {
  const a = subscribeViewport(onChange)
  const b = subscribeNativePosture(onChange)
  const onPop = () => onChange()
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', onPop)
  }
  return () => {
    a()
    b()
    if (typeof window !== 'undefined') window.removeEventListener('popstate', onPop)
  }
}

function read(): boolean {
  if (typeof window === 'undefined') return false
  return isCoverPortraitRail(window.innerWidth, window.innerHeight)
}

export function useCoverPortraitRail(): boolean {
  const location = useLocation()
  const rail = useSyncExternalStore(subscribe, read, () => false)
  void location.search
  void location.pathname
  return rail
}

function readOuter(): boolean {
  return isDuoOuterDisplay()
}

export function useDuoOuterDisplay(): boolean {
  const location = useLocation()
  const outer = useSyncExternalStore(subscribe, readOuter, () => false)
  void location.search
  void location.pathname
  return outer
}
