import {
  FACTORY_LIBRARY_CACHE_KEY,
  factoryLibraryToStyles,
  parseFactoryLibraryJson,
  stylesToFactoryLibrary,
  type FactoryLibrary,
} from './factory-library.ts'
import { publicApiCredentials, publicApiUrl } from './native-origin.ts'
import { barsForPreset, RHYTHM_STYLES, setLiveRhythmStyles } from './rhythm-presets.ts'

export function bundledFactoryLibrary(): FactoryLibrary {
  return stylesToFactoryLibrary(RHYTHM_STYLES, barsForPreset, '2026-09-28T00:00:00.000Z')
}

export function applyFactoryLibrary(library: FactoryLibrary): void {
  setLiveRhythmStyles(factoryLibraryToStyles(library))
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(FACTORY_LIBRARY_CACHE_KEY, JSON.stringify(library))
}

export function loadCachedFactoryLibrary(): FactoryLibrary | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(FACTORY_LIBRARY_CACHE_KEY)
    if (!raw) return null
    const parsed = parseFactoryLibraryJson(raw)
    return parsed.ok ? parsed.library : null
  } catch {
    return null
  }
}

export async function hydrateFactoryLibrary(): Promise<FactoryLibrary> {
  const cached = loadCachedFactoryLibrary()
  if (cached) applyFactoryLibrary(cached)
  else applyFactoryLibrary(bundledFactoryLibrary())

  try {
    const response = await fetch(publicApiUrl('/api/factory/library'), {
      credentials: publicApiCredentials(),
      cache: 'no-store',
    })
    if (!response.ok) return cached ?? bundledFactoryLibrary()
    const body = (await response.json()) as { library?: unknown }
    const parsed = parseFactoryLibraryJson(JSON.stringify(body.library))
    if (!parsed.ok) return cached ?? bundledFactoryLibrary()
    applyFactoryLibrary(parsed.library)
    return parsed.library
  } catch {
    return cached ?? bundledFactoryLibrary()
  }
}

export async function fetchFactorySession(): Promise<boolean> {
  try {
    const response = await fetch('/api/factory/session', { credentials: 'same-origin', cache: 'no-store' })
    return response.ok
  } catch {
    return false
  }
}

export async function factoryLogin(password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch('/api/factory/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (response.ok) return { ok: true }
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: body?.error ?? 'Could not sign in.' }
  } catch {
    return { ok: false, error: 'Could not reach the factory editor.' }
  }
}

export async function factoryLogout(): Promise<void> {
  try {
    await fetch('/api/factory/logout', { method: 'POST', credentials: 'same-origin' })
  } catch {
    /* stay signed out locally */
  }
}

export async function saveFactoryLibrary(
  library: FactoryLibrary,
): Promise<{ ok: true; library: FactoryLibrary } | { ok: false; error: string }> {
  try {
    const response = await fetch('/api/factory/library', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ library }),
    })
    const body = (await response.json().catch(() => null)) as { library?: unknown; error?: string } | null
    if (!response.ok) return { ok: false, error: body?.error ?? 'Save failed.' }
    const parsed = parseFactoryLibraryJson(JSON.stringify(body?.library))
    if (!parsed.ok) return { ok: false, error: parsed.error }
    applyFactoryLibrary(parsed.library)
    return { ok: true, library: parsed.library }
  } catch {
    return { ok: false, error: 'Could not reach the factory editor.' }
  }
}

export async function fetchFactoryHistory(): Promise<Array<{ id: string; savedAt: string; beatCount: number }>> {
  const response = await fetch('/api/factory/history', { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) return []
  const body = (await response.json()) as { versions?: Array<{ id: string; savedAt: string; beatCount: number }> }
  return body.versions ?? []
}

export async function restoreFactoryVersion(
  id: string,
): Promise<{ ok: true; library: FactoryLibrary } | { ok: false; error: string }> {
  try {
    const response = await fetch('/api/factory/restore', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const body = (await response.json().catch(() => null)) as { library?: unknown; error?: string } | null
    if (!response.ok) return { ok: false, error: body?.error ?? 'Restore failed.' }
    const parsed = parseFactoryLibraryJson(JSON.stringify(body?.library))
    if (!parsed.ok) return { ok: false, error: parsed.error }
    applyFactoryLibrary(parsed.library)
    return { ok: true, library: parsed.library }
  } catch {
    return { ok: false, error: 'Could not reach the factory editor.' }
  }
}
