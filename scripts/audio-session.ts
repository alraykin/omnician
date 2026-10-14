import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  claimPlayAndRecordSessionFromGesture,
  claimPlaybackSessionFromGesture,
  getAudioSessionType,
  getSilentHtmlState,
  getWantedAudioSession,
  hasSafariAudioSession,
  resetAudioSessionForTests,
  restorePlaybackSessionAfterMic,
  silentWavDataUrl,
} from '../src/lib/audio-context.ts'

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
Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument })
removeSession()

const rhythm = readFileSync(new URL('../src/pages/RhythmPage.tsx', import.meta.url), 'utf8')
assert.match(rhythm, /preparePlaybackFromGesture\(\)/)

const mic = readFileSync(new URL('../src/lib/mic-capture.ts', import.meta.url), 'utf8')
assert.match(mic, /prepareCaptureFromGesture\(\)/)

const tone = readFileSync(new URL('../src/lib/reference-tone.ts', import.meta.url), 'utf8')
assert.match(tone, /getSharedAudioContext\(\)/)

console.log('audio-session: ok')
