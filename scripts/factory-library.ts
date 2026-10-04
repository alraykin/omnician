import assert from 'node:assert/strict'

import { handleFactoryRequest, type FactoryKv } from '../src/lib/factory-api.ts'
import {
  factoryBeatCount,
  findFactoryBeat,
  parseFactoryLibraryJson,
  validateFactoryLibrary,
} from '../src/lib/factory-library.ts'
import { signFactorySession, verifyFactorySession } from '../src/lib/factory-session.ts'
import { bundledFactoryLibrary } from '../src/lib/factory-store.ts'
import { barsForPreset, findPreset } from '../src/lib/rhythm-presets.ts'

const bundled = bundledFactoryLibrary()
assert.equal(bundled.version, 1)
assert.ok(findFactoryBeat(bundled, 'rock-44'))
assert.ok(findFactoryBeat(bundled, 'funk-44'))
assert.equal(findFactoryBeat(bundled, 'rock-44')?.beat.name, 'Backbeat')
assert.equal(findFactoryBeat(bundled, 'funk-44')?.beat.name, 'Chameleon')
assert.ok(factoryBeatCount(bundled) >= 20)

const chameleon = findPreset('funk-44')
assert.ok(chameleon)
assert.equal(barsForPreset(chameleon).length, 8)
assert.equal(chameleon.bpm, 90)

assert.equal(validateFactoryLibrary({}).ok, false)
assert.equal(parseFactoryLibraryJson('{').ok, false)
assert.equal(validateFactoryLibrary(bundled).ok, true)

const secret = 'omnician-local-factory'
const token = await signFactorySession(secret, Date.now() + 60_000)
assert.equal(await verifyFactorySession(secret, token), true)
assert.equal(await verifyFactorySession(secret, 'v1.1.nope'), false)
assert.equal(await verifyFactorySession('other', token), false)

function memoryKv(start: Record<string, string> = {}): FactoryKv {
  const store = { ...start }
  return {
    async get(key) {
      return store[key] ?? null
    },
    async put(key, value) {
      store[key] = value
    },
  }
}

const kv = memoryKv()
const env = { kv, password: secret, seed: bundledFactoryLibrary, secure: false }
const origin = 'http://127.0.0.1'

const libraryRes = await handleFactoryRequest(new Request(`${origin}/api/factory/library`), env)
assert.equal(libraryRes.status, 200)

const putDenied = await handleFactoryRequest(
  new Request(`${origin}/api/factory/library`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ library: bundled }),
  }),
  env,
)
assert.equal(putDenied.status, 401)

const login = await handleFactoryRequest(
  new Request(`${origin}/api/factory/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: secret }),
  }),
  env,
)
assert.equal(login.status, 200)
const cookie = login.headers.get('set-cookie') ?? ''
assert.match(cookie, /omnician_factory=/)
assert.match(cookie, /HttpOnly/i)
assert.match(cookie, /Max-Age=2592000/)

const wrong = await handleFactoryRequest(
  new Request(`${origin}/api/factory/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'nope' }),
  }),
  env,
)
assert.equal(wrong.status, 401)

const renamed = structuredClone(bundled)
const backbeat = findFactoryBeat(renamed, 'rock-44')
assert.ok(backbeat)
backbeat.beat.name = 'Backbeat Edit'

const saved = await handleFactoryRequest(
  new Request(`${origin}/api/factory/library`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ library: renamed }),
  }),
  env,
)
assert.equal(saved.status, 200)

const history = await handleFactoryRequest(
  new Request(`${origin}/api/factory/history`, { headers: { cookie } }),
  env,
)
assert.equal(history.status, 200)
const versions = ((await history.json()) as { versions: Array<{ id: string }> }).versions
assert.ok(versions.length >= 1)

console.log('factory-library ok')
