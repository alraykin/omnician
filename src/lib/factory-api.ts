import {
  FACTORY_HISTORY_LIMIT,
  FACTORY_MAX_JSON_BYTES,
  factoryBeatCount,
  parseFactoryLibraryJson,
  validateFactoryLibrary,
  type FactoryHistoryItem,
  type FactoryLibrary,
} from './factory-library.ts'
import {
  FACTORY_SESSION_TTL_SEC,
  clearFactoryCookieHeader,
  factoryCookieHeader,
  parseCookie,
  safeEqual,
  signFactorySession,
  verifyFactorySession,
} from './factory-session.ts'

export const FACTORY_KV_LIBRARY = 'library'
export const FACTORY_KV_HISTORY = 'history'

export type FactoryKv = {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

export type FactoryApiEnv = {
  kv: FactoryKv
  password?: string
  seed: () => FactoryLibrary
  secure: boolean
}

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  })
}

function error(status: number, message: string, headers?: HeadersInit): Response {
  return json({ error: message }, status, headers)
}

async function readLibrary(env: FactoryApiEnv): Promise<FactoryLibrary> {
  const raw = await env.kv.get(FACTORY_KV_LIBRARY)
  if (raw) {
    const parsed = parseFactoryLibraryJson(raw)
    if (parsed.ok) return parsed.library
  }
  const seed = env.seed()
  await env.kv.put(FACTORY_KV_LIBRARY, JSON.stringify(seed))
  return seed
}

async function readHistory(env: FactoryApiEnv): Promise<FactoryHistoryItem[]> {
  const raw = await env.kv.get(FACTORY_KV_HISTORY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is FactoryHistoryItem => {
      if (!item || typeof item !== 'object') return false
      const row = item as FactoryHistoryItem
      return typeof row.id === 'string' && typeof row.savedAt === 'string' && validateFactoryLibrary(row.library).ok
    })
  } catch {
    return []
  }
}

async function writeLibrary(env: FactoryApiEnv, library: FactoryLibrary, snapshotCurrent: boolean): Promise<void> {
  if (snapshotCurrent) {
    const currentRaw = await env.kv.get(FACTORY_KV_LIBRARY)
    if (currentRaw) {
      const current = parseFactoryLibraryJson(currentRaw)
      if (current.ok) {
        const history = await readHistory(env)
        const entry: FactoryHistoryItem = {
          id: `ver-${Date.now().toString(36)}`,
          savedAt: current.library.updatedAt,
          beatCount: factoryBeatCount(current.library),
          library: current.library,
        }
        await env.kv.put(FACTORY_KV_HISTORY, JSON.stringify([entry, ...history].slice(0, FACTORY_HISTORY_LIMIT)))
      }
    }
  }
  await env.kv.put(FACTORY_KV_LIBRARY, JSON.stringify(library))
}

async function requireSession(request: Request, env: FactoryApiEnv): Promise<Response | null> {
  if (!env.password) return error(503, 'Factory editor is not configured.')
  const token = parseCookie(request.headers.get('cookie'), 'omnician_factory')
  const ok = await verifyFactorySession(env.password, token)
  return ok ? null : error(401, 'Sign in required.')
}

export async function handleFactoryRequest(request: Request, env: FactoryApiEnv): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'

  if (path === '/api/factory/library' && request.method === 'GET') {
    const library = await readLibrary(env)
    return json({ library })
  }

  if (path === '/api/factory/login' && request.method === 'POST') {
    if (!env.password) return error(503, 'Factory editor is not configured.')
    let body: { password?: unknown }
    try {
      body = (await request.json()) as { password?: unknown }
    } catch {
      return error(400, 'Send a password.')
    }
    const password = typeof body.password === 'string' ? body.password : ''
    if (!safeEqual(password, env.password)) return error(401, 'Wrong password.')
    const token = await signFactorySession(env.password, Date.now() + FACTORY_SESSION_TTL_SEC * 1000)
    return json({ ok: true }, 200, {
      'set-cookie': factoryCookieHeader(token, FACTORY_SESSION_TTL_SEC, env.secure),
    })
  }

  if (path === '/api/factory/logout' && request.method === 'POST') {
    return json({ ok: true }, 200, {
      'set-cookie': clearFactoryCookieHeader(env.secure),
    })
  }

  if (path === '/api/factory/session' && request.method === 'GET') {
    const denied = await requireSession(request, env)
    if (denied) return denied
    return json({ ok: true })
  }

  if (path === '/api/factory/library' && request.method === 'PUT') {
    const denied = await requireSession(request, env)
    if (denied) return denied
    const text = await request.text()
    if (text.length > FACTORY_MAX_JSON_BYTES) return error(413, 'Library JSON is too large.')
    let body: { library?: unknown }
    try {
      body = JSON.parse(text) as { library?: unknown }
    } catch {
      return error(400, 'Send a library object.')
    }
    const parsed = validateFactoryLibrary({
      ...(body.library && typeof body.library === 'object' ? body.library : {}),
      version: 1,
      updatedAt: new Date().toISOString(),
    })
    if (!parsed.ok) return error(400, parsed.error)
    await writeLibrary(env, parsed.library, true)
    return json({ library: parsed.library })
  }

  if (path === '/api/factory/history' && request.method === 'GET') {
    const denied = await requireSession(request, env)
    if (denied) return denied
    const history = await readHistory(env)
    return json({
      versions: history.map((item) => ({
        id: item.id,
        savedAt: item.savedAt,
        beatCount: item.beatCount,
      })),
    })
  }

  if (path === '/api/factory/restore' && request.method === 'POST') {
    const denied = await requireSession(request, env)
    if (denied) return denied
    let body: { id?: unknown }
    try {
      body = (await request.json()) as { id?: unknown }
    } catch {
      return error(400, 'Send a version id.')
    }
    if (typeof body.id !== 'string') return error(400, 'Send a version id.')
    const history = await readHistory(env)
    const found = history.find((item) => item.id === body.id)
    if (!found) return error(404, 'That version is gone.')
    const restored = validateFactoryLibrary({
      ...found.library,
      updatedAt: new Date().toISOString(),
    })
    if (!restored.ok) return error(400, restored.error)
    await writeLibrary(env, restored.library, true)
    return json({ library: restored.library })
  }

  return error(404, 'Not found.')
}
