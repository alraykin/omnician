import { bundledAssetUrl } from '@/lib/bundled-assets'
import { CLICK_SAMPLE_FILES, DRUM_MANIFEST_PATH, SAMPLE_GAIN, announceSamplePath } from '@/lib/kit-samples'
import { DEFAULT_KIT_MIX, KIT_ZERO_OFFSET_DB } from '@/lib/kit-mix'
import { isNativeApp, mediaUrlCandidates, publicApiUrl } from '@/lib/native-origin'
import { CLICK_SOUNDS, VOICES } from '@/lib/rhythm'

export type SoundSourceReport = {
  platform: 'native' | 'web'
  factoryLibraryUrl: string
  factoryLibraryHost: 'omnician.app' | 'same-origin'
  sampleOrigin: 'live-web-then-bundled' | 'bundled-app'
  clicks: string[]
  clickCandidates: Record<string, string[]>
  drumsManifest: string
  drumManifestCandidates: string[]
  announce: string
  announceCandidates: string[]
  sampleGain: typeof SAMPLE_GAIN
  kitMixDefaults: typeof DEFAULT_KIT_MIX
  cymbalZeroOffsetDb: number
}

export function soundSourceReport(): SoundSourceReport {
  const native = isNativeApp()
  const clickPaths = CLICK_SOUNDS.map((id) => CLICK_SAMPLE_FILES[id].normal)
  return {
    platform: native ? 'native' : 'web',
    factoryLibraryUrl: publicApiUrl('/api/factory/library'),
    factoryLibraryHost: native ? 'omnician.app' : 'same-origin',
    sampleOrigin: native ? 'live-web-then-bundled' : 'bundled-app',
    clicks: clickPaths.map((path) => bundledAssetUrl(path)),
    clickCandidates: Object.fromEntries(
      CLICK_SOUNDS.map((id) => [id, mediaUrlCandidates(CLICK_SAMPLE_FILES[id].normal)]),
    ),
    drumsManifest: bundledAssetUrl(DRUM_MANIFEST_PATH),
    drumManifestCandidates: mediaUrlCandidates(DRUM_MANIFEST_PATH),
    announce: bundledAssetUrl(announceSamplePath('100')),
    announceCandidates: mediaUrlCandidates(announceSamplePath('100')),
    sampleGain: { ...SAMPLE_GAIN },
    kitMixDefaults: { ...DEFAULT_KIT_MIX },
    cymbalZeroOffsetDb: KIT_ZERO_OFFSET_DB.cymbals,
  }
}

export function nativeSoundSourceReport(): SoundSourceReport {
  return {
    platform: 'native',
    factoryLibraryUrl: 'https://omnician.app/api/factory/library',
    factoryLibraryHost: 'omnician.app',
    sampleOrigin: 'live-web-then-bundled',
    clicks: Object.values(CLICK_SAMPLE_FILES).flatMap((pair) => [pair.normal, pair.accent]),
    clickCandidates: Object.fromEntries(
      CLICK_SOUNDS.map((id) => [
        id,
        [`https://omnician.app/${CLICK_SAMPLE_FILES[id].normal}`, `/${CLICK_SAMPLE_FILES[id].normal}`],
      ]),
    ),
    drumsManifest: `/${DRUM_MANIFEST_PATH}`,
    drumManifestCandidates: [`https://omnician.app/${DRUM_MANIFEST_PATH}`, `/${DRUM_MANIFEST_PATH}`],
    announce: `/${announceSamplePath('100')}`,
    announceCandidates: [
      `https://omnician.app/${announceSamplePath('100')}`,
      `/${announceSamplePath('100')}`,
    ],
    sampleGain: { ...SAMPLE_GAIN },
    kitMixDefaults: { ...DEFAULT_KIT_MIX },
    cymbalZeroOffsetDb: KIT_ZERO_OFFSET_DB.cymbals,
  }
}

export function assertedVoiceGains(): typeof SAMPLE_GAIN {
  for (const voice of VOICES) {
    if (!(voice in SAMPLE_GAIN)) throw new Error(`missing SAMPLE_GAIN.${voice}`)
  }
  return SAMPLE_GAIN
}
