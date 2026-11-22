import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CLICK_ACCENT_GAIN,
  CLICK_SAMPLE_FILES,
  DRUM_MANIFEST_PATH,
  SAMPLE_GAIN,
  VOICE_PIECE,
} from '../src/lib/kit-samples.ts'
import { DEFAULT_KIT_MIX, KIT_ZERO_OFFSET_DB } from '../src/lib/kit-mix.ts'
import { applyNativeGetCors, isNativeApp, isRhythmAssetPath, publicApiUrl } from '../src/lib/native-origin.ts'
import { CLICK_SOUNDS, VOICES } from '../src/lib/rhythm.ts'
import {
  assertedVoiceGains,
  nativeSoundSourceReport,
  soundSourceReport,
} from '../src/lib/sound-sources.ts'
import worker from '../worker/index.ts'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8')

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
assert.deepEqual(report.sampleGain, SAMPLE_GAIN)
assert.deepEqual(report.kitMixDefaults, DEFAULT_KIT_MIX)
assert.equal(report.cymbalZeroOffsetDb, KIT_ZERO_OFFSET_DB.cymbals)
assert.equal(KIT_ZERO_OFFSET_DB.cymbals, -1)

const native = nativeSoundSourceReport()
assert.equal(native.platform, 'native')
assert.equal(native.factoryLibraryUrl, 'https://omnician.app/api/factory/library')
assert.equal(native.sampleOrigin, 'live-web-then-bundled')
assert.deepEqual(native.sampleGain, report.sampleGain)
assert.deepEqual(native.kitMixDefaults, report.kitMixDefaults)
assert.equal(native.cymbalZeroOffsetDb, report.cymbalZeroOffsetDb)
assert.ok(native.drumManifestCandidates[0]?.startsWith('https://omnician.app/rhythm/'))
assert.ok(native.clickCandidates.wood?.[0]?.startsWith('https://omnician.app/rhythm/clicks/'))
assert.equal(native.drumManifestCandidates[1], `/${DRUM_MANIFEST_PATH}`)

const gains = assertedVoiceGains()
for (const voice of VOICES) {
  assert.equal(gains[voice], SAMPLE_GAIN[voice], `web/native SAMPLE_GAIN.${voice}`)
  assert.ok(VOICE_PIECE[voice], `voice ${voice} maps to a Crocell piece`)
}
for (const sound of CLICK_SOUNDS) {
  assert.equal(typeof CLICK_ACCENT_GAIN[sound], 'number')
  assert.ok(existsSync(path.join(root, 'public', CLICK_SAMPLE_FILES[sound].normal)))
  assert.ok(existsSync(path.join(root, 'public', CLICK_SAMPLE_FILES[sound].accent)))
}

type ManifestFile = { piece: string; file: string; tier: number }
const manifest = JSON.parse(read(DRUM_MANIFEST_PATH.replace(/^/, 'public/'))) as { files?: ManifestFile[] }
assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0)
const pieces = new Set(Object.values(VOICE_PIECE))
const filesByPiece = new Map<string, string[]>()
for (const row of manifest.files) {
  const abs = path.join(root, 'public/rhythm/drums/crocell', row.file)
  assert.ok(existsSync(abs), `missing sample ${row.file}`)
  const list = filesByPiece.get(row.piece) ?? []
  list.push(row.file)
  filesByPiece.set(row.piece, list)
}
for (const piece of pieces) {
  const files = filesByPiece.get(piece) ?? []
  assert.ok(files.length > 0, `no Crocell files for ${piece}`)
}

