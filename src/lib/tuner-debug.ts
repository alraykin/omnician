const listeners = new Set<(on: boolean) => void>()
let enabled = false

function readQuery(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1'
  } catch {
    return false
  }
}

export function isTunerDebugEnabled(): boolean {
  return enabled || readQuery()
}

export function setTunerDebugEnabled(on: boolean): void {
  enabled = on
  for (const listener of listeners) listener(isTunerDebugEnabled())
}

export function toggleTunerDebug(): void {
  setTunerDebugEnabled(!isTunerDebugEnabled())
}

export function subscribeTunerDebug(listener: (on: boolean) => void): () => void {
  listeners.add(listener)
  listener(isTunerDebugEnabled())
  return () => {
    listeners.delete(listener)
  }
}

export function armLogoDebugToggle(): () => void {
  if (typeof window === 'undefined') return () => undefined
  let taps = 0
  let timer = 0
  const onTap = (event: Event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (!target.closest('[data-brand-logo]')) return
    taps += 1
    window.clearTimeout(timer)
    if (taps >= 3) {
      taps = 0
      toggleTunerDebug()
      return
    }
    timer = window.setTimeout(() => {
      taps = 0
    }, 520)
  }
  window.addEventListener('pointerdown', onTap)
  return () => {
    window.removeEventListener('pointerdown', onTap)
    window.clearTimeout(timer)
  }
}
