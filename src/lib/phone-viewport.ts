/** Shortest side below this is a phone. iPhone Pro Max \u2248 430; iPad Mini \u2248 768. */
export const PHONE_SHORTEST_PX = 600

export function isPhoneViewport(width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) return false
  return Math.min(width, height) < PHONE_SHORTEST_PX
}

export function isPortraitViewport(width: number, height: number): boolean {
  return height >= width
}

export function readPhoneViewport(): boolean {
  if (typeof window === 'undefined') return false
  return isPhoneViewport(window.innerWidth, window.innerHeight)
}

export function readPortraitViewport(): boolean {
  if (typeof window === 'undefined') return true
  return isPortraitViewport(window.innerWidth, window.innerHeight)
}

export function subscribeViewport(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const on = () => onChange()
  window.addEventListener('resize', on)
  window.addEventListener('orientationchange', on)
  const visual = window.visualViewport
  visual?.addEventListener('resize', on)
  return () => {
    window.removeEventListener('resize', on)
    window.removeEventListener('orientationchange', on)
    visual?.removeEventListener('resize', on)
  }
}

export async function tryLockLandscape(): Promise<'locked' | 'unsupported'> {
  if (typeof screen === 'undefined') return 'unsupported'
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (lock: string) => Promise<void>
  }
  if (typeof orientation?.lock !== 'function') return 'unsupported'
  try {
    await orientation.lock('landscape')
    return 'locked'
  } catch {
    return 'unsupported'
  }
}

export function unlockOrientation() {
  try {
    screen.orientation?.unlock?.()
  } catch {
    /* iOS and some desktop browsers reject unlock */
  }
}
