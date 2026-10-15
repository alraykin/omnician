import type { RhythmMode } from '@/lib/rhythm'
import { loadRhythmPrefs } from '@/lib/rhythm-prefs'

export const TUNER_PATH = '/tuner'
export const CLICK_PATH = '/click'
export const DRUMS_PATH = '/drums'

export function toolPath(mode: RhythmMode): typeof CLICK_PATH | typeof DRUMS_PATH {
  return mode === 'drums' ? DRUMS_PATH : CLICK_PATH
}

export function modeFromPath(pathname: string): RhythmMode | null {
  if (pathname === CLICK_PATH || pathname.startsWith(`${CLICK_PATH}/`)) return 'click'
  if (pathname === DRUMS_PATH || pathname.startsWith(`${DRUMS_PATH}/`)) return 'drums'
  return null
}

/** Map `/rhythm?mode=` (and leftover query) onto `/click` or `/drums`. */
export function legacyRhythmLocation(search: string, forced?: RhythmMode): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const fromQuery = params.get('mode')
  const mode: RhythmMode =
    forced ?? (fromQuery === 'drums' || fromQuery === 'click' ? fromQuery : loadRhythmPrefs().mode)
  params.delete('mode')
  const qs = params.toString()
  return `${toolPath(mode)}${qs ? `?${qs}` : ''}`
}
