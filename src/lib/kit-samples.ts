import type { ClickSoundId, VoiceId } from '@/lib/rhythm'

/**
 * Shared Crocell / click catalog for web Safari and the native WKWebView.
 * Native must not invent a second sample set, synth-first kit, or other gains.
 */

export const DRUM_MANIFEST_PATH = 'rhythm/drums/crocell/manifest.json'
export const DRUM_SAMPLE_ROOT = 'rhythm/drums/crocell'
export const ANNOUNCE_SAMPLE_ROOT = 'rhythm/announce/af_heart'

/** Hidden per-lane trims under the 75% / 0 dB fader rest. Kick+snare lead.
 *  Rim (sidestick) is matched to ~85% of snare by peak×RMS of the rendered Crocell hits. */
export const SAMPLE_GAIN: Record<VoiceId, number> = {
  kick: 1.2,
  snare: 1.28,
  rim: 11.5,
  highTom: 1.22,
  midTom: 1.2,
  floorTom: 1.18,
  closedHat: 2.15,
  openHat: 1.58,
  ride: 3.25,
  rideBell: 4.35,
  crash: 0.88,
  stack: 1.05,
  splash: 2.45,
  china: 1.92,
}

/** Per-voice accent gain so each click sample peaks at MASTER_CEILING_DB. */
export const CLICK_ACCENT_GAIN: Record<ClickSoundId, number> = {
  wood: 0.87,
  clave: 0.56,
  digital: 0.75,
  mechanical: 0.70,
}

export const CLICK_SAMPLE_FILES: Record<ClickSoundId, { normal: string; accent: string }> = {
  wood: {
    normal: 'rhythm/clicks/wood-soft-tick.wav',
    accent: 'rhythm/clicks/wood-soft-accent.wav',
  },
  clave: {
    normal: 'rhythm/clicks/clave-tick.wav',
    accent: 'rhythm/clicks/clave-accent.wav',
  },
  digital: {
    normal: 'rhythm/clicks/digital-soft-tick.wav',
    accent: 'rhythm/clicks/digital-soft-accent.wav',
  },
  mechanical: {
    normal: 'rhythm/clicks/mechanical-soft-tick.wav',
    accent: 'rhythm/clicks/mechanical-soft-accent.wav',
  },
}

export type CrocellPiece =
  | 'kick'
  | 'snare_snappy_p2'
  | 'rimshot_snappy_p2'
  | 'sidestick'
  | 'hihat_closed'
  | 'hihat_open'
  | 'crash'
  | 'ride'
  | 'ride_bell'
  | 'tom_high'
  | 'tom_mid'
  | 'tom_low'
  | 'china'
  | 'splash'
  | 'stack'

export const VOICE_PIECE: Record<VoiceId, CrocellPiece> = {
  kick: 'kick',
  snare: 'snare_snappy_p2',
  rim: 'sidestick',
  highTom: 'tom_high',
  midTom: 'tom_mid',
  floorTom: 'tom_low',
  closedHat: 'hihat_closed',
  openHat: 'hihat_open',
  ride: 'ride',
  rideBell: 'ride_bell',
  crash: 'crash',
  stack: 'stack',
  splash: 'splash',
  china: 'china',
}

export function drumSamplePath(file: string): string {
  return `${DRUM_SAMPLE_ROOT}/${file.replace(/^\//, '')}`
}

export function announceSamplePath(paddedPct: string): string {
  return `${ANNOUNCE_SAMPLE_ROOT}/${paddedPct}.mp3`
}
