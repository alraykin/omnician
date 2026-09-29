/**
 * WebKit session cycles: Tuner ↔ Listen ↔ Play ×30, tab switches, backgrounding.
 * Headless WebKit cannot open a real mic; this still proves the JS teardown,
 * playback resume, debug overlay, and that no MediaStream is attached to playback.
 *
 *   BASE_URL=http://127.0.0.1:43121 npm run test:ios-audio
 */
import assert from 'node:assert/strict'

import { webkit, type Page } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:43121'
const CYCLES = Number(process.env.PLAY_CYCLES ?? 30)

type AudioSnap = {
  playbackState: string
  playbackRate: number | null
  playbackTime: number
  timeAdvancing: boolean
  captureState: string
  sessionType: string
  micTracks: number
  micLive: number
  recoveries: number
}

async function snap(page: Page): Promise<AudioSnap> {
  return page.evaluate(() => {
    const read = (window as Window & { __OMNICIAN_AUDIO__?: AudioSnap }).__OMNICIAN_AUDIO__
    return (
      read ?? {
        playbackState: 'none',
        playbackRate: null,
        playbackTime: 0,
        timeAdvancing: false,
        captureState: 'none',
        sessionType: 'unsupported',
        micTracks: 0,
        micLive: 0,
        recoveries: 0,
      }
    )
  })
}

async function tap(page: Page, selector: string): Promise<void> {
  const el = page.locator(selector).first()
  await el.waitFor({ state: 'visible', timeout: 8000 })
  await el.click({ force: true })
}

async function background(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pagehide'))
  })
  await page.waitForTimeout(40)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
  })
}

async function assertNoLiveMic(page: Page, label: string): Promise<void> {
  const state = await snap(page)
  assert.equal(state.micLive, 0, `${label}: live mic tracks should be 0, got ${state.micLive}`)
  assert.equal(state.micTracks, 0, `${label}: mic track refs should be 0, got ${state.micTracks}`)
}

async function main(): Promise<void> {
  const browser = await webkit.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(`${BASE}/rhythm?mode=click&debug=audio`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-audio-debug="on"]', { timeout: 8000 })
  await tap(page, '[data-transport="play"]')
  await page.waitForTimeout(80)
  const afterPlay = await snap(page)
  assert.notEqual(afterPlay.playbackState, 'closed', 'playback context must exist after Play')
  await tap(page, '[data-transport="play"]')

  for (let i = 0; i < CYCLES; i += 1) {
    await tap(page, '[data-tab="tuner"]')
    await page.waitForURL(/\/tuner/, { timeout: 8000 })
    await tap(page, '[data-tab="click"]')
    await page.waitForURL(/mode=click/, { timeout: 8000 })
    await tap(page, '[data-listen]')
    await page.waitForSelector('[data-listen-panel="open"]', { timeout: 8000 })
    await page.locator('[data-listen-panel="open"] button[aria-label="Cancel"]').click({ force: true })
    await page.waitForTimeout(40)
    await tap(page, '[data-transport="play"]')
    await page.waitForTimeout(30)
    await tap(page, '[data-transport="play"]')
    if (i % 5 === 4) {
      await background(page)
      await tap(page, '[data-tab="drums"]')
      await page.waitForURL(/mode=drums/, { timeout: 8000 })
      await tap(page, '[data-transport="play"]')
      await page.waitForTimeout(30)
      await tap(page, '[data-transport="play"]')
      await tap(page, '[data-tab="click"]')
    }
  }

  await assertNoLiveMic(page, 'after cycles')
  const finalSnap = await snap(page)
  assert.notEqual(finalSnap.playbackState, 'closed', 'playback must not stay closed')
  assert.ok(finalSnap.recoveries < 20, `too many playback recoveries: ${finalSnap.recoveries}`)

  const overlay = await page.locator('[data-audio-debug="on"]').innerText()
  assert.match(overlay, /audioSession/)
  assert.match(overlay, /playback/)

  await browser.close()

  if (errors.length) {
    throw new Error(`page errors:\n${errors.join('\n')}`)
  }
  console.log(`ok  webkit ${CYCLES} Play cycles, Tuner/Listen/tab/background, overlay live`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exit(1)
})
