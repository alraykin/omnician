type NativeAudioPlugin = {
  setSession?: (options: { category: 'playback' | 'playAndRecord' }) => Promise<unknown>
}

type CapacitorBridge = {
  isNativePlatform?: () => boolean
  Plugins?: { OmnicianAudio?: NativeAudioPlugin }
}

/**
 * Talks to the iOS OmnicianAudio plugin when running inside Capacitor.
 * No-ops in the browser so the live web app is unchanged.
 */
export function applyNativeAudioSession(kind: 'playback' | 'play-and-record'): boolean {
  if (typeof window === 'undefined') return false
  const capacitor = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor
  if (!capacitor?.isNativePlatform?.()) return false
  const plugin = capacitor.Plugins?.OmnicianAudio
  if (!plugin?.setSession) return false
  const category = kind === 'play-and-record' ? 'playAndRecord' : 'playback'
  void plugin.setSession({ category }).catch(() => {
    /* Native session is best-effort; Safari audioSession still applies. */
  })
  return true
}
