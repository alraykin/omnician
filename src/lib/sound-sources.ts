import { bundledAssetUrl } from '@/lib/bundled-assets'
import { isNativeApp, publicApiUrl } from '@/lib/native-origin'

export type SoundSourceReport = {
  platform: 'native' | 'web'
  factoryLibraryUrl: string
  factoryLibraryHost: 'omnician.app' | 'same-origin'
  sampleOrigin: 'bundled-app'
  clicks: string[]
  drumsManifest: string
  announce: string
}

const CLICK_PATHS = [
  'rhythm/clicks/wood-soft-tick.wav',
  'rhythm/clicks/wood-soft-accent.wav',
  'rhythm/clicks/clave-tick.wav',
  'rhythm/clicks/clave-accent.wav',
  'rhythm/clicks/digital-soft-tick.wav',
  'rhythm/clicks/digital-soft-accent.wav',
  'rhythm/clicks/mechanical-soft-tick.wav',
  'rhythm/clicks/mechanical-soft-accent.wav',
] as const

export function soundSourceReport(): SoundSourceReport {
  const native = isNativeApp()
  return {
    platform: native ? 'native' : 'web',
    factoryLibraryUrl: publicApiUrl('/api/factory/library'),
    factoryLibraryHost: native ? 'omnician.app' : 'same-origin',
    sampleOrigin: 'bundled-app',
    clicks: CLICK_PATHS.map((path) => bundledAssetUrl(path)),
    drumsManifest: bundledAssetUrl('rhythm/drums/crocell/manifest.json'),
    announce: bundledAssetUrl('rhythm/announce/af_heart/100.mp3'),
  }
}
