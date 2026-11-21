import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { soundSourceReport } from '../src/lib/sound-sources.ts'
import { isNativeApp, publicApiUrl } from '../src/lib/native-origin.ts'

assert.equal(isNativeApp(), false)
assert.equal(publicApiUrl('/api/factory/library'), '/api/factory/library')

const report = soundSourceReport()
assert.equal(report.platform, 'web')
assert.equal(report.factoryLibraryHost, 'same-origin')
assert.equal(report.factoryLibraryUrl, '/api/factory/library')
assert.equal(report.sampleOrigin, 'bundled-app')
assert.ok(report.clicks.every((url) => url.includes('rhythm/clicks/')))
assert.match(report.drumsManifest, /rhythm\/drums\/crocell\/manifest\.json/)
assert.match(report.announce, /rhythm\/announce\/af_heart\/100\.mp3/)

const store = readFileSync(new URL('../src/lib/factory-store.ts', import.meta.url), 'utf8')
const hydrate = store.slice(store.indexOf('export async function hydrateFactoryLibrary'), store.indexOf('export async function fetchFactorySession'))
assert.match(hydrate, /publicApiUrl\('\/api\/factory\/library'\)/)
assert.match(hydrate, /publicApiCredentials\(\)/)
assert.doesNotMatch(hydrate, /fetch\('\/api\/factory\/library'/)

const api = readFileSync(new URL('../src/lib/factory-api.ts', import.meta.url), 'utf8')
assert.match(api, /applyPublicLibraryCors/)
assert.match(api, /GET, OPTIONS/)
assert.doesNotMatch(api, /FACTORY_ADMIN_PASSWORD/)

const origins = readFileSync(new URL('../src/lib/native-origin.ts', import.meta.url), 'utf8')
assert.match(origins, /capacitor:\/\/localhost/)
assert.match(origins, /ionic:\/\/localhost/)
assert.match(origins, /https:\/\/omnician\.app/)

console.log('sound-sources: web same-origin /api/factory/library; samples bundled')
console.log(JSON.stringify(report, null, 2))
console.log(
  JSON.stringify(
    {
      platform: 'native',
      factoryLibraryUrl: 'https://omnician.app/api/factory/library',
      factoryLibraryHost: 'omnician.app',
      sampleOrigin: 'bundled-app',
      clicks: report.clicks,
      drumsManifest: report.drumsManifest,
      announce: report.announce,
      note: 'Native Capacitor.isNativePlatform() fetches the live Factory GET; samples stay in the app bundle (dist/rhythm via cap sync).',
    },
    null,
    2,
  ),
)
