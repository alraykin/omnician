import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { CLICK_PATH, DRUMS_PATH, TUNER_PATH, legacyRhythmLocation, modeFromPath, toolPath } from '../src/lib/tool-routes.ts'

assert.equal(TUNER_PATH, '/tuner')
assert.equal(CLICK_PATH, '/click')
assert.equal(DRUMS_PATH, '/drums')
assert.equal(toolPath('click'), '/click')
assert.equal(toolPath('drums'), '/drums')
assert.equal(modeFromPath('/click'), 'click')
assert.equal(modeFromPath('/drums'), 'drums')
assert.equal(modeFromPath('/tuner'), null)
assert.equal(legacyRhythmLocation('mode=click&debug=audio'), '/click?debug=audio')
assert.equal(legacyRhythmLocation('mode=drums&recorder=1'), '/drums?recorder=1')
assert.equal(legacyRhythmLocation('debug=audio', 'click'), '/click?debug=audio')
assert.equal(legacyRhythmLocation('', 'drums'), '/drums')

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.match(app, /path="\/click"/)
assert.match(app, /path="\/drums"/)
assert.match(app, /path="\/tuner"/)
assert.match(app, /LegacyRhythmRedirect/)
assert.doesNotMatch(app, /path="\/rhythm" element=\{<RhythmPage/)

const tabs = readFileSync(new URL('../src/components/AppTabBar.tsx', import.meta.url), 'utf8')
assert.match(tabs, /CLICK_PATH/)
assert.match(tabs, /DRUMS_PATH/)
assert.doesNotMatch(tabs, /\/rhythm\?mode=/)

const home = readFileSync(new URL('../src/components/ToolButton.tsx', import.meta.url), 'utf8')
assert.match(home, /to: '\/click'/)
assert.match(home, /to: '\/drums'/)
assert.match(home, /to: '\/tuner'/)
assert.doesNotMatch(home, /\/rhythm\?mode=/)

console.log('tool-routes: ok')
