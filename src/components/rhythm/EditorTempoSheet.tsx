import { Minus, Plus, X } from 'lucide-react'
import { createPortal } from 'react-dom'

import { BpmWheel } from '@/components/rhythm/BpmWheel'
import { Button } from '@/components/ui/button'
import { activateOnPointer } from '@/lib/utils'

export function EditorTempoSheet({
  bpm,
  liveBpm,
  onBpm,
  onTap,
  onClose,
}: {
  bpm: number
  liveBpm: number
  onBpm: (next: number, tick?: boolean) => void
  onTap: () => void
  onClose: () => void
}) {
  if (typeof document === 'undefined') return null
  const shown = Math.round(liveBpm || bpm)

  return createPortal(
    <div
      data-editor-tempo-sheet
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-1.5"
    >
      <button
        type="button"
        aria-label="Close tempo"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-tempo-title"
        data-editor-tempo-dialog
        className="relative z-10 flex max-h-[calc(100svh-0.6rem)] w-max max-w-[calc(100vw-0.6rem)] items-center gap-3 overflow-hidden rounded-2xl border border-white/12 bg-[#141A28] px-3 py-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-[5.5rem] flex-col self-stretch">
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-[#C084FC]">Tempo</p>
          <p
            id="editor-tempo-title"
            className="mt-0.5 text-[1.05rem] font-bold leading-none tabular-nums text-white"
          >
            {shown} BPM
          </p>
          <p className="mt-1 text-[0.62rem] leading-4 text-slate-500">Drag, tap, or type</p>
          <button
            type="button"
            aria-label="Close tempo"
            {...activateOnPointer(onClose)}
            className="mt-auto flex size-8 items-center justify-center rounded-full border border-white/12 text-slate-300"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <BpmWheel compact value={bpm} onChange={(next) => onBpm(next, true)} />
        <div
          data-tempo-taps
          className="grid w-[7.1rem] shrink-0 grid-cols-3 gap-0.5 self-center"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Slower by 5"
            className="h-9 w-full min-w-0 px-1 text-[0.7rem] touch-manipulation"
            {...activateOnPointer(() => onBpm(bpm - 5, true))}
          >
            <Minus className="size-3" />
            5
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-tap
            className="h-9 w-full min-w-0 px-1 text-[0.7rem] touch-manipulation"
            {...activateOnPointer(onTap)}
          >
            Tap
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Faster by 5"
            className="h-9 w-full min-w-0 px-1 text-[0.7rem] touch-manipulation"
            {...activateOnPointer(() => onBpm(bpm + 5, true))}
          >
            <Plus className="size-3" />
            5
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
