import { preparePlaybackFromGesture } from '@/lib/audio-context'
import { getOrCreateRhythmKit } from '@/lib/rhythm-audio'

let stopPreview: (() => void) | null = null

export function stopListenTempoPreview(): void {
  const stop = stopPreview
  stopPreview = null
  stop?.()
}

/** Two bars of 4/4 click, capped at ~4 seconds. Same Play-tap resume path after the mic. */
export function playListenTempoPreview(bpm: number, onEnded?: () => void): void {
  stopListenTempoPreview()
  preparePlaybackFromGesture()
  const kit = getOrCreateRhythmKit()
  if (!kit) {
    onEnded?.()
    return
  }
  void kit.unlock()
  kit.stopAll()
  const beat = 60 / Math.max(30, Math.min(300, bpm))
  const beats = Math.min(8, Math.max(4, Math.floor(4 / beat)))
  const start = kit.ctx.currentTime + 0.03
  for (let i = 0; i < beats; i += 1) {
    kit.click(start + i * beat, i % 4 === 0 ? 2 : 0, 'wood', true)
  }
  const timer = window.setTimeout(() => {
    if (stopPreview === stop) stopPreview = null
    kit.stopAll()
    onEnded?.()
  }, beats * beat * 1000 + 60)
  const stop = () => {
    window.clearTimeout(timer)
    kit.stopAll()
  }
  stopPreview = stop
}