const store = readFileSync(new URL('../src/lib/factory-store.ts', import.meta.url), 'utf8')
const hydrate = store.slice(
  store.indexOf('export async function hydrateFactoryLibrary'),
  store.indexOf('export async function fetchFactorySession'),
)
assert.match(hydrate, /publicApiUrl\('\/api\/factory\/library'\)/)
assert.match(hydrate, /publicApiCredentials\(\)/)
assert.doesNotMatch(hydrate, /fetch\('\/api\/factory\/library'/)

const api = readFileSync(new URL('../src/lib/factory-api.ts', import.meta.url), 'utf8')
assert.match(api, /applyPublicLibraryCors/)
assert.match(api, /applyNativeGetCors/)
assert.doesNotMatch(api, /FACTORY_ADMIN_PASSWORD/)

const origins = readFileSync(new URL('../src/lib/native-origin.ts', import.meta.url), 'utf8')
assert.match(origins, /capacitor:\/\/localhost/)
assert.match(origins, /ionic:\/\/localhost/)
assert.match(origins, /https:\/\/omnician\.app/)
assert.match(origins, /mediaUrlCandidates/)
assert.match(origins, /isRhythmAssetPath/)

const rhythm = read('src/lib/rhythm-audio.ts')
assert.match(rhythm, /from '@\/lib\/kit-samples'/)
assert.match(rhythm, /mediaUrlCandidates/)
assert.match(rhythm, /decodeSampleNative/)
assert.match(rhythm, /HAT_CHOKE_SEC/)
assert.doesNotMatch(rhythm, /bundledAssetUrl\('rhythm\/clicks\//)
assert.match(rhythm, /CLICK_SAMPLE_FILES/)
assert.match(rhythm, /SAMPLE_GAIN\[voice\]/)

const intensity = read('src/lib/kit-intensity.ts')
assert.match(intensity, /Same notes at every level/)
assert.match(intensity, /how hard they are struck/)
assert.doesNotMatch(intensity, /playbackRate/)

const plugin = read('ios/App/App/OmnicianAudioPlugin.swift')
assert.match(plugin, /decodeSample/)
assert.match(plugin, /AVAudioFile/)
assert.match(plugin, /setSession/)
assert.doesNotMatch(plugin, /AVAudioPlayer/)
assert.doesNotMatch(plugin, /AVAudioEngine/)
assert.doesNotMatch(plugin, /\.play\(\)/)

const session = read('src/native/ios-audio-session.ts')
assert.match(session, /decodeSampleNative/)
assert.match(session, /nativePcmToAudioBuffer/)

const workerSrc = read('worker/index.ts')
assert.match(workerSrc, /isRhythmAssetPath/)
assert.match(workerSrc, /applyNativeGetCors/)
assert.match(read('wrangler.jsonc'), /run_worker_first/)
assert.match(read('wrangler.jsonc'), /\/rhythm\/\*/)

assert.equal(isRhythmAssetPath('/rhythm/drums/crocell/kick/t1_rr1.m4a'), true)
assert.equal(isRhythmAssetPath('/api/factory/library'), false)

const corsHeaders = applyNativeGetCors(
  new Request('https://omnician.app/rhythm/drums/crocell/kick/t1_rr1.m4a', {
    headers: { origin: 'omnician://localhost' },
  }),
  new Response('ok', { headers: { 'content-type': 'audio/mp4' } }),
)
assert.equal(corsHeaders.headers.get('access-control-allow-origin'), 'omnician://localhost')
assert.match(corsHeaders.headers.get('access-control-allow-methods') ?? '', /GET/)
assert.equal(corsHeaders.headers.get('cross-origin-resource-policy'), 'cross-origin')

const blocked = applyNativeGetCors(
  new Request('https://omnician.app/rhythm/drums/crocell/kick/t1_rr1.m4a', {
    headers: { origin: 'https://evil.example' },
  }),
  new Response('ok'),
)
assert.equal(blocked.headers.get('access-control-allow-origin'), null)

const env = {
  FACTORY: {
    async get() {
      return null
    },
    async put() {
      return
    },
  },
  ASSETS: {
    async fetch() {
      return new Response('fake-m4a', { headers: { 'content-type': 'audio/mp4' } })
    },
  },
}

const nativeSample = await worker.fetch(
  new Request('https://omnician.app/rhythm/drums/crocell/kick/t1_rr1.m4a', {
    headers: { origin: 'omnician://localhost' },
  }),
  env,
)
assert.equal(nativeSample.status, 200)
assert.equal(nativeSample.headers.get('access-control-allow-origin'), 'omnician://localhost')
assert.equal(nativeSample.headers.get('content-type'), 'audio/mp4')

const nativeOptions = await worker.fetch(
  new Request('https://omnician.app/rhythm/clicks/wood-soft-tick.wav', {
    method: 'OPTIONS',
    headers: { origin: 'capacitor://localhost' },
  }),
  env,
)
assert.equal(nativeOptions.status, 204)
assert.equal(nativeOptions.headers.get('access-control-allow-origin'), 'capacitor://localhost')

const webSample = await worker.fetch(
  new Request('https://omnician.app/rhythm/drums/crocell/kick/t1_rr1.m4a'),
  env,
)
assert.equal(webSample.headers.get('access-control-allow-origin'), null)

console.log('sound-sources: native and web share Crocell files, SAMPLE_GAIN, and click samples')
console.log(JSON.stringify({ web: report, native }, null, 2))
console.log(
  JSON.stringify(
    {
      voices: Object.fromEntries(
        VOICES.map((voice) => [
          voice,
          {
            piece: VOICE_PIECE[voice],
            gain: SAMPLE_GAIN[voice],
            files: filesByPiece.get(VOICE_PIECE[voice])?.length ?? 0,
          },
        ]),
      ),
      clicks: Object.fromEntries(
        CLICK_SOUNDS.map((id) => [id, { ...CLICK_SAMPLE_FILES[id], accentGain: CLICK_ACCENT_GAIN[id] }]),
      ),
      factoryLibraryUrl: 'https://omnician.app/api/factory/library',
      note: 'Native loads https://omnician.app/rhythm then the app bundle; AAC/m4a uses AVAudioFile when WKWebView decodeAudioData fails. KitEngine/gains/choke/intensity stay in shared JS.',
    },
    null,
    2,
  ),
)
