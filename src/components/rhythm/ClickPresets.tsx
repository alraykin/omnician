import { Bookmark, Check, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { OverlayHost, SheetBackdrop, SheetHeader } from '@/components/SheetClose'
import { Button } from '@/components/ui/button'
import {
  clickPresetSummary,
  type ClickPreset,
  type ClickPresetSnapshot,
} from '@/lib/click-presets'
import { activateOnPointer, cn } from '@/lib/utils'

export function ClickPresetChip({
  name,
  onOpen,
}: {
  name: string
  onOpen: () => void
}) {
  return (
    <div className="flex justify-center pt-0.5">
      <button
        type="button"
        data-click-preset-chip
        aria-haspopup="dialog"
        {...activateOnPointer(onOpen)}
        className="flex max-w-full items-center gap-1.5 rounded-full border border-white/12 bg-[#141A28]/90 px-3 py-1.5 text-[0.82rem] font-semibold text-white"
      >
        <Bookmark className="size-3.5 fill-[#A855F7] text-[#A855F7]" />
        <span className="truncate">{name}</span>
        <ChevronDown className="size-3.5 shrink-0 text-slate-400" />
      </button>
    </div>
  )
}

export function ClickPresetsSheet({
  open,
  snap,
  presets,
  loadedId,
  onClose,
  onSaveCurrent,
  onLoad,
  onRename,
  onDelete,
}: {
  open: boolean
  snap: ClickPresetSnapshot
  presets: readonly ClickPreset[]
  loadedId: string | null
  onClose: () => void
  onSaveCurrent: () => void
  onLoad: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) setRenamingId(null)
  }, [open])

  useEffect(() => {
    if (!renamingId) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [renamingId])

  if (!open || typeof document === 'undefined') return null

  const startRename = (preset: ClickPreset) => {
    setRenamingId(preset.id)
    setDraft(preset.name)
  }

  const commitRename = () => {
    if (!renamingId) return
    onRename(renamingId, draft)
    setRenamingId(null)
  }

  return createPortal(
    <OverlayHost
      data-click-presets-sheet
      className="z-[90] items-end bg-black/65 sm:items-center"
    >
      <SheetBackdrop label="Close click presets" onClose={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="click-presets-title"
        className="relative z-10 flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-[1.6rem] border border-white/12 bg-[#121826] px-4 pb-4 pt-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <SheetHeader
          className="mb-3"
          titleId="click-presets-title"
          title="Click presets"
          titleClassName="text-[1.35rem] leading-none"
          onClose={onClose}
          closeLabel="Close click presets"
          description={
            <p className="mt-1.5 text-[0.78rem] leading-5 text-pretty text-slate-400">
              Tempo, meter, sound, subdivision, accents, bars, Speed Builder
            </p>
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
          <button
            type="button"
            data-click-preset-save
            {...activateOnPointer(onSaveCurrent)}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-[#A855F7]/70 bg-[#A855F7]/8 px-3 py-3 text-left"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#A855F7] text-white">
              <Plus className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.95rem] font-bold text-white">Save current</span>
              <span className="mt-0.5 block truncate text-[0.72rem] leading-4 text-slate-400">
                {clickPresetSummary(snap, { alwaysSpeed: true })}
              </span>
            </span>
          </button>

          <p className="mb-2 mt-4 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#C084FC]">
            Saved · {presets.length}
          </p>

          {presets.length === 0 ? (
            <p className="rounded-2xl border border-white/8 px-3 py-4 text-center text-[0.78rem] text-slate-500">
              Nothing saved yet. Tap Save current to keep this click.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {presets.map((preset) => {
                const loaded = preset.id === loadedId
                const renaming = renamingId === preset.id
                return (
                  <li key={preset.id}>
                    <div
                      data-click-preset-row={preset.id}
                      data-click-preset-loaded={loaded ? '1' : '0'}
                      className={cn(
                        'rounded-2xl border px-3 py-2.5',
                        loaded ? 'border-[#A855F7] bg-[#A855F7]/10' : 'border-white/10 bg-[#0F1524]',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          {renaming ? (
                            <div className="flex items-center gap-2">
                              <input
                                ref={inputRef}
                                value={draft}
                                aria-label="Preset name"
                                data-click-preset-rename
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault()
                                    commitRename()
                                  }
                                  if (event.key === 'Escape') {
                                    event.preventDefault()
                                    setRenamingId(null)
                                  }
                                }}
                                className="h-9 min-w-0 flex-1 rounded-lg border border-white/12 bg-[#0B0F1A] px-2.5 text-sm font-semibold text-white outline-none ring-[#A855F7] focus:ring-1"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-9 shrink-0 rounded-full px-3"
                                {...activateOnPointer(commitRename)}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              data-click-preset-load={preset.id}
                              {...activateOnPointer(() => onLoad(preset.id))}
                              className="block w-full min-w-0 text-left"
                            >
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-[0.95rem] font-bold text-white">{preset.name}</span>
                                {loaded ? (
                                  <span
                                    data-click-preset-loaded-tag
                                    className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#A855F7] px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.08em] text-white"
                                  >
                                    <Check className="size-2.5" />
                                    Loaded
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          )}
                          <p className="mt-1 truncate text-[0.72rem] leading-4 text-slate-400">
                            {clickPresetSummary(preset)}
                          </p>
                        </div>
                        {renaming ? null : (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              aria-label={`Rename ${preset.name}`}
                              data-click-preset-edit={preset.id}
                              {...activateOnPointer(() => startRename(preset))}
                              className="flex size-9 items-center justify-center rounded-full text-slate-300"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${preset.name}`}
                              data-click-preset-delete={preset.id}
                              {...activateOnPointer(() => onDelete(preset.id))}
                              className="flex size-9 items-center justify-center rounded-full text-rose-400"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </OverlayHost>,
    document.body,
  )
}
