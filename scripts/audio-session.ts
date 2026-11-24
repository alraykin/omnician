import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  applyNativeAudioSession,
  flushNativeAudioSessionForTests,
  installNativeAudioPluginForTests,
  peekNativeAudioSession,
  resetNativeAudioSessionForTests,
} from '../src/native/ios-audio-session.ts'
import {
  claimPlayAndRecordSessionFromGesture,
  claimPlaybackSessionFromGesture,
  playbackContextShouldRebuild,
  getAudioSessionType,
  getSilentHtmlState,
  getWantedAudioSession,
  hasSafariAudioSession,
  resetAudioSessionForTests,
  restorePlaybackSessionAfterMic,
  silentWavDataUrl,
} from '../src/lib/audio-context.ts'
import {
  audioEventLine,
  noteAudioEvent,
  resetAudioEventsForTests,
} from '../src/lib/audio-log.ts'
import {
  formatNowPlayingSubtitle,
  peekNowPlaying,
  primeNowPlayingMetadata,
  publishNowPlaying,
  resetNowPlayingForTests,
} from '../src/lib/now-playing.ts'

type FakeSession = { type: string }

function installSession(type = 'auto'): FakeSession {
  const session: FakeSession = { type }
  Object.defineProperty(globalThis.navigator, 'audioSession', {
    configurable: true,
    writable: true,
    value: session,
  })
  return session
}

function removeSession(): void {
  try {
    delete (globalThis.navigator as Navigator & { audioSession?: FakeSession }).audioSession
  } catch {
    Object.defineProperty(globalThis.navigator, 'audioSession', {
      configurable: true,
      value: undefined,
    })
  }
}

