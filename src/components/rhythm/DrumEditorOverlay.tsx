import { LayoutGrid, Play, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { BarStrip, type BarChipMenu } from '@/components/rhythm/BarStrip'
import { CompactMeter } from '@/components/rhythm/CompactMeter'
import { DrumEditorGrid } from '@/components/rhythm/DrumEditorGrid'
import { DrumInputChips } from '@/components/rhythm/DrumGrid'
import { IntensitySwitch } from '@/components/rhythm/IntensitySwitch'
import { KitMixerPanel } from '@/components/rhythm/KitMixerPanel'
import { type PlayheadStore, type TransportClock } from '@/hooks/useRhythmEngine'
import { usePortraitViewport } from '@/hooks/usePhoneViewport'
import { type InputDivision } from '@/lib/beat-boxes'
import { type KitIntensity } from '@/lib/kit-intensity'
import { type KitGroupId, type KitMix } from '@/lib/kit-mix'
import { readPortraitViewport, tryLockLandscape, unlockOrientation } from '@/lib/phone-viewport'
import { MAX_BARS, type BeatUnit, type RhythmBar, type VoiceId } from '@/lib/rhythm'
import { activateOnPointer, cn } from '@/lib/utils'

export function DrumEditorOverlay({
  beatName,
  bpm,
  liveBpm,
  playing,
  bars,
  barIndex,
  input,
  playheadStore,
  getClock,
  kitMix,
  kitIntensity,
  canAdd,
  barMenu,
  onClose,
  onTogglePlay,
  onInput,
  onMeter,
  onSelectBar,
  onAddBar,
  onRemoveBar,
  onToggle,
  onToggleSoft,
  onMoveHit,
  onPreview,
  onMix,
  onIntensity,
}: {
  beatName: string
  bpm: number
  liveBpm: number
  playing: boolean
  bars: readonly RhythmBar[]
  barIndex: number
  input: InputDivision
  playheadStore: PlayheadStore
  getClock: () => TransportClock
  kitMix: KitMix
  kitIntensity: KitIntensity
  canAdd: boolean
  barMenu: BarChipMenu
  onClose: () => void
  onTogglePlay: () => void
  onInput: (next: InputDivision) => void
  onMeter: (beats: number, beatUnit: BeatUnit) => void
  onSelectBar: (index: number) => void
  onAddBar: () => void
  onRemoveBar: () => void
  onToggle: (barIndex: number, voice: VoiceId, beat: number, slot: number, on: boolean, preview: boolean) => void
  onToggleSoft: (barIndex: number, voice: VoiceId, beat: number, slot: number) => void
  onMoveHit: (
    fromBar: number,
    fromVoice: VoiceId,
    fromBeat: number,
    fromSlot: number,
    toVoice: VoiceId,
    toBeat: number,
    toSlot: number,
    toBar: number,
  ) => void
  onPreview: (voice: VoiceId) => void
  onMix: (group: KitGroupId, db: number) => void
  onIntensity: (next: KitIntensity) => void
}) {
  const portrait = usePortraitViewport()
  const [mixerOpen, setMixerOpen] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const sawLandscape = useRef(!readPortraitViewport())
  const viewBar = Math.min(Math.max(0, barIndex), Math.max(0, bars.length - 1))
  const current = bars[viewBar] ?? bars[0]
  const shownBpm = Math.round(liveBpm || bpm)

  useEffect(() => {
    const html = document.documentElement
    html.classList.add('drum-editor-open')
    void tryLockLandscape()
    return () => {
      html.classList.remove('drum-editor-open')
      unlockOrientation()
    }
  }, [])

  useEffect(() => {
    if (!portrait) {
      sawLandscape.current = true
      return
    }
    if (sawLandscape.current) onCloseRef.current()
  }, [portrait])

  if (typeof document === 'undefined') return null

  const showHint = portrait && !sawLandscape.current

  return createPortal(
    <div
      data-drum-editor
      data-editor-orientation={portrait ? 'portrait' : 'landscape'}
      data-mixer-open={mixerOpen ? '1' : '0'}
      className="fixed inset-0 z-[80] flex flex-col bg-[#0B0F1A] text-white"
      style={{
        paddingTop: 'max(0.35rem, env(safe-area-inset-top, 0px))',
        paddingRight: 'max(0.45rem, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(0.45rem, env(safe-area-inset-left, 0px))',
      }}
    >
      {showHint ? (
        <RotateHint beatName={beatName} onClose={onClose} />
      ) : (
        <>
          <header className="flex shrink-0 items-center gap-1.5 px-1 pb-1">
            <button
              type="button"
              data-editor-done
              {...activateOnPointer(onClose)}
              className="flex h-9 items-center gap-1 rounded-full px-2.5 text-[0.82rem] font-semibold text-slate-200"
            >
              <X className="size-4" />
              Done
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Edit beat</p>
              <p data-editor-beat-name className="truncate text-[0.82rem] font-semibold leading-none text-white">
                {beatName}
              </p>
            </div>
            <IntensitySwitch compact value={kitIntensity} onChange={onIntensity} />
            <button
              type="button"
              data-editor-mixer
              aria-expanded={mixerOpen}
              aria-pressed={mixerOpen}
              {...activateOnPointer(() => setMixerOpen((open) => !open))}
              className={cn(
                'flex h-9 items-center rounded-full px-3 text-[0.72rem] font-semibold uppercase tracking-[0.12em]',
                mixerOpen ? 'bg-[#A855F7] text-white' : 'border border-white/12 bg-white/4 text-slate-100',
              )}
            >
              Mixer
            </button>
            <button
              type="button"
              data-editor-play
              {...activateOnPointer(onTogglePlay)}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.78rem] font-semibold',
                playing ? 'bg-[#7F1D1D] text-white' : 'bg-[#A855F7] text-white',
              )}
            >
              {playing ? <Square className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
              {playing ? 'Stop' : 'Play'}
            </button>
            <p data-editor-bpm className="min-w-[4.2rem] text-right text-[0.82rem] font-semibold tabular-nums text-white">
              {shownBpm} BPM
            </p>
          </header>

          <div className="flex shrink-0 flex-wrap items-center gap-2 px-1 pb-1">
            <DrumInputChips value={input} beatUnit={current?.beatUnit ?? 4} onChange={onInput} className="w-[14.5rem] shrink-0" />
            {current ? (
              <div className="min-w-0 shrink-0">
                <CompactMeter beats={current.beats} beatUnit={current.beatUnit} onChange={onMeter} />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <BarStrip
                store={playheadStore}
                bars={bars}
                barIndex={viewBar}
                playing={playing}
                canAdd={canAdd && bars.length < MAX_BARS}
                onSelect={onSelectBar}
                onAdd={onAddBar}
                onRemove={onRemoveBar}
                menu={barMenu}
              />
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col px-1">
            <DrumEditorGrid
              bars={bars}
              barIndex={viewBar}
              input={input}
              playing={playing}
              getClock={getClock}
              canSwipe={!playing}
              onSelectBar={onSelectBar}
              onToggle={onToggle}
              onToggleSoft={onToggleSoft}
              onMoveHit={onMoveHit}
              onPreview={onPreview}
            />
            {mixerOpen ? (
              <>
                <button
                  type="button"
                  data-mixer-dismiss
                  aria-label="Hide mixer"
                  className="absolute inset-0 z-30 bg-black/25"
                  onClick={() => setMixerOpen(false)}
                />
                <aside
                  data-mixer-panel
                  className="absolute right-0 top-0 z-40 w-[min(16.5rem,46%)] overflow-hidden rounded-2xl border border-white/10 bg-[#101626] px-3 py-2.5 shadow-[-12px_0_32px_rgba(0,0,0,0.35)]"
                >
                  <p className="mb-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Mixer</p>
                  <KitMixerPanel mix={kitMix} onChange={onMix} />
                </aside>
              </>
            ) : null}
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}

function RotateHint({ beatName, onClose }: { beatName: string; onClose: () => void }) {
  return (
    <div data-rotate-hint className="flex min-h-0 flex-1 flex-col px-3">
      <header className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          data-editor-done
          {...activateOnPointer(onClose)}
          className="flex size-10 items-center justify-center rounded-full border border-white/12 text-slate-200"
          aria-label="Done"
        >
          <X className="size-4" />
        </button>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Edit beat</p>
          <p className="truncate text-[0.82rem] font-semibold text-white">{beatName}</p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <RotatePhoneArt />
        <h2 className="mt-6 text-[1.65rem] font-bold tracking-tight text-white">Rotate your phone</h2>
        <p className="mt-2 max-w-[18rem] text-[0.92rem] leading-6 text-slate-400">
          The beat editor works in landscape, so every bar fits in one row.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-[0.72rem] text-slate-300">
          <LayoutGrid className="size-3.5" />
          Turn off rotation lock if it doesn&apos;t turn
        </p>
      </div>
      <button
        type="button"
        data-back-to-drums
        {...activateOnPointer(onClose)}
        className="mb-1 h-12 w-full rounded-full bg-[#A855F7] text-base font-semibold text-white"
      >
        Back to Drums
      </button>
    </div>
  )
}

function RotatePhoneArt() {
  return (
    <svg data-rotate-art viewBox="0 0 180 120" className="h-28 w-44" aria-hidden>
      <rect x="48" y="38" width="84" height="48" rx="12" fill="none" stroke="#A855F7" strokeWidth="3" />
      <circle cx="68" cy="62" r="2.2" fill="#C084FC" />
      <circle cx="78" cy="62" r="2.2" fill="#C084FC" />
      <circle cx="88" cy="62" r="2.2" fill="#C084FC" />
      <circle cx="68" cy="72" r="2.2" fill="#C084FC" />
      <circle cx="78" cy="72" r="2.2" fill="#C084FC" />
      <circle cx="88" cy="72" r="2.2" fill="#C084FC" />
      <rect x="72" y="22" width="36" height="8" rx="2" fill="none" stroke="#A855F7" strokeDasharray="3 3" />
      <path d="M128 34c14 6 22 20 16 36" fill="none" stroke="#E9D5FF" strokeWidth="2" strokeLinecap="round" />
      <path d="M150 64l-8 10 12-2" fill="#E9D5FF" />
    </svg>
  )
}
