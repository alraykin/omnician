import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8')
const mustExist = (rel: string) => {
  assert.ok(existsSync(path.join(root, rel)), `missing ${rel}`)
}

const pkg = JSON.parse(read('package.json')) as {
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

assert.equal(pkg.scripts.deploy, 'bash scripts/deploy-cloudflare.sh')
assert.equal(pkg.scripts.build, 'tsc -b && vite build')
assert.ok(pkg.dependencies['@capacitor/core'])
assert.ok(pkg.dependencies['@capacitor/ios'])
assert.ok(pkg.devDependencies['@capacitor/cli'])

const cap = read('capacitor.config.ts')
assert.match(cap, /appId: 'app\.omnician'/)
assert.match(cap, /appName: 'Omnician'/)
assert.match(cap, /webDir: 'dist'/)
assert.match(cap, /backgroundColor: '#0B0F1A'/)

const wrangler = read('wrangler.jsonc')
assert.match(wrangler, /"directory": "\.\/dist"/)

const deploy = read('scripts/deploy-cloudflare.sh')
assert.match(deploy, /npm run build/)
assert.match(deploy, /npx wrangler deploy/)
assert.doesNotMatch(deploy, /cap /)

mustExist('ios/App/App.xcodeproj/project.pbxproj')
mustExist('ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme')
mustExist('ios/App/App.xcworkspace/contents.xcworkspacedata')
mustExist('ios/App/App/Info.plist')
mustExist('ios/App/App/AppDelegate.swift')
mustExist('ios/App/App/OmnicianAudioPlugin.swift')
mustExist('ios/App/App/PrivacyInfo.xcprivacy')
mustExist('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
mustExist('resources/icon.png')
mustExist('resources/splash.png')
mustExist('.github/workflows/ios.yml')
mustExist('docs/ios-native.md')
mustExist('ios/exportOptions.plist')

const info = read('ios/App/App/Info.plist')
assert.match(
  info,
  /<key>NSMicrophoneUsageDescription<\/key>\s*<string>Omnician uses the microphone to tune your instrument\.<\/string>/,
)
assert.match(info, /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/)

const delegate = read('ios/App/App/AppDelegate.swift')
assert.match(delegate, /OmnicianAudioPlugin\.activatePlayback\(\)/)

const plugin = read('ios/App/App/OmnicianAudioPlugin.swift')
assert.match(plugin, /jsName = "OmnicianAudio"/)
assert.match(plugin, /AVAudioSession\.sharedInstance\(\)/)
assert.match(plugin, /\.playback/)
assert.match(plugin, /mixWithOthers/)
assert.match(plugin, /defaultToSpeaker/)

const pbx = read('ios/App/App.xcodeproj/project.pbxproj')
assert.match(pbx, /PRODUCT_BUNDLE_IDENTIFIER = app\.omnician;/)
assert.match(pbx, /OmnicianAudioPlugin\.swift/)

const workflow = read('.github/workflows/ios.yml')
assert.match(workflow, /CODE_SIGNING_ALLOWED=NO/)
assert.match(workflow, /App\.xcworkspace/)
assert.match(workflow, /macos-15/)
assert.match(workflow, /IOS_TESTFLIGHT_ENABLED/)
assert.match(workflow, /APP_STORE_CONNECT_API_KEY_P8/)
assert.match(workflow, /PRODUCT_BUNDLE_IDENTIFIER=app\.omnician/)
assert.match(read('ios/exportOptions.plist'), /app-store-connect/)

const audio = read('src/lib/audio-context.ts')
assert.match(audio, /applyNativeAudioSession\(type\)/)

const native = read('src/native/ios-audio-session.ts')
assert.match(native, /isNativePlatform/)
assert.match(native, /OmnicianAudio/)
assert.doesNotMatch(native, /@capacitor\/core/)

console.log('ios-prep: ok')
