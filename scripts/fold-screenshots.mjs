import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from 'puppeteer-core'

const root = dirname(fileURLToPath(new URL('..', import.meta.url)))
const outDir = '/opt/cursor/artifacts'
mkdirSync(outDir, { recursive: true })
mkdirSync('/cursor/stores/self', { recursive: true })

const chrome =
  process.env.CHROME_PATH ||
  '/usr/bin/google-chrome-stable'

const base = process.env.OMNICIAN_URL || 'http://127.0.0.1:43121'

const shots = [
  { name: 'header-390x844', width: 390, height: 844, path: '/click', clip: { x: 0, y: 0, width: 390, height: 140 } },
  { name: 'header-720x1024', width: 720, height: 1024, path: '/click', clip: { x: 0, y: 0, width: 720, height: 160 } },
  { name: 'click-932x430', width: 932, height: 430, path: '/click' },
]

const browser = await launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
})

try {
  for (const shot of shots) {
    const page = await browser.newPage()
    await page.setViewport({ width: shot.width, height: shot.height, deviceScaleFactor: 2 })
    await page.goto(`${base}${shot.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('[data-app-frame], [data-fold-tent], [data-rotate-back]', { timeout: 20000 })
    await new Promise((r) => setTimeout(r, 400))
    const file = join(outDir, `${shot.name}.png`)
    await page.screenshot({ path: file, clip: shot.clip, fullPage: false })
    const copy = join('/cursor/stores/self', `${shot.name}.png`)
    await page.screenshot({ path: copy, clip: shot.clip, fullPage: false })
    const foldBtn = await page.$('[data-fold-button]')
    const tent = await page.$('[data-fold-tent]')
    const rotate = await page.$('[data-rotate-back]')
    console.log(
      shot.name,
      'foldBtn',
      Boolean(foldBtn),
      'tent',
      Boolean(tent),
      'rotateBack',
      Boolean(rotate),
      '→',
      file,
    )
    await page.close()
  }
} finally {
  await browser.close()
}
