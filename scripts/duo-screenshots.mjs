import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.OMNICIAN_URL || 'http://127.0.0.1:43121'
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts'
const CLUSTER_W = 88
const CLUSTER_H = 54

mkdirSync(OUT, { recursive: true })

function box(el) {
  return el.boundingBox()
}

function overlapsCluster(rect, width) {
  if (!rect) return false
  const cluster = { x: width - CLUSTER_W, y: 0, w: CLUSTER_W, h: CLUSTER_H }
  return !(
    rect.x + rect.width <= cluster.x ||
    rect.x >= cluster.x + cluster.w ||
    rect.y + rect.height <= cluster.y ||
    rect.y >= cluster.y + cluster.h
  )
}

function inViewport(rect, width, height, pad = 1) {
  if (!rect) return false
  return (
    rect.x >= -pad &&
    rect.y >= -pad &&
    rect.x + rect.width <= width + pad &&
    rect.y + rect.height <= height + pad
  )
}

const shots = []
const notes = []

function fail(msg) {
  notes.push(`FAIL: ${msg}`)
  throw new Error(msg)
}

function ok(msg) {
  notes.push(`ok: ${msg}`)
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true,
})
const page = await context.newPage()

async function shot(name) {
  const path = `${OUT}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  shots.push(path)
  return path
}

async function goto(path, width, height) {
  await page.setViewportSize({ width, height })
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(450)
}

async function assertNoRotateBack(label) {
  const n = await page.locator('[data-rotate-back]').count()
  if (n) fail(`${label}: rotate-back overlay should be hidden`)
  ok(`${label}: no rotate-back`)
}

async function assertRotateBack(label) {
  const vis = await page.locator('[data-rotate-back]').isVisible().catch(() => false)
  if (!vis) fail(`${label}: expected rotate-back overlay`)
  ok(`${label}: rotate-back shown`)
}

async function assertClearOfCluster(selector, label, width) {
  const loc = page.locator(selector).first()
  if (!(await loc.count())) fail(`${label}: missing ${selector}`)
  const rect = await loc.boundingBox()
  if (overlapsCluster(rect, width)) {
    fail(`${label}: ${selector} overlaps Duo cluster (${JSON.stringify(rect)})`)
  }
  ok(`${label}: ${selector} clears cluster`)
}

// 1. Duo unfolded portrait home 704x1024
await goto('/', 704, 1024)
await assertNoRotateBack('704x1024 home')
await assertClearOfCluster('[data-home-logo]', '704x1024 home', 704)
await shot('duo-704x1024-home')

const logo = await page.locator('[data-home-logo]').boundingBox()
if (!logo) fail('home logo missing')
if (logo.width > 704 * 0.7) fail(`home logo too wide: ${logo.width}`)
ok(`home logo width ${Math.round(logo.width)}`)

// 2. Duo landscape editor 1024x704
await goto('/drums', 1024, 704)
await assertNoRotateBack('1024x704 drums')
await page.waitForSelector('[data-drum-editor]', { timeout: 8000 })
const toolbarIds = [
  '[data-editor-done]',
  '[data-editor-beat-name]',
  '[data-editor-undo]',
  '[data-editor-redo]',
  '[data-editor-bpm]',
  '[data-section="meter"]',
  '[data-intensity-switch]',
  '[data-editor-mixer]',
  '[data-editor-play]',
]
async function assertEditorToolbar(label, width, height) {
  const editor = page.locator('[data-drum-editor]')
  for (const sel of toolbarIds) {
    const loc = editor.locator(sel).first()
    if (!(await loc.isVisible())) fail(`${label}: ${sel} not visible`)
    const rect = await loc.boundingBox()
    if (!inViewport(rect, width, height)) fail(`${label}: ${sel} clipped ${JSON.stringify(rect)}`)
    if (overlapsCluster(rect, width)) fail(`${label}: ${sel} under cluster ${JSON.stringify(rect)}`)
  }
  const china = await editor.locator('[data-grid-last-row]').last().boundingBox()
  if (!china) fail(`${label}: China row missing`)
  if (china.y + china.height > height + 2) fail(`${label}: China clipped bottom=${china.y + china.height}`)
  ok(`${label}: toolbar + China fit`)
}
await assertEditorToolbar('1024x704 editor', 1024, 704)
await shot('duo-1024x704-editor')

// 3. Duo landscape drums 1024x720 → editor (phone-like), must fit
await goto('/drums', 1024, 720)
await assertNoRotateBack('1024x720 drums')
await page.waitForSelector('[data-drum-editor]', { timeout: 8000 })
await assertEditorToolbar('1024x720 editor', 1024, 720)
await shot('duo-1024x720-drums-editor')

// 4. Duo unfolded portrait drums 720x1024 → turn to edit
await goto('/drums', 720, 1024)
await assertNoRotateBack('720x1024 drums')
const editorPortrait = await page.locator('[data-drum-editor]').isVisible().catch(() => false)
if (editorPortrait) fail('720x1024 drums should not auto-open editor')
const turnVis = await page.locator('[data-turn-to-edit]').isVisible()
if (!turnVis) fail('720x1024 drums missing Turn device to edit beat')
const inlineGrid = await page.locator('[data-rhythm-mode="drums"] [data-drum-grid]').isVisible().catch(() => false)
if (inlineGrid) fail('720x1024 drums should hide inline grid')
await assertClearOfCluster('[data-settings-gear]', '720x1024 drums', 720)
ok('720x1024 turn-to-edit')
await shot('duo-720x1024-drums')

// 5. 1024x720 editor already captured; extra home landscape Duo
await goto('/', 1024, 720)
await assertNoRotateBack('1024x720 home')
await shot('duo-1024x720-home')

// Phone regressions
await goto('/', 430, 932)
await assertNoRotateBack('430x932 home')
await shot('phone-430x932-home')

await goto('/drums', 430, 932)
const phoneTurn = await page.locator('[data-turn-to-edit]').isVisible()
if (!phoneTurn) fail('430x932 drums missing turn-to-edit')
if (await page.locator('[data-drum-editor]').isVisible().catch(() => false)) {
  fail('430x932 drums should not open editor')
}
ok('430x932 drums turn-to-edit')
await shot('phone-430x932-drums')

await goto('/', 932, 430)
await assertRotateBack('932x430 home')
await shot('phone-932x430-home')

await goto('/drums', 932, 430)
await page.waitForSelector('[data-drum-editor]', { timeout: 8000 })
if (await page.locator('[data-rotate-back]').isVisible().catch(() => false)) {
  fail('932x430 drums should not show rotate-back (editor open)')
}
await assertEditorToolbar('932x430 editor', 932, 430)
await shot('phone-932x430-drums-editor')

await browser.close()
writeFileSync(`${OUT}/duo-notes.txt`, notes.join('\n') + '\nshots:\n' + shots.join('\n') + '\n')
console.log(notes.join('\n'))
console.log('shots', shots.length)
