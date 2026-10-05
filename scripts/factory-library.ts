import assert from 'node:assert/strict'

import { readFileSync } from 'node:fs'

import { handleFactoryRequest, type FactoryKv } from '../src/lib/factory-api.ts'
import {
  beatFromPattern,
  factoryBeatCount,
  findFactoryBeat,
  liveFactoryPatternKey,
  parseFactoryLibraryJson,
  moveFactoryBeat,
  replaceFactoryBeat,
  savedFactoryPatternKey,
  upsertFactoryBeat,
  validateFactoryLibrary,
} from '../src/lib/factory-library.ts'
import { signFactorySession, verifyFactorySession } from '../src/lib/factory-session.ts'
import { bundledFactoryLibrary } from '../src/lib/factory-store.ts'
import { cloneBar, updateBarMeter } from '../src/lib/rhythm.ts'
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

const backbeatPreset = findPreset('rock-44')
assert.ok(backbeatPreset)
const backbeatBars = barsForPreset(backbeatPreset)
assert.equal(
  liveFactoryPatternKey(backbeatPreset.bpm ?? 88, backbeatBars),
  savedFactoryPatternKey(findFactoryBeat(bundled, 'rock-44')!.beat),
)

const editedBars = backbeatBars.map((bar, index) =>
  index === 0 ? updateBarMeter(cloneBar(bar), 3, 4, bar.subdivision) : cloneBar(bar),
)
const overwritten = beatFromPattern('rock-44', 'Backbeat', 88, editedBars, findFactoryBeat(bundled, 'rock-44')!.beat.blurb)
assert.equal(overwritten.id, 'rock-44')
assert.equal(overwritten.name, 'Backbeat')
assert.equal(overwritten.bars[0]?.beats, 3)
const afterDefault = replaceFactoryBeat(bundled, overwritten)
assert.equal(findFactoryBeat(afterDefault, 'rock-44')?.beat.bars[0]?.beats, 3)
assert.equal(findFactoryBeat(afterDefault, 'rock-44')?.beat.name, 'Backbeat')

const added = beatFromPattern('fx-testnew', 'Pocket clone', 92, editedBars)
const afterNew = upsertFactoryBeat(bundled, 'funk', added)
assert.equal(findFactoryBeat(afterNew, 'rock-44')?.beat.name, 'Backbeat')
assert.equal(findFactoryBeat(afterNew, 'rock-44')?.beat.bars[0]?.beats, 4)
assert.equal(findFactoryBeat(afterNew, 'fx-testnew')?.beat.name, 'Pocket clone')
assert.equal(findFactoryBeat(afterNew, 'fx-testnew')?.style.id, 'funk')

const rockIds = bundled.styles.find((style) => style.id === 'rock')!.beats.map((beat) => beat.id)
const firstRock = rockIds[0]!
const secondRock = rockIds[1]!
assert.ok(firstRock && secondRock)
const movedDown = moveFactoryBeat(bundled, firstRock, 'rock', 1)
assert.equal(movedDown.styles.find((style) => style.id === 'rock')!.beats[1]?.id, firstRock)
assert.equal(movedDown.styles.find((style) => style.id === 'rock')!.beats[0]?.id, secondRock)
const movedBack = moveFactoryBeat(movedDown, firstRock, 'rock', 0)
assert.equal(movedBack.styles.find((style) => style.id === 'rock')!.beats[0]?.id, firstRock)

const barSrc = readFileSync(new URL('../src/components/FactoryEditorBar.tsx', import.meta.url), 'utf8')
assert.match(barSrc, /data-factory-undo/)
assert.match(barSrc, /data-factory-history-open/)
assert.doesNotMatch(barSrc, /Move up/)
assert.doesNotMatch(barSrc, /Move down/)
assert.doesNotMatch(barSrc, /ChevronUp/)

const rhythmSrc = readFileSync(new URL('../src/pages/RhythmPage.tsx', import.meta.url), 'utf8')
assert.match(rhythmSrc, /data-factory-reorder/)
assert.match(rhythmSrc, /data-factory-grip/)
assert.match(rhythmSrc, /onReorder/)
assert.match(rhythmSrc, /data-factory-picker-notice/)
assert.match(readFileSync(new URL('../src/hooks/useFactoryEditor.ts', import.meta.url), 'utf8'), /Saved order/)
const meterFn = rhythmSrc.slice(rhythmSrc.indexOf('const setMeter'), rhythmSrc.indexOf('const setSubdivision'))
assert.equal(meterFn.includes('setPresetId(null)'), false)

console.log('factory-library ok')
