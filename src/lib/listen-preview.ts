import { preparePlaybackFromGesture, waitUntilPlaybackRunning } from '@/lib/audio-context'
import { getOrCreateRhythmKit } from '@/lib/rhythm-audio'

let previewGeneration = 0
let previewTimer = 0

function clearPreviewTimer(): void {
  if (previewTimer) {
    window.clearTimeout(previewTimer)
    previewTimer = 0
  }
}

export function stopListenTempoPreview(): void {
  previewGeneration += 1
  clearPreviewTimer()
  getOrCreateRhythmKit()?.stopAll()
}

/**
 * Play is taking the kit. Invalidate the preview timeout so a late stopAll
 * cannot cancel the first metronome notes.
 */
export function claimListenPreview(): void {
  previewGeneration += 1
  clearPreviewTimer()
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
  const generation = previewGeneration
  void waitUntilPlaybackRunning(kit.ctx).then(async (running) => {
    if (!running || generation !== previewGeneration) {
      onEnded?.()
      return
    }
    await kit.unlock()
    if (generation !== previewGeneration) {
      onEnded?.()
      return
    }
    kit.stopAll()
    const beat = 60 / Math.max(30, Math.min(300, bpm))
    const beats = Math.min(8, Math.max(4, Math.floor(4 / beat)))
    const start = kit.ctx.currentTime + 0.03
    for (let i = 0; i < beats; i += 1) {
      kit.click(start + i * beat, i % 4 === 0 ? 2 : 0, 'wood', true)
    }
    previewTimer = window.setTimeout(() => {
      previewTimer = 0
      if (generation !== previewGeneration) return
      kit.stopAll()
      onEnded?.()
    }, beats * beat * 1000 + 60)
  })
}
