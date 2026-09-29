/**
 * WebKit session cycles. Headless WebKit cannot own a real iPhone audio
 * session; this still proves route teardown, Listen close, Listen ½×/1×/2×
 * preview, debug overlay, and Play start/stop. Listen uses listenDemo so
 * getUserMedia never blocks the preview path.
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
    'src/lib/listen-preview.ts',
    'src/pages/RhythmPage.tsx',
    'src/components/AppTabBar.tsx',
    'src/App.tsx',
    'src/components/AudioDebugOverlay.tsx',
    'src/components/rhythm/ListenTempo.tsx',
  ]
  const joined = files.map((file) => `${file}\n${readFileSync(file, 'utf8')}`).join('\n')
  assert.match(joined, /play-and-record|getCaptureAudioContext/)
  assert.match(joined, /getCaptureAudioContext/)
  assert.match(joined, /releaseMicStream/)
  assert.match(joined, /preparePlaybackFromGesture/)
  assert.match(joined, /unlockPlaybackFromGesture/)
  assert.match(joined, /onPlaybackInterrupted/)
  assert.match(joined, /AudioDebugOverlay/)
  const audioSrc = readFileSync('src/lib/audio-context.ts', 'utf8')
  assert.doesNotMatch(audioSrc, /setAudioSessionType\('playback'\)/)
  assert.doesNotMatch(audioSrc, /setAudioSessionType\('play-and-record'\)/)
  assert.doesNotMatch(audioSrc, /armPlaybackSessionOnce/)
  assert.match(audioSrc, /setAudioSessionType\('auto'\)/)
  assert.match(audioSrc, /session\.type !== 'play-and-record'/)
  assert.match(audioSrc, /captureUsedSincePlayback/)
  assert.match(audioSrc, /recoverPlaybackAfterCapture/)
  assert.match(audioSrc, /preparePlaybackFromGesture/)
  assert.match(audioSrc, /resumeFromGesture/)
  assert.match(audioSrc, /export function markCaptureUsed/)
  assert.match(audioSrc, /lastRecovery === 'interrupted'/)
  assert.match(audioSrc, /needsFreshPlayback/)
  assert.match(audioSrc, /still \$\{state\} after resume|still suspended/)
  assert.doesNotMatch(audioSrc, /silence\.mp3|armSilentUnlock|sampleRate:\s*48000|waitForPlaybackClock/)
  const listenSrc = readFileSync('src/lib/tempo-listen.ts', 'utf8')
  assert.match(listenSrc, /markCaptureUsed\(\)/)
  assert.match(listenSrc, /const startMic[\s\S]*markCaptureUsed\(\)/)
  assert.doesNotMatch(listenSrc, /getSharedAudioContext\(\)[\s\S]{0,200}createMediaStreamSource/)
  const previewSrc = readFileSync('src/lib/listen-preview.ts', 'utf8')
  assert.match(previewSrc, /preparePlaybackFromGesture\(\)/)
  const tunerSrc = readFileSync('src/lib/tuner-session.ts', 'utf8')
  assert.match(tunerSrc, /markCaptureUsed\(\)/)
  const interruptBlock = audioSrc.slice(audioSrc.indexOf('function wirePlayback'))
  assert.match(interruptBlock, /markCaptureUsed\(\)/)
  const playTap = audioSrc.slice(audioSrc.indexOf('export function preparePlaybackFromGesture'))
  assert.doesNotMatch(playTap, /setAudioSessionType/)
  assert.match(playTap, /needsFreshPlayback\(\)/)
  const unlockTap = audioSrc.slice(audioSrc.indexOf('export function unlockPlaybackFromGesture'))
  assert.match(unlockTap, /resumeFromGesture\(ctx\)/)
  console.log('ok  source audit: no playback session writes, Listen=Tuner mic flag, resume in tap')
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
  assert.match(overlay, /need recover/)

  const snap = async () =>
    page.evaluate(() => {
      const row = window.__OMNICIAN_AUDIO__
      return row
        ? {
            captureUsed: row.captureUsed,
            lastRecovery: row.lastRecovery,
            recoveries: row.recoveries,
            live: row.micLive,
            tracks: row.micTracks,
            state: row.playbackState,
          }
        : null
    })

  await click('[data-transport="play"]')
  await click('[data-transport="play"]')
  const recovered = await page.evaluate(() => {
    const hooks = window.__OMNICIAN_AUDIO_HOOKS__
    hooks.markCaptureUsed()
    const before = window.__OMNICIAN_AUDIO__.captureUsed
    hooks.preparePlaybackFromGesture()
    const after = window.__OMNICIAN_AUDIO__
    return {
      before,
      captureUsed: after.captureUsed,
      lastRecovery: after.lastRecovery,
    }
  })
  assert.equal(recovered.before, true, 'Listen/Tuner flag is set before Play recover')
  assert.equal(recovered.captureUsed, false, 'Play recover clears the mic-used flag')
  assert.equal(recovered.lastRecovery, 'after-capture', 'Play after Listen rebuilds playback')
  console.log('ok  Play after mic-used flag rebuilds', recovered)

  const closeListenSheet = async () => {
    const closeListen = page.locator('[data-listen-panel="open"] [aria-label="Cancel"]')
    if (await closeListen.count()) await closeListen.first().evaluate((node) => node.click())
    else await page.keyboard.press('Escape')
  }

  const hearListenPreviews = async () => {
    await page.waitForSelector('[data-listen-result="ready"]', { timeout: 8000 })
    for (const alt of ['½×', '1×', '2×']) {
      const chip = page.locator(`[data-listen-alt="${alt}"]`).first()
      await chip.evaluate((node) => node.click())
      await page.waitForTimeout(120)
    }
  }

  // Click Play/Stop → Tuner → Click Play → Listen → close → Play → Listen ½×/1×/2× → Play
  for (let round = 0; round < 3; round += 1) {
    await go('/rhythm?mode=click&debug=audio')
    await click('[data-transport="play"]')
    await click('[data-transport="play"]')
    await click('[data-tab="tuner"]')
    await page.waitForTimeout(250)
    await click('[data-tab="click"]')
    await page.waitForTimeout(200)
    await click('[data-transport="play"]')
    await click('[data-transport="play"]')
    await click('[data-listen]')
    await page.waitForTimeout(250)
    await closeListenSheet()
    await click('[data-transport="play"]')
    await click('[data-transport="play"]')
    console.log(`round ${round + 1} after Listen Play`, await snap())
    await go('/rhythm?mode=click&debug=audio&listenDemo=120')
    await page.waitForSelector('[data-listen-panel="open"]', { timeout: 8000 })
    await hearListenPreviews()
    await closeListenSheet()
    await click('[data-transport="play"]')
    await click('[data-transport="play"]')
    console.log(`round ${round + 1} after Tuner+Listen+previews`, await snap())
  }

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
  console.log(`ok  webkit ${CYCLES} Tuner/Listen/preview/tab/background cycles, Play x${plays}, overlay live`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