const src = readFileSync(new URL('../src/lib/audio-context.ts', import.meta.url), 'utf8')
const unlockIdx = src.indexOf('export function unlockPlaybackFromGesture')
const captureIdx = src.indexOf('export function getCaptureAudioContext')
const playIdx = src.indexOf('export function getPlaybackAudioContext')
assert.ok(unlockIdx > 0)
assert.ok(src.indexOf('claimPlaybackSessionFromGesture()', unlockIdx) < src.indexOf('getPlaybackAudioContext()', unlockIdx + 1))
assert.ok(src.indexOf('claimPlaybackSessionFromGesture()', playIdx) < src.indexOf('createContext()', playIdx + 1))
assert.ok(src.indexOf('claimPlayAndRecordSessionFromGesture()', captureIdx) < src.indexOf('createContext()', captureIdx + 1))
assert.match(src, /session\.type = type/)
assert.match(src, /playsInline = true/)
assert.match(src, /setAttribute\('playsinline'/)
assert.match(src, /el\.loop = true/)
assert.match(src, /claimPlayAndRecordSessionFromGesture\(\)/)
assert.match(src, /restorePlaybackSessionAfterMic\(\)/)
assert.match(src, /wantedSession = countLiveMicTracks\(\)\.live > 0 \? 'play-and-record' : 'playback'/)
assert.match(src, /applyNativeAudioSession\(type\)/)
assert.match(src, /from '@\/native\/ios-audio-session'/)
assert.match(src, /from '@\/lib\/native-origin'/)
assert.match(src, /isNativeApp\(\)/)
assert.match(src, /stopSilentHtmlAudio\(\)/)
assert.match(src, /suspendPlaybackAfterStop\(\)/)
assert.match(src, /from '@\/lib\/now-playing'/)
assert.match(src, /primeNowPlayingMetadata\(\)/)
assert.match(src, /session \$\{type\} deferred/)
assert.match(src, /type !== 'play-and-record'/)
assert.match(src, /waitUntilPlaybackRunning/)
assert.match(src, /rebuildPlaybackIfInterrupted/)
assert.equal(playbackContextShouldRebuild('interrupted'), true)
assert.equal(playbackContextShouldRebuild('closed'), true)
assert.equal(playbackContextShouldRebuild('running'), false)
assert.equal(playbackContextShouldRebuild('suspended'), false)
assert.match(src, /listenNativeSession/)
assert.match(readFileSync(new URL('../src/hooks/useRhythmEngine.ts', import.meta.url), 'utf8'), /visibilityState !== 'hidden'/)
assert.match(readFileSync(new URL('../src/lib/now-playing.ts', import.meta.url), 'utf8'), /ignoreRemoteEcho/)
assert.match(readFileSync(new URL('../src/lib/audio-log.ts', import.meta.url), 'utf8'), /MAX_EVENTS = 10/)

const claimFn = src.slice(src.indexOf('export function claimPlaybackSessionFromGesture'))
const nativeGuard = claimFn.indexOf('if (isNativeApp())')
const htmlUnlock = claimFn.indexOf('startSilentHtmlAudioFromGesture()')
assert.ok(nativeGuard > 0, 'native app must skip HTMLAudioElement unlock')
assert.ok(htmlUnlock > nativeGuard, 'HTMLAudioElement unlock must come after the native skip')
assert.match(claimFn.slice(nativeGuard, htmlUnlock), /return/)

const nativeSession = readFileSync(new URL('../src/native/ios-audio-session.ts', import.meta.url), 'utf8')
assert.match(nativeSession, /kind === 'play-and-record' \? 'playAndRecord' : 'playback'/)
assert.match(nativeSession, /setNowPlaying/)

const rhythmSrc = readFileSync(new URL('../src/lib/rhythm-audio.ts', import.meta.url), 'utf8')
assert.doesNotMatch(rhythmSrc, /document\.createElement\(\s*['"]audio['"]/)
assert.doesNotMatch(rhythmSrc, /mediaSession/)
const toneSrc = readFileSync(new URL('../src/lib/reference-tone.ts', import.meta.url), 'utf8')
assert.doesNotMatch(toneSrc, /document\.createElement\(\s*['"]audio['"]/)
assert.doesNotMatch(toneSrc, /mediaSession/)
const chimeSrc = readFileSync(new URL('../src/lib/in-tune-chime.ts', import.meta.url), 'utf8')
assert.doesNotMatch(chimeSrc, /document\.createElement\(\s*['"]audio['"]/)
assert.doesNotMatch(chimeSrc, /mediaSession/)

const wav = silentWavDataUrl()
assert.match(wav, /^data:audio\/wav;base64,/)
const raw = Buffer.from(wav.slice('data:audio/wav;base64,'.length), 'base64')
assert.equal(raw.subarray(0, 4).toString('ascii'), 'RIFF')
assert.equal(raw.subarray(8, 12).toString('ascii'), 'WAVE')
assert.equal(raw.readUInt16LE(20), 1)
assert.equal(raw.readUInt16LE(22), 1)
assert.equal(raw.readUInt32LE(24), 8000)
assert.equal(raw.readUInt16LE(34), 16)
assert.ok(raw.length > 44)

assert.equal(applyNativeAudioSession('playback'), false)

resetAudioSessionForTests()
const session = installSession('auto')
assert.equal(hasSafariAudioSession(), true)
claimPlaybackSessionFromGesture()
assert.equal(session.type, 'playback')
assert.equal(getAudioSessionType(), 'playback')
assert.equal(getWantedAudioSession(), 'playback')
assert.equal(getSilentHtmlState(), 'none')

claimPlaybackSessionFromGesture()
assert.equal(session.type, 'playback')

claimPlayAndRecordSessionFromGesture()
assert.equal(session.type, 'play-and-record')
assert.equal(getWantedAudioSession(), 'play-and-record')

restorePlaybackSessionAfterMic()
assert.equal(session.type, 'playback')
assert.equal(getWantedAudioSession(), 'playback')

const created: Array<{
  playsInline: boolean
  loop: boolean
  src: string
  attrs: string[]
  play: () => Promise<void>
  pause: () => void
  paused: boolean
  remove: () => void
  setAttribute: (name: string, value: string) => void
}> = []

const previousDocument = globalThis.document
const fakeDocument = {
  documentElement: {
    appendChild(el: (typeof created)[number]) {
      created.push(el)
      return el
    },
  },
  createElement(tag: string) {
    assert.equal(tag, 'audio')
    const attrs: string[] = []
    const el = {
      playsInline: false,
      loop: false,
      preload: '',
      controls: true,
      defaultMuted: true,
      muted: true,
      volume: 0,
      src: '',
      paused: true,
      style: { cssText: '' },
      attrs,
      setAttribute(name: string) {
        attrs.push(name)
      },
      play() {
        el.paused = false
        return Promise.resolve()
      },
      pause() {
        el.paused = true
      },
      remove() {},
    }
    return el
  },
}
Object.defineProperty(globalThis, 'document', { configurable: true, value: fakeDocument })

resetAudioSessionForTests()
removeSession()
assert.equal(hasSafariAudioSession(), false)
claimPlaybackSessionFromGesture()
assert.equal(getWantedAudioSession(), 'playback')
assert.equal(created.length, 1)
assert.equal(created[0]?.playsInline, true)
assert.equal(created[0]?.loop, true)
assert.ok(created[0]?.attrs.includes('playsinline'))
assert.ok(created[0]?.attrs.includes('webkit-playsinline'))
assert.match(created[0]?.src ?? '', /^data:audio\/wav;base64,/)
assert.equal(getSilentHtmlState(), 'playing')

resetAudioSessionForTests()
created.length = 0
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: { protocol: 'capacitor:' },
    Capacitor: { isNativePlatform: () => true },
  },
})
removeSession()
claimPlaybackSessionFromGesture()
assert.equal(getWantedAudioSession(), 'playback')
assert.equal(created.length, 0, 'native app must not unlock with HTMLAudioElement')
assert.equal(getSilentHtmlState(), 'none')
if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
else delete (globalThis as { window?: unknown }).window

resetAudioSessionForTests()
Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument })
removeSession()

const rhythm = readFileSync(new URL('../src/pages/RhythmPage.tsx', import.meta.url), 'utf8')
assert.match(rhythm, /preparePlaybackFromGesture\(\)/)
const playTap = rhythm.slice(rhythm.indexOf('const startStop = useCallback'))
assert.ok(playTap.indexOf('claimNowPlaying()') < playTap.indexOf('preparePlaybackFromGesture()'))
assert.ok(playTap.indexOf('waitUntilPlaybackRunning(ctx)') < playTap.indexOf('setPlaying(true)'))
assert.ok(playTap.indexOf('preparePlaybackFromGesture()') < playTap.indexOf('waitUntilPlaybackRunning(ctx)'))

const mic = readFileSync(new URL('../src/lib/mic-capture.ts', import.meta.url), 'utf8')
assert.match(mic, /prepareCaptureFromGesture\(\)/)

const tone = readFileSync(new URL('../src/lib/reference-tone.ts', import.meta.url), 'utf8')
assert.match(tone, /getSharedAudioContext\(\)/)

assert.equal(formatNowPlayingSubtitle({ mode: 'click', bpm: 120, meter: '4/4' }), 'Click · 120 BPM · 4/4')
assert.equal(
  formatNowPlayingSubtitle({ mode: 'drums', bpm: 88, beatName: 'Backbeat' }),
  'Drums · Backbeat · 88 BPM',
)
assert.doesNotMatch(formatNowPlayingSubtitle({ mode: 'click', bpm: 100, meter: '3/4' }), /localhost/)

class FakeMetadata {
  title: string
  artist: string
  album: string
  artwork: unknown
  constructor(init: { title: string; artist?: string; album?: string; artwork?: unknown }) {
    this.title = init.title
    this.artist = init.artist ?? ''
    this.album = init.album ?? ''
    this.artwork = init.artwork
  }
}
;(globalThis as { MediaMetadata?: unknown }).MediaMetadata = FakeMetadata
const fakeMediaSession = {
  metadata: null as FakeMetadata | null,
  playbackState: 'none',
  setActionHandler() {},
}
Object.defineProperty(globalThis.navigator, 'mediaSession', {
  configurable: true,
  value: fakeMediaSession,
})
resetNowPlayingForTests()
primeNowPlayingMetadata()
assert.equal(fakeMediaSession.metadata?.title, 'Omnician')
assert.notEqual(fakeMediaSession.metadata?.title, 'localhost')
publishNowPlaying({ title: 'Omnician', subtitle: 'Click · 120 BPM · 4/4', playing: true })
assert.equal(peekNowPlaying()?.title, 'Omnician')
assert.equal(fakeMediaSession.metadata?.title, 'Omnician')
assert.equal(fakeMediaSession.metadata?.artist, 'Click · 120 BPM · 4/4')
assert.notEqual(fakeMediaSession.metadata?.title, 'localhost')
assert.equal(fakeMediaSession.playbackState, 'playing')

resetAudioEventsForTests()
noteAudioEvent('ctx running')
noteAudioEvent('av interrupt-began')
assert.match(audioEventLine(), /ctx running/)
assert.match(audioEventLine(), /interrupt-began/)

resetNativeAudioSessionForTests()
const nativeCalls: string[] = []
let nativeCategory = 'playAndRecord'
installNativeAudioPluginForTests({
  async setSession({ category }) {
    nativeCalls.push(`start:${category}`)
    await new Promise((resolve) => setTimeout(resolve, 15))
    nativeCategory = category
    nativeCalls.push(`done:${category}`)
    return { category, options: 'none', otherAudioPlaying: false }
  },
})
assert.equal(applyNativeAudioSession('playback'), true)
assert.equal(applyNativeAudioSession('play-and-record'), true, 'tuner must not skip playAndRecord after an in-flight playback write')
await flushNativeAudioSessionForTests()
assert.deepEqual(nativeCalls, ['start:playAndRecord', 'done:playAndRecord'])
assert.equal(peekNativeAudioSession()?.category, 'playAndRecord')
assert.equal(nativeCategory, 'playAndRecord')

nativeCalls.length = 0
assert.equal(applyNativeAudioSession('playback'), true)
await flushNativeAudioSessionForTests()
assert.deepEqual(nativeCalls, ['start:playback', 'done:playback'])
nativeCalls.length = 0
assert.equal(applyNativeAudioSession('playback'), true, 'confirmed redundant playback may skip')
await flushNativeAudioSessionForTests()
assert.deepEqual(nativeCalls, [])
resetNativeAudioSessionForTests()

assert.match(rhythm, /publishNowPlaying/)
assert.match(rhythm, /bindNowPlayingTransport/)
assert.match(readFileSync(new URL('../src/lib/speed-builder.ts', import.meta.url), 'utf8'), /if \(isNativeApp\(\)\) return/)
assert.doesNotMatch(readFileSync(new URL('../src/lib/rhythm-audio.ts', import.meta.url), 'utf8'), /window\.speechSynthesis|SpeechSynthesisUtterance/)

console.log('audio-session: ok')
