export const LIVE_WEB_ORIGIN = 'https://omnician.app'

export const NATIVE_WEBVIEW_ORIGINS = [
  'capacitor://localhost',
  'ionic://localhost',
  'omnician://localhost',
] as const

type CapacitorBridge = {
  isNativePlatform?: () => boolean
}

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  const protocol = window.location.protocol
  if (protocol === 'capacitor:' || protocol === 'ionic:' || protocol === 'omnician:') return true
  const capacitor = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor
  return capacitor?.isNativePlatform?.() === true
}

/** Public Worker routes the native app must load from omnician.app, not capacitor://localhost. */
export function publicApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return isNativeApp() ? `${LIVE_WEB_ORIGIN}${normalized}` : normalized
}

export function publicApiCredentials(): RequestCredentials {
  return isNativeApp() ? 'omit' : 'same-origin'
}

export function corsOriginForNativeWebview(origin: string | null): string | null {
  if (!origin) return null
  return (NATIVE_WEBVIEW_ORIGINS as readonly string[]).includes(origin) ? origin : null
}
