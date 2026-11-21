#!/usr/bin/env node
/**
 * Build a 1024 App Store icon and a dark splash from the existing O mark.
 * Requires ffmpeg. Does not talk to Apple.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const source = path.join(root, 'public/brand/omnician-icon-512.png')
const resources = path.join(root, 'resources')
const iconOut = path.join(resources, 'icon.png')
const splashOut = path.join(resources, 'splash.png')

if (!existsSync(source)) {
  console.error('Missing', source)
  process.exit(1)
}

mkdirSync(resources, { recursive: true })

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], {
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.error('ffmpeg failed:', args.join(' '))
    process.exit(result.status ?? 1)
  }
}

const dark = '0x0B0F1A'
const circleAlpha =
  "r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-W/2,Y-H/2),W*0.48),255,0)'"

ffmpeg([
  '-y',
  '-f',
  'lavfi',
  '-i',
  `color=c=${dark}:s=1024x1024`,
  '-i',
  source,
  '-filter_complex',
  `[1:v]scale=1024:1024:flags=lanczos,format=rgba,geq=${circleAlpha}[icon];[0:v][icon]overlay=0:0`,
  '-frames:v',
  '1',
  iconOut,
])

ffmpeg([
  '-y',
  '-f',
  'lavfi',
  '-i',
  `color=c=${dark}:s=2732x2732`,
  '-i',
  source,
  '-filter_complex',
  `[1:v]scale=720:720:flags=lanczos,format=rgba,geq=${circleAlpha}[icon];[0:v][icon]overlay=(W-w)/2:(H-h)/2`,
  '-frames:v',
  '1',
  splashOut,
])

const iosIcon = path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
const splashDir = path.join(root, 'ios/App/App/Assets.xcassets/Splash.imageset')
if (existsSync(path.dirname(iosIcon))) {
  copyFileSync(iconOut, iosIcon)
}
if (existsSync(splashDir)) {
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    copyFileSync(splashOut, path.join(splashDir, name))
  }
}

console.log('Wrote', iconOut)
console.log('Wrote', splashOut)
