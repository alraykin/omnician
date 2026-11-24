/**
 * Real layout check: laptop-mode sheets must be visible in the bottom half.
 * Covers Tuner tunings + A4, Click presets, and Drums beat library.
 */
import assert from 'node:assert/strict'

import { chromium, type Page } from 'playwright-core'

import { FOLD_LAPTOP } from '../src/lib/fold-mode.ts'
import { overlaySheetVisibleInLaptopBottom } from '../src/lib/overlay-bounds.ts'

const BASE = process.env.OMNICIAN_BASE_URL ?? 'http://127.0.0.1:43121'

type Box = { top: number; bottom: number; height: number; width: number }

async function sheetBox(
  page: Page,
  host: string,
  dialog = '[role="dialog"]',
): Promise<Box> {
  const hostEl = page.locator(host).first()
  await hostEl.waitFor({ state: 'visible', timeout: 8000 })
  const target = hostEl.locator(dialog).first()
  const node = (await target.count()) > 0 ? target : hostEl
  const handle = await node.elementHandle()
  assert.ok(handle, `${host} rendered no element`)
  const box = await handle.boundingBox()
  assert.ok(box, `${host} has no bounding box`)
  return {
    top: box.y,
    bottom: box.y + box.height,
    height: box.height,
    width: box.width,
  }
}

function assertBottomHalf(label: string, box: Box, height: number): void {
  assert.ok(
    overlaySheetVisibleInLaptopBottom(box, height),
    `${label} must sit in the laptop bottom half (got top=${box.top.toFixed(1)} h=${box.height.toFixed(1)} vh=${height})`,
  )
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
  headless: true,
})

try {
  const page = await browser.newPage({ viewport: { width: FOLD_LAPTOP.width, height: FOLD_LAPTOP.height } })
  page.setDefaultTimeout(12000)

  await page.goto(`${BASE}/tuner?fold=laptop`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-fold-shell]').waitFor({ state: 'visible' })
  await page.locator('[data-fold-shell] [data-tuning-change]').click()
  const tunings = await sheetBox(page, '[data-tuning-sheet]')
  assertBottomHalf('TuningSheet', tunings, FOLD_LAPTOP.height)
  await page.locator('[data-tuning-sheet]').evaluate((node) => {
    const host = node.closest('[data-overlay-host]') ?? node
    ;(host as HTMLElement).click()
  })
  await page.locator('[data-tuning-sheet]').waitFor({ state: 'hidden' }).catch(() => undefined)

  await page.locator('[data-fold-shell] [data-a4-open]').click()
  const a4 = await sheetBox(page, '[data-a4-sheet]')
  assertBottomHalf('A4 sheet', a4, FOLD_LAPTOP.height)

  await page.goto(`${BASE}/click?fold=laptop`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-fold-shell]').waitFor({ state: 'visible' })
  await page.locator('[data-fold-shell] [data-click-preset-chip]').click()
  const presets = await sheetBox(page, '[data-click-presets-sheet]')
  assertBottomHalf('Click presets', presets, FOLD_LAPTOP.height)

  await page.goto(`${BASE}/drums?fold=laptop`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-fold-shell]').waitFor({ state: 'visible' })
  await page.locator('[data-fold-shell] [data-editor-beat-name]').click()
  const library = await sheetBox(page, '[data-beat-library-sheet]')
  assertBottomHalf('Beat library', library, FOLD_LAPTOP.height)

  console.log('laptop-sheets: ok')
} finally {
  await browser.close()
}
