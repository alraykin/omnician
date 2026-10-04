export const FACTORY_COOKIE = 'omnician_factory'
export const FACTORY_SESSION_DAYS = 30
export const FACTORY_SESSION_TTL_SEC = FACTORY_SESSION_DAYS * 24 * 60 * 60

const encoder = new TextEncoder()

function bytesToB64(bytes: ArrayBuffer): string {
  const raw = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function b64ToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

export async function signFactorySession(secret: string, expiresAt: number): Promise<string> {
  const payload = `v1.${expiresAt}`
  const key = await hmacKey(secret)
  const signature = bytesToB64(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)))
  return `${payload}.${signature}`
}

export async function verifyFactorySession(secret: string, token: string | null, now = Date.now()): Promise<boolean> {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return false
  const expiresAt = Number(parts[1])
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false
  const payload = `v1.${parts[1]}`
  const key = await hmacKey(secret)
  const signature = Uint8Array.from(b64ToBytes(parts[2] ?? ''))
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(payload))
}

export function safeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  const max = Math.max(a.length, b.length)
  let diff = a.length === b.length ? 0 : 1
  for (let i = 0; i < max; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }
  return diff === 0
}

export function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function factoryCookieHeader(token: string, maxAgeSec: number, secure: boolean): string {
  return [
    `${FACTORY_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

export function clearFactoryCookieHeader(secure: boolean): string {
  return factoryCookieHeader('deleted', 0, secure)
}
