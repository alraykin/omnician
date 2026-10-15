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

async function tryLock(lock: 'portrait' | 'landscape'): Promise<'locked' | 'unsupported'> {
  if (typeof screen === 'undefined') return 'unsupported'
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (lock: string) => Promise<void>
  }
  if (typeof orientation?.lock !== 'function') return 'unsupported'
  try {
    await orientation.lock(lock)
    return 'locked'
  } catch {
    return 'unsupported'
  }
}

/** Installed PWAs that support the Screen Orientation API. Safari iOS usually rejects this. */
export function tryLockPortrait(): Promise<'locked' | 'unsupported'> {
  return tryLock('portrait')
}

export function tryLockLandscape(): Promise<'locked' | 'unsupported'> {
  return tryLock('landscape')
}

export function unlockOrientation() {
  try {
    screen.orientation?.unlock?.()
  } catch {
    /* iOS and some desktop browsers reject unlock */
  }
}

let drumEditorOpen = false
const editorListeners = new Set<() => void>()

export function setDrumEditorOpen(open: boolean) {
  if (drumEditorOpen === open) return
  drumEditorOpen = open
  editorListeners.forEach((fn) => fn())
}

export function readDrumEditorOpen(): boolean {
  return drumEditorOpen
}

export function subscribeDrumEditorOpen(onChange: () => void): () => void {
  editorListeners.add(onChange)
  return () => {
    editorListeners.delete(onChange)
  }
}
