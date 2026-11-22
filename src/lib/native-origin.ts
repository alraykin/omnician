import { bundledAssetUrl } from './bundled-assets.ts'

export const LIVE_WEB_ORIGIN = 'https://omnician.app'

export const NATIVE_WEBVIEW_ORIGINS = [
  'capacitor://localhost',
  'ionic://localhost',
  'omnician://localhost',
] as const

type CapacitorBridge = {
  isNativePlatform?: () => boolean
}

function runtimeWindow(): (Window & { Capacitor?: CapacitorBridge }) | undefined {
  if (typeof window !== 'undefined') return window
  const win = (globalThis as { window?: Window & { Capacitor?: CapacitorBridge } }).window
  return win
}

export function isNativeApp(): boolean {
  const win = runtimeWindow()
  if (!win) return false
  const protocol = win.location?.protocol
  if (protocol === 'capacitor:' || protocol === 'ionic:' || protocol === 'omnician:') return true
  return win.Capacitor?.isNativePlatform?.() === true
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

/** GET/HEAD/OPTIONS CORS for native webview origins. Used by Factory library and /rhythm samples. */
export function applyNativeGetCors(request: Request, response: Response): Response {
  const method = request.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') return response
  const allow = corsOriginForNativeWebview(request.headers.get('origin'))
  if (!allow) return response
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', allow)
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Cache-Control, Pragma, Content-Type')
  headers.set('Access-Control-Max-Age', '86400')
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
  headers.append('Vary', 'Origin')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export function isRhythmAssetPath(pathname: string): boolean {
  return pathname === '/rhythm' || pathname.startsWith('/rhythm/')
}

/** Same files the website serves from dist/rhythm. Native prefers the live host, then the app bundle. */
export function mediaUrlCandidates(path: string): string[] {
  const normalized = path.replace(/^\//, '')
  const bundled = bundledAssetUrl(normalized)
  if (!isNativeApp()) return [bundled]
  const live = `${LIVE_WEB_ORIGIN}/${normalized}`
  return live === bundled ? [bundled] : [live, bundled]
}
