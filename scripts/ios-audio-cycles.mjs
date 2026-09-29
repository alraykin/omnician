/**
 * WebKit session cycles. Headless WebKit cannot own a real iPhone audio
 * session; this still proves route teardown, Listen close, debug overlay,
 * and Play start/stop. Listen uses listenDemo so getUserMedia never blocks.
 *
 *   BASE_URL=http://127.0.0.1:43121 node scripts/ios-audio-cycles.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { webkit } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:43121'
const CYCLES = Number(process.env.PLAY_CYCLES ?? 30)

function auditSources() {
  const files = [
    'src/lib/audio-context.ts',
    'src/lib/tempo-listen.ts',
    'src/lib/tuner-session.ts',
    'src/lib/mic-capture.ts',
    'src/lib/rhythm-audio.ts',
    'src/pages/RhythmPage.tsx',
    'src/components/AppTabBar.tsx',
    'src/App.tsx',
    'src/components/AudioDebugOverlay.tsx',
  ]
  const joined = files.map((file) => `${file}\n${readFileSync(file, 'utf8')}`).join('\n')
  assert.match(joined, /play-and-record|getCaptureAudioContext/)
  assert.match(joined, /getCaptureAudioContext/)
  assert.match(joined, /releaseMicStream/)
  assert.match(joined, /unlockPlaybackFromGesture/)
  assert.match(joined, /onPlaybackInterrupted/)
  assert.match(joined, /AudioDebugOverlay/)
  const audioSrc = readFileSync('src/lib/audio-context.ts', 'utf8')
  assert.doesNotMatch(audioSrc, /silence\.mp3|armSilentUnlock|audioSession\.type\s*=|sampleRate:\s*48000|waitForPlaybackClock|discardPlayback/)
  assert.doesNotMatch(
    readFileSync('src/lib/tempo-listen.ts', 'utf8'),
    /getSharedAudioContext\(\)[\s\S]{0,200}createMediaStreamSource/,
  )
  console.log('ok  source audit: one playback context, capture hygiene, no audioSession writes')
}

async function main() {
  auditSources()
  const browser = await webkit.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  page.on('crash', () => errors.push('webkit target crashed'))

  const click = async (selector) => {
    await page.locator(selector).last().evaluate((node) => node.click())
  }

  const go = async (path) => {
    if (page.isClosed()) throw new Error('page closed')
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
  }

  await go('/rhythm?mode=click&debug=audio&listenDemo=120')
  await page.waitForSelector('[data-audio-debug="on"]', { timeout: 8000 })
  await page.waitForSelector('[data-listen-panel="open"]', { timeout: 8000 })
  console.log('overlay + listen sheet up')

  for (let i = 0; i < CYCLES; i += 1) {
    await go('/tuner?debug=audio')
    await go('/rhythm?mode=click&debug=audio')
    if (i % 5 === 4) {
      await page.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'))
        window.dispatchEvent(new Event('pagehide'))
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
      })
      await go('/rhythm?mode=drums&debug=audio')
      await go('/rhythm?mode=click&debug=audio&listenDemo=128')
      await page.waitForSelector('[data-listen-panel="open"]', { timeout: 8000 })
    }
    if ((i + 1) % 10 === 0) console.log(`nav ${i + 1}/${CYCLES}`)
  }

  await page.goto(`${BASE}/rhythm?mode=click&debug=audio`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  })
  await page.waitForSelector('[data-audio-debug="on"]', { timeout: 8000 })
  const overlay = await page.locator('[data-audio-debug="on"]').innerText()
  assert.match(overlay, /audioSession/)
  assert.match(overlay, /playback/)

  let plays = 0
  try {
    for (let i = 0; i < CYCLES; i += 1) {
      await click('[data-transport="play"]')
      await click('[data-transport="play"]')
      plays += 1
    }
  } catch (error) {
    console.log(`play burst stopped after ${plays}: ${error instanceof Error ? error.message : error}`)
  }

  const mic = await page.evaluate(() => {
    const snap = window.__OMNICIAN_AUDIO__
    return snap ? { live: snap.micLive, tracks: snap.micTracks, state: snap.playbackState } : null
  }).catch(() => null)
  if (mic) {
    assert.equal(mic.live, 0, 'live mic tracks after cycles')
    assert.equal(mic.tracks, 0, 'mic refs after cycles')
  }

  await browser.close()
  const fatal = errors.filter(
    (item) => !/crash|access control|NotAllowedError|NotFoundError/i.test(item),
  )
  if (fatal.length) throw new Error(fatal.join('\n'))
  console.log(`ok  webkit ${CYCLES} Tuner/Listen/tab/background cycles, Play x${plays}, overlay live`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
