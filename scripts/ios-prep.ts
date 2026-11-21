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

assert.match(pkg.dependencies['@capacitor/core'] ?? '', /\^8\./)
assert.match(pkg.dependencies['@capacitor/ios'] ?? '', /\^8\./)

const workflow = read('.github/workflows/ios.yml')
assert.match(workflow, /CODE_SIGNING_ALLOWED=NO/)
assert.match(workflow, /App\.xcworkspace/)
assert.match(workflow, /runs-on: macos-26/)
assert.match(workflow, /xcode-version: '26'/)
assert.match(workflow, /xcodebuild -version/)
assert.match(workflow, /IOS_TESTFLIGHT_ENABLED/)
assert.match(workflow, /APP_STORE_CONNECT_API_KEY_P8/)
assert.doesNotMatch(workflow, /PRODUCT_BUNDLE_IDENTIFIER=/)
assert.match(workflow, /CURRENT_PROJECT_VERSION="\$GITHUB_RUN_NUMBER"/)
assert.match(workflow, /MARKETING_VERSION=1\.0/)
assert.match(workflow, /-allowProvisioningUpdates/)
assert.match(workflow, /-authenticationKeyPath/)
assert.match(workflow, /ios-check-bundle-ids\.sh/)
mustExist('scripts/ios-check-bundle-ids.sh')
assert.match(read('ios/App/Podfile'), /platform :ios, '15\.0'/)
assert.match(pbx, /IPHONEOS_DEPLOYMENT_TARGET = 15\.0/)
const exportOptions = read('ios/exportOptions.plist')
assert.match(exportOptions, /app-store-connect/)
assert.match(exportOptions, /Apple Distribution/)
assert.match(exportOptions, /<string>export<\/string>/)
assert.match(workflow, /CODE_SIGN_STYLE=Manual/)

const audio = read('src/lib/audio-context.ts')
assert.match(audio, /applyNativeAudioSession\(type\)/)

const native = read('src/native/ios-audio-session.ts')
assert.match(native, /isNativePlatform/)
assert.match(native, /OmnicianAudio/)
assert.doesNotMatch(native, /@capacitor\/core/)

console.log('ios-prep: ok')
